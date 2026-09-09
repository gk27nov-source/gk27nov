import firebaseConfigRaw from '../../firebase-applet-config.json';

/**
 * Unified Application Configuration
 * Handles environment-specific URLs, API bases, Firebase connection, and n8n webhooks.
 * Supports both local development (localhost:3000) and deployed production environments.
 */

// Environment flags
export const IS_PROD = import.meta.env.PROD;
export const IS_DEV = import.meta.env.DEV;

// Application Base URL (defaults to window origin or localhost:3000)
export const APP_BASE_URL: string =
  import.meta.env.VITE_APP_BASE_URL ||
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

// API Base URL (empty by default so client calls use relative paths '/api/...', avoiding CORS/domain mismatch)
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL || '';

export function normalizeWebhookUrl(url?: string): string {
  const fallback = 'https://deepika18.app.n8n.cloud/webhook/89951fe9-c292-49f2-a872-176bda893550';
  if (!url || typeof url !== 'string' || !url.trim()) return fallback;
  let clean = url.trim();
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) clean = `https://${clean}`;
  try {
    const parsed = new URL(clean);
    if (!parsed.pathname || parsed.pathname === '/') {
      return `${parsed.origin}/webhook/89951fe9-c292-49f2-a872-176bda893550`;
    }
    return clean;
  } catch {
    return fallback;
  }
}

// n8n Webhook Configuration
export const N8N_WEBHOOK_PROD_URL: string = normalizeWebhookUrl(
  import.meta.env.VITE_N8N_WEBHOOK_BASE_URL ||
  'https://deepika18.app.n8n.cloud/webhook/89951fe9-c292-49f2-a872-176bda893550'
);

export const N8N_WEBHOOK_TEST_URL: string =
  import.meta.env.VITE_N8N_WEBHOOK_TEST_URL ||
  (N8N_WEBHOOK_PROD_URL.includes('/webhook/')
    ? N8N_WEBHOOK_PROD_URL.replace('/webhook/', '/webhook-test/')
    : N8N_WEBHOOK_PROD_URL);

export const DEFAULT_N8N_WEBHOOK_URL = N8N_WEBHOOK_PROD_URL;

// Firebase configuration with environment variable override support
export const FIREBASE_CONFIG = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigRaw.projectId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfigRaw.appId,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigRaw.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigRaw.authDomain,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigRaw.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigRaw.messagingSenderId,
};

export const FIRESTORE_DATABASE_ID: string =
  import.meta.env.VITE_FIREBASE_DATABASE_ID ||
  (firebaseConfigRaw as any).firestoreDatabaseId ||
  'ai-studio-034deb32-e0f8-473c-a5c8-6f5c4b3dd4cf';
