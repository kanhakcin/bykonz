/**
 * HTTP API Client
 * Fetch configurado para requitar ao backend
 */

import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import i18n from '@/lib/config/i18n.config';

const baseURL = import.meta.env.VITE_URI_BASE || 'http://localhost:3002/';
const timeout = parseInt(import.meta.env.VITE_URI_TIMEOUT || '30000', 10);

export class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;

  constructor(status: number, statusText: string, data: Record<string, unknown> = {}) {
    super(`HTTP ${status}: ${statusText}`);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

function clearLocalStorage() {
  useAuth.getState().clearAuth();
}

async function handleError(response: Response, options: ApiOptions) {
  let errorData: { code?: string; message?: string; isBlockedTemporary?: boolean; id?: string; error?: { code?: string; message?: string } } | null = null;
  try {
    errorData = await response.json();
  } catch {}

  // Normaliza: alguns routers enviam { error: { code } }, outros enviam { code } diretamente.
  const errorCode = errorData?.error?.code ?? errorData?.code;
  const errorMessage = errorData?.error?.message ?? errorData?.message;

  if (options.defaultTakeCareError === false) {
    throw new ApiError(response.status, response.statusText, (errorData as Record<string, unknown>) ?? {});
  }

  // Conta bloqueada temporariamente: não exibe toast, o caller faz o redirect
  if (errorData?.isBlockedTemporary) {
    throw new ApiError(response.status, response.statusText, (errorData as Record<string, unknown>) ?? {});
  }

  if (response.status === 401) {
    // 401 só derruba a sessão se veio da API principal. Requests para baseURLs
    // customizadas (ex.: serviço de IA) não devem deslogar o usuário do app.
    if (options.baseURL) {
      throw new ApiError(response.status, response.statusText, (errorData as Record<string, unknown>) ?? {});
    }
    toast.error(i18n.t('session.expired'));
    clearLocalStorage();
    window.location.href = `${window.location.origin}/auth`;
  } else if (response.status === 403) {
    if (errorCode) {
      toast.warning(i18n.t(errorCode));
    } else {
      toast.warning(i18n.t('user.notAllowed'));
    }
  } else if (response.status === 400) {
    if (errorCode) {
      toast.warning(i18n.t(errorCode));
    } else if (errorMessage) {
      toast.warning(errorMessage);
    }
  } else if (response.status === 404 || response.status === 409 || response.status === 422) {
    if (errorCode) {
      toast.warning(i18n.t(errorCode));
    }
  } else if (response.status === 500) {
    if (errorCode) {
      toast.error(i18n.t(errorCode));
    } else {
      toast.error(i18n.t('no.connection'));
    }
  } else if (response.status === 429) {
    toast.error(i18n.t('server.too.many.request'));
  } else {
    toast.error(i18n.t('no.connection'));
  }

  throw new ApiError(response.status, response.statusText, (errorData as Record<string, unknown>) ?? {});
}

async function parseResponse<T>(response: Response, responseType: ApiOptions['responseType']): Promise<T> {
  if (response.status === 204) {
    return {} as T;
  }

  const contentType = response.headers.get('content-type');
  if (!contentType || contentType.indexOf('application/json') === -1) {
    if (responseType === 'blob') return (await response.blob()) as T;
    if (responseType === 'text') return (await response.text()) as T;
    if (responseType === 'arraybuffer') return (await response.arrayBuffer()) as T;
    return (await response.text()) as T;
  }

  switch (responseType) {
    case 'blob':
      return (await response.blob()) as T;
    case 'text':
      return (await response.text()) as T;
    case 'arraybuffer':
      return (await response.arrayBuffer()) as T;
    default:
      try {
        return (await response.json()) as T;
      } catch {
        return {} as T;
      }
  }
}

async function fetchWithTimeout<T>(url: string, init: RequestInit, options: ApiOptions): Promise<ApiResponse<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout ?? timeout);

  try {
    // Note: Native fetch doesn't support upload progress directly
    // This is a limitation compared to Axios
    // For real upload progress, you'd need to use XMLHttpRequest

    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      await handleError(response, options);
    }

    const data = await parseResponse<T>(response, options.responseType);

    return {
      data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      toast.error(i18n.t('request.timeout'));
    }
    throw error;
  }
}

