/**
 * Server-side dispatch configuration.
 *
 * Everything a caller must NOT control lives here, read from the environment:
 * credentials, which hosts may be reached, and whether authentication is
 * enforced. The browser supplies an event, a payload and (optionally) a webhook
 * URL — never a secret.
 */

export type N8nAuthType = 'none' | 'header' | 'bearer' | 'basic' | 'hmac';

const str = (name: string): string => (process.env[name] ?? '').trim();

const bool = (name: string, fallback: boolean): boolean => {
  const raw = str(name).toLowerCase();
  if (raw === '') return fallback;
  return raw === 'true' || raw === '1' || raw === 'yes';
};

/** Parse a JSON object from the environment, tolerating an absent value. */
function jsonObject(name: string): Record<string, string> {
  const raw = str(name);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
    console.warn(`${name} is not a JSON object — ignoring it.`);
  } catch {
    console.warn(`${name} is not valid JSON — ignoring it.`);
  }
  return {};
}

function build() {
    return {
    /** Master switch. With this off the dispatch endpoint refuses everything. */
    n8nEnabled: bool('N8N_ENABLED', true),

    /** Default destination when a rule supplies none. */
    defaultWebhookUrl: str('N8N_WEBHOOK_URL'),

    /**
     * Per-rule destinations, keyed by rule id:
     *   N8N_RULE_URLS={"auto_01":"https://x.app.n8n.cloud/webhook/abc"}
     * An entry here OVERRIDES whatever the client sends for that rule, which is
     * how you lock a deployment down completely.
     */
    ruleUrls: jsonObject('N8N_RULE_URLS'),

    /**
     * Hosts the dispatcher may reach, comma separated:
     *   N8N_ALLOWED_HOSTS=angoori.app.n8n.cloud,localhost
     *
     * This is what makes a client-supplied URL safe. Without it, a URL from the
     * browser could point anywhere — and the server would obligingly deliver
     * your customers' data there with a valid signature attached.
     *
     * Empty means: ignore client-supplied URLs entirely and use only the
     * configured ones. Failing closed is the right default.
     */
    allowedHosts: str('N8N_ALLOWED_HOSTS')
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean),

    authType: (str('N8N_AUTH_TYPE') || 'none') as N8nAuthType,
    /** Bearer token, header value, or HMAC signing key depending on authType. */
    secret: str('N8N_SECRET'),
    authHeaderName: str('N8N_AUTH_HEADER_NAME') || 'X-API-Key',
    basicUser: str('N8N_BASIC_USER'),
    basicPassword: str('N8N_BASIC_PASSWORD'),

    /**
     * Firebase project id, used to verify ID tokens.
     *
     * Verification needs ONLY the project id — the Admin SDK fetches Google's
     * public signing certificates and checks the signature and audience itself.
     * No service-account key, so this works on AI Studio's Cloud Run without any
     * extra credentials.
     */
    firebaseProjectId: str('FIREBASE_PROJECT_ID'),

    /**
     * Enforce a valid Firebase ID token on dispatch. Defaults ON.
     * Turn it off only for local development against a mock n8n.
     */
    requireAuth: bool('DISPATCH_REQUIRE_AUTH', true),

    /** Retry policy for outbound calls. */
    maxAttempts: 3,
    backoffMs: [700, 2500] as const,
    timeoutMs: 10_000,

    /** How long a completed dispatch suppresses an identical repeat. */
    idempotencyWindowMs: 6 * 60 * 60 * 1000,

    /**
     * Shared secret for POST /api/internal/sweep, which Cloud Scheduler calls.
     *
     * That endpoint makes the platform message real customers, so it is not
     * something to leave open. Unset means the endpoint is DISABLED rather than
     * unprotected — failing closed, as with the incoming webhook.
     */
    sweepToken: str('SWEEP_TOKEN'),

    /** Days before the due date that invoice_due fires. */
    invoiceLeadDays: Number(str('INVOICE_REMINDER_LEAD_DAYS') || '3'),
  } as const;
}

export type ServerConfig = ReturnType<typeof build>;

/**
 * Read configuration from the environment.
 *
 * A function rather than a module-level constant, for two reasons: the tests
 * can exercise several configurations in one process, and a variable set after
 * this module is first imported is still picked up instead of being frozen at
 * import time.
 */
export function getConfig(): ServerConfig {
  return build();
}

/** Problems worth shouting about at boot rather than discovering at 2am. */
export function configWarnings(): string[] {
  const config = getConfig();
  const out: string[] = [];

  if (!config.n8nEnabled) {
    out.push('N8N_ENABLED is false — the dispatch endpoint will refuse all requests.');
  }
  if (!config.defaultWebhookUrl && Object.keys(config.ruleUrls).length === 0 && config.allowedHosts.length === 0) {
    out.push(
      'No N8N_WEBHOOK_URL, no N8N_RULE_URLS and no N8N_ALLOWED_HOSTS — every dispatch will be refused. ' +
        'Set at least one.'
    );
  }
  if (config.authType === 'hmac' && !config.secret) {
    out.push('N8N_AUTH_TYPE=hmac but N8N_SECRET is empty — dispatches will be refused.');
  }
  if ((config.authType === 'header' || config.authType === 'bearer') && !config.secret) {
    out.push(`N8N_AUTH_TYPE=${config.authType} but N8N_SECRET is empty — dispatches will be refused.`);
  }
  if (config.authType === 'basic' && (!config.basicUser || !config.basicPassword)) {
    out.push('N8N_AUTH_TYPE=basic but N8N_BASIC_USER / N8N_BASIC_PASSWORD are incomplete.');
  }
  if (config.requireAuth && !config.firebaseProjectId) {
    out.push(
      'DISPATCH_REQUIRE_AUTH is on but FIREBASE_PROJECT_ID is not set — token verification cannot work, ' +
        'so dispatches will be refused.'
    );
  }
  if (!config.requireAuth) {
    out.push('DISPATCH_REQUIRE_AUTH is OFF — the dispatch endpoint is unauthenticated. Development only.');
  }
  if (!config.sweepToken) {
    out.push(
      'SWEEP_TOKEN is not set — /api/internal/sweep is disabled, so no scheduled reminder will ever fire.'
    );
  }
  if (!Number.isFinite(config.invoiceLeadDays) || config.invoiceLeadDays < 0) {
    out.push('INVOICE_REMINDER_LEAD_DAYS is not a valid number of days.');
  }
  return out;
}
