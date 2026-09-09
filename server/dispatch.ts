import { createHmac, createHash } from 'crypto';
import { getConfig, type N8nAuthType } from './config';

/**
 * Outbound dispatch to n8n.
 *
 * Three things the previous implementation got wrong, fixed here:
 *
 *  1. The destination and the credential came from the browser. Anyone with
 *     devtools could repoint a dispatch at a URL of their choosing and have the
 *     server deliver customer data there. Now the credential is server-only and
 *     a client-supplied URL must pass an allowlist.
 *
 *  2. A single attempt with an 8-second timeout and no retry. A momentary 503
 *     from n8n meant the notification was simply lost.
 *
 *  3. No idempotency. A retry — by the user, the browser or a proxy — sent the
 *     customer the same WhatsApp message again.
 */

export class DispatchRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DispatchRefused';
  }
}

export interface DispatchResult {
  ruleId?: string;
  ruleName?: string;
  success: boolean;
  status: 'success' | 'failed' | 'skipped';
  statusCode?: number;
  durationMs: number;
  attempts: number;
  endpoint?: string;
  response?: unknown;
  error?: string;
}

/* ------------------------------------------------------------------ *
 * URL resolution
 * ------------------------------------------------------------------ */

function parseUrl(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', 'host.docker.internal']);

/**
 * Decide where this dispatch actually goes.
 *
 * Precedence, most trusted first:
 *   1. N8N_RULE_URLS[ruleId]  — server-pinned, a client cannot override it
 *   2. the client-supplied URL, if its host is in N8N_ALLOWED_HOSTS
 *   3. N8N_WEBHOOK_URL        — the server default
 *
 * Anything else is refused with a reason the operator can act on.
 */
export function resolveWebhookUrl(ruleId: string | undefined, requestedUrl: string | undefined): string {
  const config = getConfig();
  const pinned = ruleId ? config.ruleUrls[ruleId] : undefined;
  if (pinned) return assertUsable(pinned, `N8N_RULE_URLS entry for rule ${ruleId}`);

  const requested = requestedUrl?.trim();
  if (requested) {
    const parsed = parseUrl(requested);
    if (!parsed) throw new DispatchRefused(`The supplied webhook URL is not a valid URL: ${requested}`);

    const host = parsed.hostname.toLowerCase();
    const allowed = config.allowedHosts.includes(host) || (LOCAL_HOSTS.has(host) && config.allowedHosts.includes('localhost'));

    if (!allowed) {
      /*
        A URL this deployment may not reach.

        If the server has its own configured destination, use that instead of
        refusing. This is what makes one codebase work in two environments: the
        Settings document lives in Firestore and is SHARED between your local
        dev server and the deployed one, so it can only hold one URL. Point it
        at your local n8n; the deployed server, whose allowlist does not include
        localhost, quietly uses its own N8N_WEBHOOK_URL and keeps working.

        Not silent, though — the substitution is logged here and the endpoint
        actually used is recorded on the automation log entry, so nobody has to
        guess where a dispatch went.

        With no server default there is nothing safe to fall back to, so it is
        still refused.
      */
      if (config.defaultWebhookUrl) {
        console.warn(
          `[dispatch] Host "${host}" is not in N8N_ALLOWED_HOSTS (${config.allowedHosts.join(', ') || 'empty'}); ` +
            `using this server's N8N_WEBHOOK_URL instead. Expected on a deployment that shares its Settings ` +
            `document with a local dev server.`
        );
        return assertUsable(config.defaultWebhookUrl, 'N8N_WEBHOOK_URL');
      }

      throw new DispatchRefused(
        config.allowedHosts.length === 0
          ? 'Client-supplied webhook URLs are disabled because N8N_ALLOWED_HOSTS is not set. ' +
            'Configure N8N_WEBHOOK_URL on the server, or add the host to the allowlist.'
          : `Host "${host}" is not in N8N_ALLOWED_HOSTS (${config.allowedHosts.join(', ')}), ` +
            `and this server has no N8N_WEBHOOK_URL to fall back to.`
      );
    }
    return assertUsable(requested, 'the supplied webhook URL');
  }

  if (config.defaultWebhookUrl) return assertUsable(config.defaultWebhookUrl, 'N8N_WEBHOOK_URL');

  throw new DispatchRefused(
    'No webhook URL for this dispatch: the rule has none, N8N_RULE_URLS has no entry, and N8N_WEBHOOK_URL is unset.'
  );
}

function assertUsable(raw: string, source: string): string {
  const config = getConfig();
  const parsed = parseUrl(raw);
  if (!parsed) throw new DispatchRefused(`${source} is not a valid URL.`);

  const isLocal = LOCAL_HOSTS.has(parsed.hostname.toLowerCase());
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLocal)) {
    throw new DispatchRefused(
      `${source} must use https:// (plain http is allowed only for localhost, for a local n8n container).`
    );
  }

  /*
    n8n test URLs.

    /webhook-test/ only accepts a request while the workflow is open in the n8n
    editor with "Listen for test event" armed, and takes exactly one before it
    stops. Shipping one to production means an automation that silently 404s
    forever, so it is refused there.

    In development it is refused NOTHING of the sort: it is the normal way to
    watch a payload arrive while you are still building the workflow, and
    blocking it outright — as this did — leaves you unable to test at all until
    the workflow is published. Allowed with a warning instead.
  */
  if (parsed.pathname.includes('/webhook-test/')) {
    if (process.env.NODE_ENV === 'production') {
      throw new DispatchRefused(
        `${source} is an n8n TEST url (/webhook-test/). That path only fires while the workflow is open in the ` +
          `n8n editor and 404s otherwise, so it is refused in production. Activate the workflow and use its /webhook/ url.`
      );
    }
    console.warn(
      `[dispatch] ${source} is an n8n TEST url (/webhook-test/). Allowed because this is not a production build. ` +
        `It will only succeed while the n8n editor is open with "Listen for test event" armed, and it accepts one ` +
        `request. Switch to the /webhook/ url once the workflow is published.`
    );
  }

  return raw;
}

