import type { Request } from 'express';
import { getConfig } from './config';

/**
 * Firebase ID-token verification.
 *
 * Deliberately lazy: firebase-admin is only loaded the first time a token needs
 * checking, so the server still boots (and serves the app) if the dependency or
 * the project id is missing. A misconfiguration then shows up as a clear 503 on
 * one endpoint instead of a crash loop on startup.
 *
 * Verification needs ONLY the project id. The Admin SDK fetches Google's public
 * signing certificates and validates the signature, issuer, audience and expiry
 * itself — no service-account key. That is why this works on AI Studio's Cloud
 * Run without provisioning anything.
 */

export interface Caller {
  uid: string;
  email: string;
  role: string;
  organizationId: string;
}

export class AuthError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

let verifier: ((token: string) => Promise<Record<string, unknown>>) | null = null;
let verifierInitError: string | null = null;

async function getVerifier() {
  const config = getConfig();
  if (verifier) return verifier;
  if (verifierInitError) throw new AuthError(503, verifierInitError);

  if (!config.firebaseProjectId) {
    verifierInitError = 'FIREBASE_PROJECT_ID is not configured on the server.';
    throw new AuthError(503, verifierInitError);
  }

  try {
    const appMod = await import('firebase-admin/app');
    const authMod = await import('firebase-admin/auth');

    const app =
      appMod.getApps().length > 0
        ? appMod.getApp()
        : appMod.initializeApp({ projectId: config.firebaseProjectId });

    const adminAuth = authMod.getAuth(app);
    verifier = (token: string) => adminAuth.verifyIdToken(token) as Promise<Record<string, unknown>>;
    return verifier;
  } catch (err) {
    verifierInitError =
      'firebase-admin could not be initialised: ' + (err instanceof Error ? err.message : String(err));
    throw new AuthError(503, verifierInitError);
  }
}

/**
 * Resolve the caller from `Authorization: Bearer <id-token>`.
 *
 * Returns a synthetic development caller when DISPATCH_REQUIRE_AUTH is off, so
 * that local testing against a mock n8n does not need a real Firebase session.
 * That flag defaults to ON.
 */
export async function requireCaller(req: Request): Promise<Caller> {
  const config = getConfig();
  if (!config.requireAuth) {
    return {
      uid: 'dev:unauthenticated',
      email: '',
      role: 'super_admin',
      organizationId: 'dev',
    };
  }

  const header = req.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) {
    throw new AuthError(401, 'Missing Authorization: Bearer <Firebase ID token>');
  }

  const verify = await getVerifier();

  let claims: Record<string, unknown>;
  try {
    claims = await verify(match[1]);
  } catch (err) {
    throw new AuthError(401, 'Invalid or expired ID token: ' + (err instanceof Error ? err.message : String(err)));
  }

  const role = typeof claims.role === 'string' ? claims.role : '';
  const organizationId = typeof claims.organizationId === 'string' ? claims.organizationId : '';

  if (!role || !organizationId) {
    throw new AuthError(
      403,
      'This account has no role/organizationId claim. An administrator must run scripts/set-claims.mjs for it.'
    );
  }

  return {
    uid: String(claims.uid ?? claims.sub ?? ''),
    email: typeof claims.email === 'string' ? claims.email : '',
    role,
    organizationId,
  };
}

const ROLE_RANK: Record<string, number> = {
  viewer: 0,
  staff: 1,
  manager: 2,
  business_admin: 3,
  super_admin: 4,
};

export function requireRole(caller: Caller, minimum: keyof typeof ROLE_RANK): void {
  const have = ROLE_RANK[caller.role] ?? -1;
  const need = ROLE_RANK[minimum] ?? 99;
  if (have < need) {
    throw new AuthError(403, `Role '${caller.role}' is below the required '${minimum}'.`);
  }
}
