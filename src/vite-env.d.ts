/// <reference types="vite/client" />

/**
 * Typed build-time environment.
 *
 * Only variables prefixed VITE_ are exposed to client code by Vite — anything
 * else stays server-side, which is why the Gemini key is read in server.ts via
 * process.env and never here.
 */
interface ImportMetaEnv {
  /**
   * "true" enables the one-click role personas that bypass authentication.
   * Absent or anything else means off. See src/config/appMode.ts.
   */
  readonly VITE_DEMO_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