/* ------------------------------------------------------------------ *
 * Authentication headers — credentials never leave the server
 * ------------------------------------------------------------------ */

export function buildAuthHeaders(rawBody: string): Record<string, string> {
  const config = getConfig();
  const headers: Record<string, string> = {};
  const authType: N8nAuthType = config.authType;

  switch (authType) {
    case 'none':
      break;

    case 'header':
      if (!config.secret) throw new DispatchRefused("N8N_AUTH_TYPE is 'header' but N8N_SECRET is empty.");
      headers[config.authHeaderName] = config.secret;
      break;

    case 'bearer':
      if (!config.secret) throw new DispatchRefused("N8N_AUTH_TYPE is 'bearer' but N8N_SECRET is empty.");
      headers.Authorization = `Bearer ${config.secret}`;
      break;

    case 'basic':
      if (!config.basicUser || !config.basicPassword) {
        throw new DispatchRefused("N8N_AUTH_TYPE is 'basic' but N8N_BASIC_USER / N8N_BASIC_PASSWORD are incomplete.");
      }
      headers.Authorization =
        'Basic ' + Buffer.from(`${config.basicUser}:${config.basicPassword}`).toString('base64');
      break;

    case 'hmac': {
      if (!config.secret) throw new DispatchRefused("N8N_AUTH_TYPE is 'hmac' but N8N_SECRET is empty.");
      // Sign `${timestamp}.${body}` so a captured request cannot be replayed
      // indefinitely. Verify the timestamp window on the n8n side too.
      const timestamp = Date.now().toString();
      const signature = createHmac('sha256', config.secret).update(`${timestamp}.${rawBody}`).digest('hex');
      headers['X-SBAH-Timestamp'] = timestamp;
      headers['X-SBAH-Signature'] = `sha256=${signature}`;
      break;
    }

    default:
      throw new DispatchRefused(`Unknown N8N_AUTH_TYPE: ${String(authType)}`);
  }

  return headers;
}

/* ------------------------------------------------------------------ *
 * Idempotency
 *
 * In-memory, therefore per-instance. That is honest about its limits: with
 * more than one Cloud Run instance a duplicate can still slip through. It
 * covers the common cases — a double click, a browser retry, a refresh — and
 * moves to Firestore when the data layer does.
 * ------------------------------------------------------------------ */

const seen = new Map<string, number>();

function sweep(now: number): void {
  if (seen.size < 500) return;
  const config = getConfig();
  for (const [key, ts] of seen) {
    if (now - ts > config.idempotencyWindowMs) seen.delete(key);
  }
}

