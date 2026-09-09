/**
 * Demo mode.
 *
 * The one-click role personas are genuinely useful for a live walkthrough — no
 * credentials to type on stage. They are also the reason the application was
 * reachable by anyone: the personas grant super_admin with no authentication at
 * all, and the app booted already signed in as one.
 *
 * So they stay, behind a build-time flag. Vite inlines `import.meta.env` at
 * build time and strips the dead branch, so with the flag off the persona code
 * is not merely hidden — it is absent from the bundle.
 *
 *   Demo build:        VITE_DEMO_MODE=true npm run build
 *   Production build:   npm run build          (flag absent = off)
 *
 * Never default this to true. A missing or malformed value means off.
 */
export const DEMO_MODE: boolean =
  String(import.meta.env.VITE_DEMO_MODE ?? '').toLowerCase() === 'true';

/**
 * Guard for anything that bypasses real authentication. Call this at the point
 * of use rather than only hiding the button, so a bypass cannot be reached by
 * any other route.
 */
export function assertDemoMode(action: string): void {
  if (!DEMO_MODE) {
    throw new Error(`${action} is only available in demo builds (VITE_DEMO_MODE=true).`);
  }
}
