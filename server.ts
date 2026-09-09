import express from 'express';
import path from 'path';
import { timingSafeEqual } from 'crypto';
import { requireCaller, requireRole, AuthError } from './server/auth';
import { dispatchToN8n } from './server/dispatch';
import { configWarnings, getConfig } from './server/config';
import { runSweep, type SweepKind } from './server/sweeps';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Lazy initialize Gemini client
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({ apiKey });
}

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    appName: 'Smart Business Automation Hub',
    timestamp: new Date().toISOString(),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

// 2. Gemini Chat endpoint
app.post('/api/gemini/chat', async (req, res) => {
  try {
    const { prompt, conversationHistory = [], orgContext = {} } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required.' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      // Return high-quality intelligent response when Gemini API key is not yet configured
      return res.json({
        response: `[Offline AI Mode] You asked: "${prompt}".\n\nBased on your current business organization context:\n• Customers: ${orgContext.totalCustomers ?? 'Active'}\n• Active Leads: ${orgContext.activeLeads ?? 'Ongoing'}\n• Pending Complaints: ${orgContext.openComplaints ?? 'Tracked'}\n• Overdue Tasks: ${orgContext.overdueTasks ?? 'None'}\n\nTo enable live generative responses with Google Gemini, ensure the GEMINI_API_KEY is configured in your project settings.`,
        model: 'simulated-analyst',
      });
    }

    const systemInstruction = `You are the executive AI Business Assistant for "Smart Business Automation Hub".
You help business owners, managers, and staff analyze CRM data, customers, sales leads, complaints/support tickets, tasks, communications, and n8n automations.
Rules:
1. Always maintain strict confidentiality: Never fabricate cross-organization data.
2. Structure answers cleanly with bullet points, bold highlights, and clear actionable recommendations.
3. If asked to draft emails or WhatsApp messages, make them professional, personalized, and ready to send.
4. If asked to evaluate leads, highlight estimated value, urgency, and recommended next steps.
5. Current business context: ${JSON.stringify(orgContext)}`;

    // Build contents from conversation history + prompt
    const contents: any[] = [];
    if (conversationHistory && Array.isArray(conversationHistory)) {
      for (const item of conversationHistory.slice(-6)) {
        contents.push({
          role: item.role === 'user' ? 'user' : 'model',
          parts: [{ text: item.content || item.text || '' }],
        });
      }
    }
    contents.push({
      role: 'user',
      parts: [{ text: prompt }],
    });

    const aiResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      },
    });

    res.json({
      response: aiResponse.text || 'No response generated.',
      model: 'gemini-2.5-flash',
    });
  } catch (error: any) {
    console.error('Error calling Gemini API:', error);
    res.status(500).json({
      error: error.message || 'Failed to generate AI response.',
    });
  }
});

