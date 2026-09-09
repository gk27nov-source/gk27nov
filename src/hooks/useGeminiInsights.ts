import { useCallback, useEffect, useState } from 'react';
import { auth } from '../firebase/config';

/**
 * Business insights from Gemini, replacing three hardcoded paragraphs.
 *
 * The dashboard used to show fixed text under a "Gemini Business Insights"
 * heading. Two details gave it away to anyone paying attention: it named
 * "Vertex Corp" and "Global Systems", which exist nowhere in the data, and it
 * quoted "₹12.5k" in an application where every other figure is in lakhs.
 *
 * This asks the real model, over the endpoint that was already deployed and
 * working. When it cannot — no key, no network, a refusal — it says so. It does
 * not fall back to invented text, because a plausible-looking insight that
 * nobody generated is worse than an empty panel: it gets acted on.
 */

export interface Insight {
  tone: 'warning' | 'idea' | 'success';
  title: string;
  body: string;
}

export interface InsightsState {
  insights: Insight[];
  loading: boolean;
  /** Set when insights could not be produced. Show it; do not paper over it. */
  error: string | null;
  refresh: () => void;
}

export interface InsightContext {
  orgName: string;
  totalCustomers: number;
  activeLeads: number;
  openComplaints: number;
  pendingTasks: number;
  overdueInvoices: number;
  overdueAmount: number;
  topLeads: string[];
  automationFailures: number;
}

const PROMPT = `Review the organisation context you have been given and identify the three
things most worth the owner's attention today.

Respond with a JSON array of exactly three objects and nothing else — no prose
before or after, no markdown fences. Each object has exactly these keys:

  "tone"  : one of "warning", "idea", "success"
  "title" : at most six words
  "body"  : at most thirty words, one or two sentences

Rules:
- Use only the figures in the context. Never invent a customer, company or amount.
- Refer to amounts in Indian format with the rupee symbol.
- If the context is too thin for three findings, still return three, and say
  plainly what is missing rather than inventing something.`;

const TONES = new Set(['warning', 'idea', 'success']);

/** Models sometimes wrap JSON in markdown fences despite being asked not to. */
function extractJson(text: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const body = (fenced ? fenced[1] : text).trim();
  const start = body.indexOf('[');
  const end = body.lastIndexOf(']');
  return start >= 0 && end > start ? body.slice(start, end + 1) : body;
}

function parseInsights(text: string): Insight[] | null {
  try {
    const parsed = JSON.parse(extractJson(text));
    if (!Array.isArray(parsed)) return null;

    const out: Insight[] = [];
    for (const raw of parsed.slice(0, 3)) {
      if (!raw || typeof raw !== 'object') continue;
      const r = raw as Record<string, unknown>;
      const title = typeof r.title === 'string' ? r.title.trim() : '';
      const body = typeof r.body === 'string' ? r.body.trim() : '';
      if (!title || !body) continue;
      const tone = typeof r.tone === 'string' && TONES.has(r.tone) ? (r.tone as Insight['tone']) : 'idea';
      out.push({ tone, title, body });
    }
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

export function useGeminiInsights(context: InsightContext, enabled: boolean): InsightsState {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  // Serialised so the effect re-runs when the figures change, not on every
  // render that rebuilds the same object.
  const contextKey = JSON.stringify(context);

  useEffect(() => {
    if (!enabled) {
      setInsights([]);
      setError(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch('/api/gemini/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ prompt: PROMPT, orgContext: JSON.parse(contextKey) }),
          signal: controller.signal,
        });

        // The endpoint answers with the SPA's HTML if it is not routed, which
        // is exactly the failure that used to be swallowed further down.
        const contentType = res.headers.get('content-type') ?? '';
        if (!contentType.includes('application/json')) {
          throw new Error(`The AI endpoint returned ${res.status} as ${contentType || 'an unknown type'}.`);
        }

        const data = (await res.json()) as { response?: string; error?: string; model?: string };
        if (cancelled) return;

        if (data.error) throw new Error(data.error);
        if (!data.response) throw new Error('The AI returned an empty response.');

        // The server answers in "[Offline AI Mode]" when no key is configured.
        // That is a real state to surface, not something to render as insight.
        if (data.response.startsWith('[Offline AI Mode]')) {
          throw new Error('Gemini is not configured on the server (GEMINI_API_KEY is unset).');
        }

        const parsed = parseInsights(data.response);
        if (!parsed) throw new Error('The AI response could not be read as insights.');

        setInsights(parsed);
      } catch (err) {
        if (cancelled || (err instanceof Error && err.name === 'AbortError')) return;
        setInsights([]);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [contextKey, enabled, nonce]);

  return { insights, loading, error, refresh };
}
