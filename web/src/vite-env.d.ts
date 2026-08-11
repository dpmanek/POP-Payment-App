/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL for the existing POP APIs. Empty = same origin. */
  readonly VITE_API_BASE_URL?: string;
  /** Base URL for the future workflow orchestrator. Unused until it exists. */
  readonly VITE_ORCHESTRATOR_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