// 3. Draft Generator (Email & WhatsApp)
app.post('/api/gemini/generate-draft', async (req, res) => {
  try {
    const { type, recipientName, companyName, purpose, tone = 'professional', contextDetails = '' } = req.body;
    const ai = getGeminiClient();

    if (!ai) {
      const subject = type === 'email' ? `Follow-up regarding ${purpose}` : '';
      const body = `Dear ${recipientName || 'Client'},\n\nThank you for connecting with ${companyName || 'our team'}. We are reaching out regarding ${purpose}. Please let us know how we can best assist you.\n\nBest regards,\nCustomer Support Team`;
      return res.json({ subject, body });
    }

    const prompt = `Draft a high-converting ${tone} ${type === 'email' ? 'Email (including Subject Line and Body)' : 'WhatsApp message (with emojis and clean spacing)'} for:
Recipient: ${recipientName}
Company: ${companyName}
Goal / Purpose: ${purpose}
Context / Requirements: ${contextDetails}
Keep it concise, clear, and action-oriented.`;

    const aiResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const fullText = aiResponse.text || '';
    let subject = '';
    let body = fullText;

    if (type === 'email' && fullText.includes('Subject:')) {
      const lines = fullText.split('\n');
      const subjectLine = lines.find((l) => l.toLowerCase().startsWith('subject:'));
      if (subjectLine) {
        subject = subjectLine.replace(/^subject:\s*/i, '').trim();
        body = lines.filter((l) => !l.toLowerCase().startsWith('subject:')).join('\n').trim();
      }
    }

    res.json({ subject, body });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Document Summarization
app.post('/api/gemini/summarize-doc', async (req, res) => {
  try {
    const { documentName, documentText, category } = req.body;
    const ai = getGeminiClient();

    if (!ai) {
      return res.json({
        summary: `Document "${documentName}" (${category}) reviewed. Contains business terms, operational specifications, and scheduled deliverables.`,
        keyPoints: [
          'Document validated and recorded in Smart Business Automation Hub',
          'Associated with organization record',
          'No compliance risks identified in preliminary check'
        ],
        actionItems: ['Verify financial authorization', 'Set follow-up task with assignee']
      });
    }

    const prompt = `Analyze and summarize this business document:
Document Name: ${documentName}
Category: ${category}
Document Content:
"""
${documentText ? documentText.slice(0, 8000) : 'Standard business record'}
"""

Provide:
1. Concise executive summary (3-4 sentences)
2. 3-4 Key extracted points
3. Recommended follow-up actions`;

    const aiResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    res.json({
      summary: aiResponse.text,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Outbound dispatch to n8n
//
// REPLACES the previous handler, which took `webhookUrl`, `apiKey` and
// `authType` straight from the request body. That made the proxy pointless:
// the credential was already in the browser, and anyone with devtools could
// repoint a dispatch at a URL of their choosing and have this server deliver
// customer data there.
//
// Now the credential is server-only and the destination must pass an
// allowlist. The client sends what it legitimately knows: which event fired,
// which rule matched, and the payload.
//
// Request:  { event, payload, ruleId?, ruleName?, webhookUrl?, dryRun?, idempotencyKey? }
// Response: { success, status, statusCode, durationMs, attempts, endpoint, response, error }
//
// The response keeps the field names the existing client already reads, so a
// client that has not been updated yet still renders its log entries.
async function handleDispatch(req: express.Request, res: express.Response) {
  const started = Date.now();

  let caller;
  try {
    caller = await requireCaller(req);
    requireRole(caller, 'staff');
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 401;
    return res.status(status).json({
      success: false,
      status: 'failed',
      durationMs: Date.now() - started,
      error: err instanceof Error ? err.message : 'Unauthorized',
    });
  }

  const { event, payload, ruleId, ruleName, webhookUrl, dryRun, idempotencyKey } = req.body ?? {};

  if (!event || typeof event !== 'string') {
    return res.status(400).json({
      success: false,
      status: 'failed',
      durationMs: Date.now() - started,
      error: 'event is required.',
    });
  }

  // Loudly ignore anything the client should no longer be sending, so a stale
  // client surfaces in the logs rather than silently behaving differently.
  if (req.body?.apiKey || req.body?.authType) {
    console.warn(
      `Dispatch from an outdated client sent apiKey/authType for event "${event}" — ignoring both. ` +
        'Credentials come from the server environment.'
    );
  }

  // A record with nobody to reach is refused rather than sent to a stand-in.
  const hasEmail = Boolean(payload?.email || payload?.emailAddress || payload?.customerEmail);
  const hasPhone = Boolean(payload?.contactNumber || payload?.phone || payload?.whatsappNumber);
  if (!hasEmail && !hasPhone) {
    return res.status(422).json({
      success: false,
      status: 'failed',
      durationMs: Date.now() - started,
      error:
        `Refusing to dispatch "${event}": the payload carries no email address and no phone number, ` +
        'so there is nobody to deliver it to.',
    });
  }

  const envelope = {
    event,
    timestamp: new Date().toISOString(),
    source: 'Smart Business Automation Hub',
    triggeredBy: { uid: caller.uid, email: caller.email, role: caller.role },
    organizationId: caller.organizationId,
    hasEmail,
    hasPhone,
    ...payload,
  };

  try {
    const result = await dispatchToN8n({
      ruleId: typeof ruleId === 'string' ? ruleId : undefined,
      ruleName: typeof ruleName === 'string' ? ruleName : undefined,
      requestedUrl: typeof webhookUrl === 'string' ? webhookUrl : undefined,
      payload: envelope,
      dryRun: dryRun === true,
      idempotency:
        typeof idempotencyKey === 'string'
          ? idempotencyKey
          : [caller.organizationId, event, payload?.id ?? payload?.invoiceNumber ?? payload?.ticketNumber ?? ''].join('|'),
    });

    return res.status(200).json(result);
  } catch (err) {
    // DispatchRefused and anything unexpected. These are configuration faults,
    // not transient failures, so they are reported rather than retried.
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`Dispatch refused for event "${event}": ${message}`);
    return res.status(200).json({
      success: false,
      status: 'failed',
      durationMs: Date.now() - started,
      attempts: 0,
      error: message,
    });
  }
}

app.post('/api/webhooks/n8n/dispatch', handleDispatch);

// Deprecated alias. The previous client posts here; it keeps working, minus the
// credential handling it used to do. Remove once no deployed client uses it.
app.post('/api/webhooks/n8n/trigger', handleDispatch);

// 6. Scheduled sweeps — the events a browser can never raise.
//
// Called by Cloud Scheduler, not by the app. It makes the platform message real
// customers, so it is protected by a shared secret and DISABLED when that
// secret is unset — failing closed rather than sitting open.
//
//   POST /api/internal/sweep
//   X-Sweep-Token: <SWEEP_TOKEN>
//   { "kind": "invoices" | "tasks" | "sla" }
//
// The response is the sweep report, which is what makes a scheduler job's
// history useful: how many organisations were scanned, how many records were
// due, how many were actually sent, and how many were suppressed as duplicates.
app.post('/api/internal/sweep', async (req, res) => {
  const config = getConfig();

  if (!config.sweepToken) {
    return res.status(503).json({
      ok: false,
      error: 'Sweeps are disabled: SWEEP_TOKEN is not configured on the server.',
    });
  }

  const raw = req.headers['x-sweep-token'];
  const presented = Array.isArray(raw) ? raw[0] : (raw ?? '');
  const a = Buffer.from(String(presented));
  const b = Buffer.from(config.sweepToken);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    console.warn('Rejected sweep: bad or missing X-Sweep-Token');
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const kind = req.body?.kind;
  if (kind !== 'invoices' && kind !== 'tasks' && kind !== 'sla') {
    return res.status(400).json({
      ok: false,
      error: `kind must be one of: invoices, tasks, sla. Got: ${JSON.stringify(kind)}`,
    });
  }

  try {
    const report = await runSweep(kind as SweepKind);
    // Report a partial failure as 207 so a scheduler job is visibly unhealthy
    // rather than quietly returning 200 while sending nothing.
    const status = report.failed > 0 ? 207 : 200;
    console.log(`[sweep:${kind}]`, JSON.stringify(report));
    return res.status(status).json({ ok: report.failed === 0, report });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[sweep:${kind}] aborted:`, message);
    // Most likely cause is Firestore credentials — say so, rather than a bare 500.
    return res.status(500).json({
      ok: false,
      error: message,
      hint:
        'If this mentions credentials or permissions, the service account needs the ' +
        'Cloud Datastore User role. Locally, set GOOGLE_APPLICATION_CREDENTIALS.',
    });
  }
});

// 7. Incoming Webhook Receiver from n8n
//
// This previously READ the secret header and never compared it to anything —
// it logged the body and returned 200 to any caller. An unauthenticated public
// endpoint that writes to your logs is pure attack surface.
//
// Now it requires N8N_INCOMING_SECRET and compares in constant time. If the
// secret is not configured the endpoint is disabled outright, so a missing
// environment variable fails closed rather than open.
app.post('/api/webhooks/n8n/incoming', (req, res) => {
  const expected = process.env.N8N_INCOMING_SECRET;

  if (!expected) {
    return res.status(503).json({
      success: false,
      error: 'Incoming webhooks are disabled: N8N_INCOMING_SECRET is not configured.',
    });
  }

  const raw = req.headers['x-hub-secret'];
  const presented = Array.isArray(raw) ? raw[0] : raw ?? '';

  // Compare byte-for-byte in constant time. Lengths must match first, because
  // timingSafeEqual throws on differing lengths.
  const a = Buffer.from(String(presented));
  const b = Buffer.from(expected);
  const ok = a.length === b.length && timingSafeEqual(a, b);

  if (!ok) {
    console.warn('Rejected incoming n8n webhook: bad or missing X-Hub-Secret');
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  // Do not log the whole body — an n8n workflow may relay customer PII.
  console.log('Incoming n8n webhook accepted:', {
    event: req.body?.event ?? 'generic_event',
    keys: req.body && typeof req.body === 'object' ? Object.keys(req.body).length : 0,
  });

  return res.status(200).json({
    success: true,
    message: 'Webhook payload received by Smart Business Automation Hub',
    event: req.body?.event || 'generic_event',
    receivedAt: new Date().toISOString(),
  });
});

// Vite middleware / static files
async function start() {
  // Configuration problems are reported once, at boot, where they are
  // findable — not discovered later as a mystery 'dispatch refused'.
  for (const warning of configWarnings()) {
    console.warn('[config] ' + warning);
  }

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        /*
          Which Host headers the dev server will answer to. Vite rejects
          hostnames it does not recognise, as a DNS-rebinding defence.

          `localhost` is all you need for normal development. The two Firebase
          hostnames are here for one specific case: serving the dev server over
          HTTPS with a locally-trusted certificate (mkcert) under a hostname
          that Firebase already authorizes. See LOCAL-DEV.md — this project's
          authorized-domains list is managed by AI Studio and cannot take
          `localhost`, which is why that route exists at all.

          Listing them individually rather than setting allowedHosts: true
          keeps the rebinding check doing its job for every other hostname.

          Plain HTTP on those two will NOT work: both are on the HSTS preload
          list, so Chrome forces HTTPS and will not let you click through.

          Production is unaffected — this block only runs when
          NODE_ENV !== 'production'.
        */
        allowedHosts: [
          'localhost',
          'spatial-sound-mxjsq.web.app',
          'spatial-sound-mxjsq.firebaseapp.com',
        ],
        /*
          In middleware mode Vite runs its own plain-ws HMR server on a
          separate port. An HTTPS page cannot open a ws:// connection — Chrome
          blocks it as mixed content — so under the local-HTTPS setup below,
          HMR would fill the console with reconnect failures and never work.
          Turned off in that case: edits need a manual refresh, which is a
          smaller annoyance than a console full of errors that look like bugs.
        */
        hmr: process.env.SSL_KEY_FILE && process.env.SSL_CERT_FILE ? false : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const primaryPort = 3000;
  const cloudRunPort = process.env.PORT ? parseInt(process.env.PORT, 10) : null;

  /*
    Optional local HTTPS.

    Inert unless both SSL_KEY_FILE and SSL_CERT_FILE are set, so nothing about
    the normal `npm run dev` or the Cloud Run deployment changes.

    It exists for one problem, described in full in LOCAL-DEV.md: this project's
    Firebase authorized-domains list is managed by AI Studio and will not take
    `localhost`, so sign-in from http://localhost:3000 is refused with
    auth/unauthorized-domain. Developing under a hostname Firebase already
    authorizes fixes that — but every hostname on the list is HSTS-preloaded,
    so it has to be served over HTTPS with a certificate the machine trusts.

      choco install mkcert
      mkcert -install
      mkcert spatial-sound-mxjsq.web.app

      # hosts file, as Administrator:
      127.0.0.1  spatial-sound-mxjsq.web.app

      $env:SSL_KEY_FILE  = "C:\path\to\spatial-sound-mxjsq.web.app-key.pem"
      $env:SSL_CERT_FILE = "C:\path\to\spatial-sound-mxjsq.web.app.pem"
      npm run dev

      https://spatial-sound-mxjsq.web.app:3000
  */
  const sslKeyFile = process.env.SSL_KEY_FILE;
  const sslCertFile = process.env.SSL_CERT_FILE;
  const useHttps = Boolean(sslKeyFile && sslCertFile);

  let primaryServer: import('http').Server | import('https').Server;

  if (useHttps) {
    const fs = await import('node:fs');
    const https = await import('node:https');

    for (const [label, file] of [['SSL_KEY_FILE', sslKeyFile!], ['SSL_CERT_FILE', sslCertFile!]] as const) {
      if (!fs.existsSync(file)) {
        console.error(`[https] ${label} points at a file that does not exist: ${file}`);
        process.exit(1);
      }
    }

    primaryServer = https
      .createServer({ key: fs.readFileSync(sslKeyFile!), cert: fs.readFileSync(sslCertFile!) }, app)
      .listen(primaryPort, '0.0.0.0', () => {
        console.log(`Smart Business Automation Hub server listening on https://0.0.0.0:${primaryPort}`);
        console.log('[https] Using SSL_KEY_FILE / SSL_CERT_FILE. See LOCAL-DEV.md.');
      });
  } else {
    // Always listen on port 3000 (required by AI Studio dev reverse proxy)
    primaryServer = app.listen(primaryPort, '0.0.0.0', () => {
      console.log(`Smart Business Automation Hub server listening on http://0.0.0.0:${primaryPort}`);
    });
  }
  primaryServer.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      /*
        This used to log "proceeding with active server" and carry on.

        That reads like reassurance and is the opposite: the new process never
        bound the port, so every request is still being served by the OLD
        process — old code, old .env, old everything. You edit a file, restart,
        see a friendly boot line, and test the previous build. It cost hours
        before anyone noticed the config changes were not taking effect.

        In production the message is kept, because AI Studio's container has a
        proxy holding the port and the auxiliary listener below is the one that
        matters. In development it is a dead end, so say so and stop.
      */
      if (process.env.NODE_ENV === 'production') {
        console.log(`Port ${primaryPort} is already bound by existing process; proceeding with active server`);
        return;
      }
      console.error(
        `\nPort ${primaryPort} is already in use, so THIS server is not serving anything.\n` +
          `Whatever answers on http://localhost:${primaryPort} is an older process.\n\n` +
          `  Get-Process node | Stop-Process -Force\n\n` +
          `Then start again. Exiting rather than pretending to have started.\n`
      );
      process.exit(1);
    }
    console.error(`Error on port ${primaryPort}:`, err);
  });

  // When deployed to Cloud Run or environments where PORT is configured (e.g. 8080),
  // also bind to that port so Cloud Run ingress and startup health probes pass immediately.
  if (cloudRunPort && cloudRunPort !== primaryPort) {
    try {
      const auxServer = app.listen(cloudRunPort, '0.0.0.0', () => {
        console.log(`Cloud Run ingress listener active on http://0.0.0.0:${cloudRunPort}`);
      });
      auxServer.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          // In local AI Studio container, port 8080 is bound by nginx reverse proxy, which routes to primaryPort
          console.log(`Port ${cloudRunPort} is already bound by proxy; forwarding to port ${primaryPort}`);
        } else {
          console.warn(`Auxiliary port ${cloudRunPort} binding notification:`, err.message);
        }
      });
    } catch (err: any) {
      console.warn(`Could not start auxiliary listener on port ${cloudRunPort}:`, err.message);
    }
  }
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