export function idempotencyKey(parts: (string | undefined)[]): string {
  return createHash('sha256').update(parts.filter(Boolean).join('|')).digest('hex').slice(0, 40);
}

/** Returns false when an identical dispatch already succeeded in the window. */
export function claim(key: string): boolean {
  const config = getConfig();
  const now = Date.now();
  sweep(now);
  const previous = seen.get(key);
  if (previous !== undefined && now - previous < config.idempotencyWindowMs) return false;
  seen.set(key, now);
  return true;
}

/** Release a claim so a genuine failure can be retried. */
export function release(key: string): void {
  seen.delete(key);
}

/* ------------------------------------------------------------------ *
 * The HTTP call
 * ------------------------------------------------------------------ */

interface Attempt {
  ok: boolean;
  status: number;
  body: unknown;
  error?: string;
}

async function once(url: string, rawBody: string, headers: Record<string, string>): Promise<Attempt> {
  const config = getConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SmartBusinessAutomationHub/2.0',
        ...headers,
      },
      body: rawBody,
      signal: controller.signal,
    });

    const text = await res.text().catch(() => '');
    let body: unknown = text.slice(0, 2000);
    try {
      body = JSON.parse(text);
    } catch {
      /* not JSON — keep the truncated text */
    }

    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const aborted = err instanceof Error && err.name === 'AbortError';
    return {
      ok: false,
      status: 0,
      body: undefined,
      error: aborted ? `Timed out after ${config.timeoutMs}ms` : message,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Retry only what is worth retrying. A 4xx means the request itself is wrong;
 * repeating it cannot help, and for a message-sending workflow it risks doing
 * harm.
 */
function retryable(a: Attempt): boolean {
  return a.status === 0 || a.status === 408 || a.status === 429 || a.status >= 500;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function dispatchToN8n(opts: {
  ruleId?: string;
  ruleName?: string;
  requestedUrl?: string;
  payload: unknown;
  dryRun?: boolean;
  idempotency?: string;
}): Promise<DispatchResult> {
  const config = getConfig();
  const started = Date.now();
  const base = { ruleId: opts.ruleId, ruleName: opts.ruleName };

  if (!config.n8nEnabled) {
    return { ...base, success: false, status: 'skipped', durationMs: 0, attempts: 0, error: 'N8N_ENABLED is false on the server.' };
  }

  const url = resolveWebhookUrl(opts.ruleId, opts.requestedUrl); // throws DispatchRefused
  const rawBody = JSON.stringify(opts.payload);
  const headers = buildAuthHeaders(rawBody); // throws DispatchRefused

  if (opts.dryRun) {
    return {
      ...base,
      success: true,
      status: 'skipped',
      durationMs: Date.now() - started,
      attempts: 0,
      endpoint: url,
      response: {
        dryRun: true,
        message: 'Configuration is valid and the payload was built. Nothing was sent.',
        headerNames: Object.keys(headers),
        bytes: rawBody.length,
      },
    };
  }

  const key = opts.idempotency ? idempotencyKey([opts.idempotency, opts.ruleId]) : null;
  if (key && !claim(key)) {
    return {
      ...base,
      success: true,
      status: 'skipped',
      durationMs: Date.now() - started,
      attempts: 0,
      endpoint: url,
      error: 'Duplicate suppressed — an identical dispatch already went out recently.',
    };
  }

  let attempt: Attempt = { ok: false, status: 0, body: undefined, error: 'not attempted' };
  let attempts = 0;

  for (let i = 0; i < config.maxAttempts; i++) {
    attempts = i + 1;
    attempt = await once(url, rawBody, headers);
    if (attempt.ok || !retryable(attempt)) break;
    const backoff = config.backoffMs[i];
    if (backoff !== undefined) await sleep(backoff);
  }

  // A failed dispatch must not block a later genuine retry.
  if (!attempt.ok && key) release(key);

  return {
    ...base,
    success: attempt.ok,
    status: attempt.ok ? 'success' : 'failed',
    statusCode: attempt.status || undefined,
    durationMs: Date.now() - started,
    attempts,
    endpoint: url,
    response: attempt.body,
    error: attempt.ok ? undefined : (attempt.error ?? `n8n returned HTTP ${attempt.status}`),
  };
}
