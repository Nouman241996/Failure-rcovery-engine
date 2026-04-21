import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

/**
 * Resolves the backend base URL.
 *
 * In production builds we prefer the runtime-injected `window.__FRE_CONFIG__`
 * so the same image can be promoted across environments without rebuilds. The
 * `NEXT_PUBLIC_API_URL` env var is a build-time fallback for local dev.
 */
function resolveBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const runtime = (window as unknown as { __FRE_CONFIG__?: { apiUrl?: string } }).__FRE_CONFIG__;
    if (runtime?.apiUrl) return runtime.apiUrl;
  }
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
}

function resolveApiKey(): string | undefined {
  if (typeof window !== 'undefined') {
    const runtime = (window as unknown as { __FRE_CONFIG__?: { apiKey?: string } }).__FRE_CONFIG__;
    if (runtime?.apiKey) return runtime.apiKey;
    const stored = window.localStorage.getItem('fre.apiKey');
    if (stored) return stored;
  }
  return process.env.NEXT_PUBLIC_API_KEY || undefined;
}

export const apiBaseUrl = resolveBaseUrl();

export const api = axios.create({
  baseURL: `${apiBaseUrl}/v1`,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const key = resolveApiKey();
  if (key) {
    config.headers.set('X-API-Key', key);
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err: AxiosError<{ error?: { message?: string }; message?: string }>) => {
    const data = err.response?.data;
    const msg =
      (data && typeof data === 'object' && (data.error?.message ?? data.message)) ||
      err.message ||
      'Request failed';
    return Promise.reject(new Error(typeof msg === 'string' ? msg : JSON.stringify(msg)));
  },
);

export function setApiKey(key: string | null) {
  if (typeof window === 'undefined') return;
  if (key) window.localStorage.setItem('fre.apiKey', key);
  else window.localStorage.removeItem('fre.apiKey');
}
