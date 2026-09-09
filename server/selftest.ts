/**
 * Self-tests for the outbound dispatch layer.
 *
 * These need no Firebase, no n8n account and no network — a mock n8n runs on
 * localhost. They cover the parts that carry real risk: where a dispatch is
 * allowed to go, what credential it carries, what gets retried, and what
 * happens on a repeat.
 *
 * Run:  npx tsx server/selftest.ts
 */

import { createHmac } from 'crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'http';
import { resolveWebhookUrl, buildAuthHeaders, dispatchToN8n, DispatchRefused, claim, release, idempotencyKey } from './dispatch';
import { configWarnings } from './config';

let passed = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail = ''): void {
  if (ok) {
    passed++;
    console.log(`  ok    ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

/** Set exactly this environment, clearing every other N8N_* variable. */
function env(vars: Record<string, string>): void {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('N8N_') || key === 'DISPATCH_REQUIRE_AUTH' || key === 'FIREBASE_PROJECT_ID') {
      delete process.env[key];
    }
  }
  Object.assign(process.env, vars);
}

function refusalFrom(fn: () => unknown): string | null {
  try {
    fn();
    return null;
  } catch (err) {
    return err instanceof DispatchRefused ? err.message : `WRONG ERROR: ${String(err)}`;
  }
}

interface Captured {
  headers: IncomingMessage['headers'];
  body: string;
  count: number;
  path: string;
}

function mockN8n(
  behaviour: (hit: number) => { status: number; body: string; delayMs?: number }
): Promise<{ server: Server; url: string; captured: Captured }> {
  const captured: Captured = { headers: {}, body: '', count: 0, path: '' };
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      captured.count++;
      captured.headers = req.headers;
      captured.body = body;
      captured.path = req.url ?? '';
      const { status, body: reply, delayMs } = behaviour(captured.count);
      const send = () => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(reply);
      };
      if (delayMs) setTimeout(send, delayMs);
      else send();
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({ server, url: `http://127.0.0.1:${port}/webhook/test`, captured });
    });
  });
}

const PAYLOAD = { event: 'invoice_due', invoiceNumber: 'INV-2026-001', email: 'a@b.test' };

