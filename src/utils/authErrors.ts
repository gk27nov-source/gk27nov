/**
 * Turning Firebase auth error codes into something a person can act on.
 *
 * The modal used to render `err.message` straight through, so a signed-out user
 * was shown "Firebase: Error (auth/operation-not-allowed)." — which names the
 * SDK, leaks the error code, and tells them nothing about what to do. In that
 * particular case the answer is not even theirs to act on: the Email/Password
 * provider is switched off in the Firebase console, and no amount of retyping a
 * password will fix it.
 *
 * Two audiences, so two strings. `message` is for whoever is looking at the
 * screen. `adminHint` is set only for the codes that are a project
 * misconfiguration rather than a user mistake, and is rendered in smaller text
 * underneath — during a pilot the person at the keyboard is often the person
 * who can go and fix it.
 */

export interface AuthErrorText {
  message: string;
  adminHint?: string;
}

const MESSAGES: Record<string, AuthErrorText> = {
  'auth/operation-not-allowed': {
    message: 'This sign-in method is turned off for this workspace.',
    adminHint:
      'Firebase console → Authentication → Sign-in method → enable Email/Password (and Google, if that button is offered).',
  },
  'auth/invalid-credential': { message: 'That email and password do not match an account.' },
  'auth/wrong-password': { message: 'That email and password do not match an account.' },
  'auth/user-not-found': { message: 'That email and password do not match an account.' },
  'auth/invalid-email': { message: 'That does not look like a valid email address.' },
  'auth/user-disabled': {
    message: 'This account has been disabled.',
    adminHint: 'Re-enable it in Firebase console → Authentication → Users.',
  },
  'auth/too-many-requests': {
    message: 'Too many attempts from this device. Wait a few minutes and try again, or reset your password.',
  },
  'auth/email-already-in-use': {
    message: 'An account already exists for that email address. Sign in instead, or reset the password.',
  },
  'auth/weak-password': { message: 'Choose a longer password — at least six characters.' },
  'auth/missing-password': { message: 'Enter your password.' },
  'auth/network-request-failed': {
    message: 'Could not reach the sign-in service. Check your connection and try again.',
  },
  'auth/popup-closed-by-user': { message: 'The Google sign-in window was closed before it finished.' },
  'auth/popup-blocked': { message: 'Your browser blocked the Google sign-in window. Allow popups for this site and try again.' },
  'auth/cancelled-popup-request': { message: 'Another sign-in window was already open.' },
  'auth/unauthorized-domain': {
    message: 'Sign-in is not permitted from this address.',
    adminHint:
      'Firebase console → Authentication → Settings → Authorized domains → add this hostname (localhost is there by default).',
  },
  'auth/account-exists-with-different-credential': {
    message: 'An account with this email already exists using a different sign-in method. Use that method instead.',
  },
  'auth/requires-recent-login': { message: 'For security, sign in again before making this change.' },
  'auth/internal-error': { message: 'The sign-in service returned an unexpected error. Try again in a moment.' },
};

/**
 * Deliberately identical text for wrong-password, user-not-found and
 * invalid-credential. Distinguishing them tells an attacker which email
 * addresses have accounts, which is why newer Firebase versions collapse them
 * into invalid-credential themselves.
 */
export function describeAuthError(err: unknown): AuthErrorText {
  const code =
    typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: unknown }).code) : '';

  const known = MESSAGES[code];
  if (known) return known;

  // Unknown code: say so plainly and keep the code, which is what somebody
  // would need to look it up. Strip Firebase's own "Firebase: ... (code)."
  // wrapper, which reads like a stack trace to everyone else.
  const raw = err instanceof Error ? err.message.replace(/^Firebase:\s*/i, '').replace(/\s*\(auth\/[^)]+\)\.?$/, '') : '';
  return {
    message: raw.trim() || 'Sign-in failed. Please try again.',
    adminHint: code ? `Firebase reported ${code}.` : undefined,
  };
}
