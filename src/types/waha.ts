export interface WahaMedia {
  url?: string | null;
  mimetype?: string | null;
  filename?: string | null;
  error?: string | null;
}

export interface WahaMessagePayload {
  id?: string;
  from?: string;
  chatId?: string;
  body?: string | null;
  hasMedia?: boolean;
  media?: WahaMedia | null;
  fromMe?: boolean;
  source?: "app" | "api" | string;
  _data?: Record<string, unknown>;
}

export interface WahaWebhook {
  event?: string;
  session?: string;
  payload?: WahaMessagePayload;
}
