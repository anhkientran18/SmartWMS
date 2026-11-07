/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DATA_MODE?: "mock" | "api" | string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_ENABLE_UNVERIFIED_PRODUCT_MUTATIONS?: string;
  readonly VITE_ENABLE_UNVERIFIED_LOCATION_MUTATIONS?: string;
  readonly [key: string]: string | boolean | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
