/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** App version injected at build time from package.json (see vite.config.ts). */
declare const __APP_VERSION__: string

declare interface Window {
  /** Callback registered by App.tsx; called by main.tsx when SW signals onNeedRefresh */
  __swOnUpdate?: (cb: () => void) => void
  /** Holds a pending update callback if onNeedRefresh fired before App mounted */
  __swPendingUpdate?: (() => void) | null
}
