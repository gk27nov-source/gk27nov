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
import {
  resolveWebhookUrl,
  buildAuthHeaders,
  dispatchToN8n,
  DispatchRefused,
  claim,
  release,
  idempotencyKey,
  redactWebhookUrl,
} from './dispatch';
import { configWarnings, getConfig } from './config';

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
    if (
      key.startsWith('N8N_') ||
      key === 'DISPATCH_REQUIRE_AUTH' ||
      key === 'FIREBASE_PROJECT_ID' ||
      key === 'VITE_DEMO_MODE'
    ) {
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

  /*
    The property that matters is that the caller's URL is never honoured, and
    that is unchanged. What changed is what happens next: with a server default
    configured, the dispatch goes THERE — the legitimate destination — instead
    of being dropped. An attacker still cannot redirect anything; a real event
    no longer disappears because someone's Settings row named a host this
    deployment cannot reach.
  */
  env({ N8N_WEBHOOK_URL: 'https://server.n8n.cloud/webhook/default' });
  check(
    "with no allowlist, a client URL is ignored and the server's own destination is used",
    resolveWebhookUrl(undefined, 'https://attacker.test/collect') ===
      'https://server.n8n.cloud/webhook/default'
  );
  env({});
  check(
    'with no allowlist AND no default, there is nowhere safe to send, so it is refused',
    (refusalFrom(() => resolveWebhookUrl(undefined, 'https://attacker.test/collect')) ?? '').includes('N8N_ALLOWED_HOSTS is not set')
  );
  env({ N8N_WEBHOOK_URL: 'https://server.n8n.cloud/webhook/default' });
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

  /*
    One codebase, two environments. The Settings document is shared between the
    local dev server and the deployed one, so it holds a single URL. Each
    server resolves it against its own allowlist.
  */
  env({ N8N_ALLOWED_HOSTS: 'good.n8n.cloud', N8N_WEBHOOK_URL: 'https://good.n8n.cloud/webhook/prod' });
  check(
    'a non-allowlisted host falls back to the server default rather than refusing',
    resolveWebhookUrl(undefined, 'http://localhost:5678/webhook/dev') ===
      'https://good.n8n.cloud/webhook/prod'
  );

  env({ N8N_ALLOWED_HOSTS: 'good.n8n.cloud,localhost', N8N_WEBHOOK_URL: 'https://good.n8n.cloud/webhook/prod' });
  check(
    'an allowlisted host still wins over the server default',
    resolveWebhookUrl(undefined, 'http://localhost:5678/webhook/dev') ===
      'http://localhost:5678/webhook/dev'
  );

  env({ N8N_ALLOWED_HOSTS: 'good.n8n.cloud' });
  check(
    'with no default there is nothing to fall back to, so it is still refused',
    (refusalFrom(() => resolveWebhookUrl(undefined, 'http://localhost:5678/webhook/dev')) ?? '')
      .includes('no N8N_WEBHOOK_URL')
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

    /*
      The shape of the bug that made every Test Trigger after the first one a
      no-op for six hours.

      The manual test payload carried a hardcoded invoiceNumber, so the key the
      server derives — org | event | invoiceNumber — was byte-identical on every
      click. The dispatch was suppressed and reported back as success with an
      HTTP 200 that never happened.

      Two keys, one varying part. If a future change reintroduces a constant
      reference in the test payload, the first of these fails.
    */
    const constantRef = ['org', 'new_lead', 'INV-2026-108'] as const;
    check(
      'a CONSTANT record reference produces the same key twice — this is the trap',
      idempotencyKey([...constantRef]) === idempotencyKey([...constantRef])
    );
    check(
      'a per-click test id does not',
      idempotencyKey(['org', 'new_lead', 'test_1']) !== idempotencyKey(['org', 'new_lead', 'test_2'])
    );
    const first = idempotencyKey(['manual:auto_01:test_1']);
    const second = idempotencyKey(['manual:auto_01:test_2']);
    check('so two consecutive manual tests can both be claimed', claim(first) && claim(second));
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

  /*
    The demo-mode contradiction. Personas do not sign in to Firebase, so with
    the token check also on there is no token to present and every dispatch
    401s. The pair has to be named at boot, because from the browser it looks
    like a server fault.
  */
  env({ VITE_DEMO_MODE: 'true', DISPATCH_REQUIRE_AUTH: 'true', FIREBASE_PROJECT_ID: 'p', N8N_WEBHOOK_URL: 'https://x.test/webhook/a' });
  check(
    'demo personas plus a required token is called out as the contradiction it is',
    configWarnings().some((w) => w.includes('VITE_DEMO_MODE is true AND DISPATCH_REQUIRE_AUTH is on'))
  );

  env({ VITE_DEMO_MODE: 'true', DISPATCH_REQUIRE_AUTH: 'false', N8N_WEBHOOK_URL: 'https://x.test/webhook/a' });
  check(
    'demo personas with the token check off is a coherent pair, so no contradiction warning',
    !configWarnings().some((w) => w.includes('VITE_DEMO_MODE is true AND'))
  );

  env({ DISPATCH_REQUIRE_AUTH: 'true', FIREBASE_PROJECT_ID: 'p', N8N_WEBHOOK_URL: 'https://x.test/webhook/a' });
  check(
    'and a real-sign-in build raises nothing about demo mode',
    !configWarnings().some((w) => w.includes('VITE_DEMO_MODE'))
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

  console.log('\nThe exact symptom: "only runs when I click Execute Workflow"');

  env({ N8N_WEBHOOK_URL: 'https://x.test/webhook-test/abc123', FIREBASE_PROJECT_ID: 'p' });
  check(
    'a TEST url in N8N_WEBHOOK_URL is called out at boot',
    configWarnings().some((w) => w.includes('N8N_WEBHOOK_URL is an n8n TEST url'))
  );

  env({ N8N_WEBHOOK_URL: 'https://x.test/webhook/abc123', FIREBASE_PROJECT_ID: 'p' });
  check(
    'a PRODUCTION url raises no such warning',
    !configWarnings().some((w) => w.includes('TEST url'))
  );

  console.log('\nEnvironment variable naming');

  env({ N8N_WEBHOOK_URL: 'https://primary.test/webhook/a', N8N_WEBHOOK_BASE_URL: 'https://alias.test/webhook/b' });
  check(
    'N8N_WEBHOOK_URL wins when both are set',
    getConfig().defaultWebhookUrl === 'https://primary.test/webhook/a'
  );

  env({ N8N_WEBHOOK_BASE_URL: 'https://alias.test/webhook/b' });
  check(
    'N8N_WEBHOOK_BASE_URL is accepted as an alias when N8N_WEBHOOK_URL is unset',
    getConfig().defaultWebhookUrl === 'https://alias.test/webhook/b'
  );

  console.log('\nSecret redaction in logs');

  check(
    'a webhook url with N8N_AUTH_TYPE=none keeps its path-id out of the log line',
    !redactWebhookUrl('https://x.app.n8n.cloud/webhook/8d2aa711-7061-44a4-9ad7-7f7cc2e5fbbe').includes('8d2aa711')
  );
  check(
    'the redacted form still names the host, for tracing which destination it was',
    redactWebhookUrl('https://x.app.n8n.cloud/webhook/8d2aa711-7061-44a4-9ad7-7f7cc2e5fbbe').includes('x.app.n8n.cloud')
  );
  check('an absent url redacts to a fixed placeholder, not undefined', redactWebhookUrl(undefined) === '(none)');
  check('a malformed url redacts rather than throwing', redactWebhookUrl('not a url') === '(invalid url)');

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
