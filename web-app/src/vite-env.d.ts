/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DCID_APP_ID: string
  readonly VITE_DCID_SIGNING_APP_ID: string
  readonly VITE_DCID_ENCRYPTION_APP_ID: string
  readonly VITE_DCID_SIGNING_ENV: string
  readonly VITE_DCID_ENCRYPTION_ENV: string
  readonly VITE_DCID_API_URL: string
  readonly VITE_DCID_WS_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