function createHeaders(options: ApiOptions): HeadersInit {
  const token = useAuth.getState().token;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (options.method === 'GET' || options.method === 'DELETE') {
    delete headers['Content-Type'];
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return {
    ...headers,
    ...(options.headers || {}),
  } as HeadersInit;
}

function getBaseURL(options: ApiOptions): string {
  if (options.baseURL) return options.baseURL;

  // Normaliza a base removendo barras finais e sufixos de versão/api redundantes
  let base = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;
  base = base
    .replace(/\/api\/v[12]$/, '')
    .replace(/\/v[12]$/, '')
    .replace(/\/api$/, '');

  const version = options.version || (options.isV2 ? 'v2' : 'v1');
  const apiPrefix = options.noApiPrefix ? '' : '/api';

  return `${base}${apiPrefix}/${version}`;
}

class ApiClient {
  async get<T = unknown>(url: string, options: ApiOptions & { params?: Record<string, any> } = {}) {
    const urlNormalized = url.split('?')[0];
    const existingParams = url.split('?')[1];

    const query = new URLSearchParams(existingParams);

    if (options.params) {
      Object.keys(options.params).forEach((key) => {
        const value = (options.params as any)[key];
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach((v) => {
              query.append(key, String(v));
            });
          } else {
            query.append(key, String(value));
          }
        }
      });
    }

    const queryString = query.toString();
    const endpoint = urlNormalized.startsWith('/') ? urlNormalized : `/${urlNormalized}`;
    const fullUrl = `${getBaseURL(options)}${endpoint}${queryString ? `?${queryString}` : ''}`;

    return fetchWithTimeout<T>(
      fullUrl,
      {
        method: 'GET',
        headers: createHeaders({ ...options, method: 'GET' }),
      },
      options,
    );
  }

  async post<T = unknown>(url: string, data?: unknown, options: ApiOptions & { params?: Record<string, any> } = {}) {
    const urlNormalized = url.split('?')[0];
    const existingParams = url.split('?')[1];

    const query = new URLSearchParams(existingParams);

    if (options.params) {
      Object.keys(options.params).forEach((key) => {
        const value = (options.params as any)[key];
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach((v) => {
              query.append(key, String(v));
            });
          } else {
            query.append(key, String(value));
          }
        }
      });
    }

    const queryString = query.toString();
    const endpoint = urlNormalized.startsWith('/') ? urlNormalized : `/${urlNormalized}`;
    const fullUrl = `${getBaseURL(options)}${endpoint}${queryString ? `?${queryString}` : ''}`;
    const headers = createHeaders(options);

    // Handle FormData (don't set Content-Type, let browser set it with boundary)
    const isFormData = data instanceof FormData;
    if (isFormData) {
      delete (headers as Record<string, string>)['Content-Type'];
    }

    return fetchWithTimeout<T>(
      fullUrl,
      {
        method: 'POST',
        headers,
        body: isFormData ? data : JSON.stringify(data),
      },
      options,
    );
  }

  async put<T = unknown>(url: string, data?: unknown, options: ApiOptions & { params?: Record<string, any> } = {}) {
    const urlNormalized = url.split('?')[0];
    const existingParams = url.split('?')[1];

    const query = new URLSearchParams(existingParams);

    if (options.params) {
      Object.keys(options.params).forEach((key) => {
        const value = (options.params as any)[key];
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach((v) => {
              query.append(key, String(v));
            });
          } else {
            query.append(key, String(value));
          }
        }
      });
    }

    const queryString = query.toString();
    const endpoint = urlNormalized.startsWith('/') ? urlNormalized : `/${urlNormalized}`;
    const fullUrl = `${getBaseURL(options)}${endpoint}${queryString ? `?${queryString}` : ''}`;
    const headers = createHeaders(options);

    const isFormData = data instanceof FormData;
    if (isFormData) {
      delete (headers as Record<string, string>)['Content-Type'];
    }

    return fetchWithTimeout<T>(
      fullUrl,
      {
        method: 'PUT',
        headers,
        body: isFormData ? data : JSON.stringify(data),
      },
      options,
    );
  }

  async patch<T = unknown>(url: string, data?: unknown, options: ApiOptions & { params?: Record<string, any> } = {}) {
    const urlNormalized = url.split('?')[0];
    const existingParams = url.split('?')[1];

    const query = new URLSearchParams(existingParams);

    if (options.params) {
      Object.keys(options.params).forEach((key) => {
        const value = (options.params as any)[key];
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach((v) => {
              query.append(key, String(v));
            });
          } else {
            query.append(key, String(value));
          }
        }
      });
    }

    const queryString = query.toString();
    const endpoint = urlNormalized.startsWith('/') ? urlNormalized : `/${urlNormalized}`;
    const fullUrl = `${getBaseURL(options)}${endpoint}${queryString ? `?${queryString}` : ''}`;
    const headers = createHeaders(options);

    const isFormData = data instanceof FormData;
    if (isFormData) {
      delete (headers as Record<string, string>)['Content-Type'];
    }

    return fetchWithTimeout<T>(
      fullUrl,
      {
        method: 'PATCH',
        headers,
        body: isFormData ? data : JSON.stringify(data),
      },
      options,
    );
  }

  async delete<T = unknown>(url: string, options: ApiOptions & { params?: Record<string, any> } = {}) {
    const urlNormalized = url.split('?')[0];
    const existingParams = url.split('?')[1];

    const query = new URLSearchParams(existingParams);

    if (options.params) {
      Object.keys(options.params).forEach((key) => {
        const value = (options.params as any)[key];
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach((v) => {
              query.append(key, String(v));
            });
          } else {
            query.append(key, String(value));
          }
        }
      });
    }

    const queryString = query.toString();
    const endpoint = urlNormalized.startsWith('/') ? urlNormalized : `/${urlNormalized}`;
    const fullUrl = `${getBaseURL(options)}${endpoint}${queryString ? `?${queryString}` : ''}`;

    return fetchWithTimeout<T>(
      fullUrl,
      {
        method: 'DELETE',
        headers: createHeaders({ ...options, method: 'DELETE' }),
      },
      options,
    );
  }
}

export const api = new ApiClient();
export default api;

interface ApiOptions {
  defaultTakeCareError?: boolean;
  handleUploadProgress?: (percent: number) => void;
  headers?: Record<string, string>;
  responseType?: 'json' | 'blob' | 'text' | 'arraybuffer';
  isV2?: boolean;
  version?: 'v1' | 'v2';
  noApiPrefix?: boolean;
  method?: string;
  baseURL?: string;
  timeout?: number;
}

interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
}
