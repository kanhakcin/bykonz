/// <reference types="vite/client" />

interface ImportMetaEnv {
  // API Configuration
  readonly VITE_URI_BASE: string;
  readonly VITE_URI_SOCKET: string;
  readonly VITE_URI_SUPPORT: string;
  readonly VITE_URI_TIMEOUT: string;
  readonly VITE_API_URL: string;

  // ReCAPTCHA
  readonly VITE_RECAPTCHA_SITE_KEY: string;

  // File Upload
  readonly VITE_MAX_SIZE_FILE_BYTES: string;

  // Map
  readonly VITE_MAP_TILER: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