async function run(): Promise<void> {
  console.log('\nWhere a dispatch is allowed to go');

  // The headline fix: a URL from the browser cannot point anywhere it likes.
  env({ N8N_ALLOWED_HOSTS: 'good.n8n.cloud' });
  check(
    'a client URL on an allowed host is accepted',
    resolveWebhookUrl(undefined, 'https://good.n8n.cloud/webhook/abc') === 'https://good.n8n.cloud/webhook/abc'
  );
  check(
    'a client URL on an UNLISTED host is refused',
    (refusalFrom(() => resolveWebhookUrl(undefined, 'https://attacker.test/collect')) ?? '').includes('not in N8N_ALLOWED_HOSTS')
  );

  env({ N8N_WEBHOOK_URL: 'https://server.n8n.cloud/webhook/default' });
  check(
    'with no allowlist, a client URL is ignored entirely (fails closed)',
    (refusalFrom(() => resolveWebhookUrl(undefined, 'https://attacker.test/collect')) ?? '').includes('N8N_ALLOWED_HOSTS is not set')
  );
  check(
    'the server default is used when the client sends none',
    resolveWebhookUrl(undefined, undefined) === 'https://server.n8n.cloud/webhook/default'
  );

  // A pinned rule URL cannot be overridden by the caller.
  env({
    N8N_ALLOWED_HOSTS: 'good.n8n.cloud',
    N8N_RULE_URLS: '{"auto_01":"https://pinned.n8n.cloud/webhook/locked"}',
  });
  check(
    'a pinned rule URL beats the client URL',
    resolveWebhookUrl('auto_01', 'https://good.n8n.cloud/webhook/other') === 'https://pinned.n8n.cloud/webhook/locked'
  );
  check(
    'a rule with no pin still uses the allowed client URL',
    resolveWebhookUrl('auto_99', 'https://good.n8n.cloud/webhook/other') === 'https://good.n8n.cloud/webhook/other'
  );

  env({});
  check(
    'nothing configured at all is refused, not silently defaulted',
    (refusalFrom(() => resolveWebhookUrl(undefined, undefined)) ?? '').includes('No webhook URL')
  );

  env({ N8N_ALLOWED_HOSTS: 'good.n8n.cloud,localhost', NODE_ENV: 'production' });
  check(
    'an n8n TEST url is refused in production, with an explanation',
    (refusalFrom(() => resolveWebhookUrl(undefined, 'https://good.n8n.cloud/webhook-test/abc')) ?? '').includes('/webhook-test/')
  );

  /*
    …but allowed in development. Refusing it everywhere sounded prudent and was
    not: while a workflow is still being built it has no /webhook/ url that
    works, so a blanket refusal leaves you with no way to test the dispatch
    path at all. That is what happened in practice.
  */
  env({ N8N_ALLOWED_HOSTS: 'good.n8n.cloud,localhost', NODE_ENV: 'development' });
  check(
    'an n8n TEST url is allowed in development',
    resolveWebhookUrl(undefined, 'https://good.n8n.cloud/webhook-test/abc') ===
      'https://good.n8n.cloud/webhook-test/abc'
  );

  env({ N8N_ALLOWED_HOSTS: 'good.n8n.cloud,localhost' });
  check(
    'plain http to a public host is refused',
    (refusalFrom(() => resolveWebhookUrl(undefined, 'http://good.n8n.cloud/webhook/abc')) ?? '').includes('https://')
  );
  check(
    'plain http to localhost is allowed (local n8n container)',
    resolveWebhookUrl(undefined, 'http://localhost:5678/webhook/abc') === 'http://localhost:5678/webhook/abc'
  );
  check(
    'a malformed URL is refused',
    refusalFrom(() => resolveWebhookUrl(undefined, 'not a url')) !== null
  );

  console.log('\nCredentials come from the server, never the request');

  env({ N8N_AUTH_TYPE: 'none' });
  check('authType none sends no auth header', Object.keys(buildAuthHeaders('{}')).length === 0);

  env({ N8N_AUTH_TYPE: 'header', N8N_SECRET: 's3cr3t', N8N_AUTH_HEADER_NAME: 'X-Custom' });
  check('header auth uses the configured header name', buildAuthHeaders('{}')['X-Custom'] === 's3cr3t');

  env({ N8N_AUTH_TYPE: 'bearer', N8N_SECRET: 'tok' });
  check('bearer auth sets Authorization', buildAuthHeaders('{}').Authorization === 'Bearer tok');

  env({ N8N_AUTH_TYPE: 'basic', N8N_BASIC_USER: 'u', N8N_BASIC_PASSWORD: 'p' });
  check(
    'basic auth base64-encodes the pair',
    buildAuthHeaders('{}').Authorization === 'Basic ' + Buffer.from('u:p').toString('base64')
  );

  env({ N8N_AUTH_TYPE: 'hmac', N8N_SECRET: 'signing-key' });
  const body = JSON.stringify(PAYLOAD);
  const h = buildAuthHeaders(body);
  const expected =
    'sha256=' + createHmac('sha256', 'signing-key').update(`${h['X-SBAH-Timestamp']}.${body}`).digest('hex');
  check('hmac signs timestamp + exact body', h['X-SBAH-Signature'] === expected);

  for (const [label, vars] of [
    ['header', { N8N_AUTH_TYPE: 'header' }],
    ['bearer', { N8N_AUTH_TYPE: 'bearer' }],
    ['hmac', { N8N_AUTH_TYPE: 'hmac' }],
  ] as const) {
    env(vars);
    check(`${label} auth without a secret is refused`, refusalFrom(() => buildAuthHeaders('{}')) !== null);
  }
  env({ N8N_AUTH_TYPE: 'basic', N8N_BASIC_USER: 'u' });
  check('basic auth with half a credential is refused', refusalFrom(() => buildAuthHeaders('{}')) !== null);

  console.log('\nDelivery, retry and idempotency');

  {
    const { server, url, captured } = await mockN8n(() => ({ status: 200, body: '{"ok":true}' }));
    env({ N8N_ALLOWED_HOSTS: 'localhost', N8N_AUTH_TYPE: 'none' });
    const r = await dispatchToN8n({ ruleId: 'auto_01', ruleName: 'Test', requestedUrl: url, payload: PAYLOAD });
    check('a successful dispatch reports success', r.success && r.statusCode === 200, JSON.stringify(r));
    check('a successful dispatch takes one attempt', r.attempts === 1);
    check('the endpoint is recorded on the result', r.endpoint === url);
    check('the body reaches n8n intact', JSON.parse(captured.body).invoiceNumber === 'INV-2026-001');
    server.close();
  }

  {
    const { server, url, captured } = await mockN8n((hit) =>
      hit < 3 ? { status: 503, body: 'busy' } : { status: 200, body: '{}' }
    );
    env({ N8N_ALLOWED_HOSTS: 'localhost' });
    const r = await dispatchToN8n({ requestedUrl: url, payload: PAYLOAD });
    check('a 503 is retried and then succeeds', r.success, r.error ?? '');
    check('that took three attempts', r.attempts === 3 && captured.count === 3, String(captured.count));
    server.close();
  }

  {
    const { server, url, captured } = await mockN8n(() => ({ status: 400, body: 'bad request' }));
    env({ N8N_ALLOWED_HOSTS: 'localhost' });
    const r = await dispatchToN8n({ requestedUrl: url, payload: PAYLOAD });
    check('a 400 is NOT retried', captured.count === 1, String(captured.count));
    check('a 400 is reported as failed with its status', !r.success && r.statusCode === 400);
    server.close();
  }

  {
    const { server, url, captured } = await mockN8n(() => ({ status: 500, body: 'boom' }));
    env({ N8N_ALLOWED_HOSTS: 'localhost' });
    const r = await dispatchToN8n({ requestedUrl: url, payload: PAYLOAD });
    check('retries are bounded, not infinite', captured.count === 3 && r.attempts === 3);
    check('an exhausted dispatch carries an error message', Boolean(r.error));
    server.close();
  }

  {
    const { server, url, captured } = await mockN8n(() => ({ status: 200, body: '{}' }));
    env({ N8N_ALLOWED_HOSTS: 'localhost' });
    const key = `idem-${Date.now()}`;
    const first = await dispatchToN8n({ requestedUrl: url, payload: PAYLOAD, idempotency: key });
    const second = await dispatchToN8n({ requestedUrl: url, payload: PAYLOAD, idempotency: key });
    check('the first dispatch goes out', first.success && captured.count === 1);
    check('an identical repeat is suppressed', second.status === 'skipped', JSON.stringify(second));
    check('n8n was called only once', captured.count === 1, String(captured.count));
    server.close();
  }

  {
    // A failure must not poison the key — the operator has to be able to retry.
    const { server, url, captured } = await mockN8n((hit) =>
      hit <= 3 ? { status: 500, body: 'boom' } : { status: 200, body: '{}' }
    );
    env({ N8N_ALLOWED_HOSTS: 'localhost' });
    const key = `idem-retry-${Date.now()}`;
    const failed = await dispatchToN8n({ requestedUrl: url, payload: PAYLOAD, idempotency: key });
    const retried = await dispatchToN8n({ requestedUrl: url, payload: PAYLOAD, idempotency: key });
    check('a failed dispatch releases its idempotency claim', !failed.success && retried.success, JSON.stringify(retried));
    check('so the retry actually reached n8n', captured.count === 4, String(captured.count));
    server.close();
  }

  {
    const k = idempotencyKey(['org', 'invoice_due', 'INV-1']);
    check('claiming a fresh key succeeds', claim(k));
    check('claiming it again is refused', !claim(k));
    release(k);
    check('after release it can be claimed again', claim(k));
    release(k);
  }

  console.log('\nRefusals and the master switch');

  {
    const { server, url, captured } = await mockN8n(() => ({ status: 200, body: '{}' }));
    env({ N8N_ALLOWED_HOSTS: 'localhost', N8N_ENABLED: 'false' });
    const r = await dispatchToN8n({ requestedUrl: url, payload: PAYLOAD });
    check('N8N_ENABLED=false skips the dispatch', r.status === 'skipped');
    check('and nothing was sent', captured.count === 0);
    server.close();
  }

  {
    const { server, url, captured } = await mockN8n(() => ({ status: 200, body: '{}' }));
    env({ N8N_ALLOWED_HOSTS: 'localhost' });
    const r = await dispatchToN8n({ requestedUrl: url, payload: PAYLOAD, dryRun: true });
    check('a dry run validates without sending', r.status === 'skipped' && captured.count === 0, JSON.stringify(r));
    server.close();
  }

  console.log('\nBoot-time configuration warnings');

  env({ DISPATCH_REQUIRE_AUTH: 'false' });
  check(
    'unauthenticated dispatch is called out',
    configWarnings().some((w) => w.includes('DISPATCH_REQUIRE_AUTH is OFF'))
  );

  env({ N8N_AUTH_TYPE: 'hmac', N8N_WEBHOOK_URL: 'https://x.test/webhook/a', FIREBASE_PROJECT_ID: 'p' });
  check(
    'hmac without a secret is called out',
    configWarnings().some((w) => w.includes('N8N_SECRET is empty'))
  );

  env({ FIREBASE_PROJECT_ID: 'p' });
  check(
    'no destination configured is called out',
    configWarnings().some((w) => w.includes('every dispatch will be refused'))
  );

  env({ N8N_WEBHOOK_URL: 'https://x.test/webhook/a' });
  check(
    'auth required without a project id is called out',
    configWarnings().some((w) => w.includes('FIREBASE_PROJECT_ID is not set'))
  );

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    for (const f of failures) console.log(`  FAIL  ${f}`);
  } else {
    console.log('All dispatch self-tests passed.');
  }
  process.exit(failures.length ? 1 : 0);
}

run().catch((err) => {
  console.error('Self-test crashed:', err);
  process.exit(1);
});
