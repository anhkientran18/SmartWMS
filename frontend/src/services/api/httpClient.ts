import axios from 'axios';
import i18n from '../../i18n';
import { apiBaseUrl, isDemoMode } from '../../app/dataMode';
import { expiresAt, sessionStore } from '../../features/auth/session';
import { ApiError } from './apiTypes';

export function normalizeApiError(status?: number, body?: unknown): ApiError {
  const data = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const errors = data.errors && typeof data.errors === 'object' ? data.errors as ApiError['errors'] : null;
  const detail = [data.detail, data.message, data.title, data.error]
    .find(value => typeof value === 'string' && value.trim()) as string | undefined;
  const validation = errors ? Object.values(errors).flat().filter(value => typeof value === 'string').join(', ') : '';
  const key = status === undefined ? 'network' : [400, 401, 403, 404, 409].includes(status) ? String(status) : 'server';
  return { status, message: detail || validation || i18n.t(`f1.errors.${key}`),
    error: typeof data.detail === 'string' ? data.detail : null, errors,
    code: typeof data.errorCode === 'string' ? data.errorCode : typeof data.code === 'string' ? data.code : undefined,
    isAuthError: status === 401, isForbidden: status === 403 };
}
export const httpClient = axios.create({ baseURL: apiBaseUrl, timeout: 15000 });
httpClient.interceptors.request.use(config => {
  if (!isDemoMode && !apiBaseUrl) throw normalizeApiError(undefined, { message: i18n.t('f1.errors.config') });
  const anonymous = config.url === '/api/v1/Auth/login';
  // Logout carries a snapshot captured from the canonical session before local clearing.
  if (config.url === '/api/v1/Auth/logout') return config;
  const session = sessionStore.get();
  if (!anonymous && session && !isDemoMode) {
    if (expiresAt(session.token) <= Date.now()) {
      sessionStore.invalidate(session.token);
      throw normalizeApiError(401);
    }
    config.headers.set('Authorization', `Bearer ${session.token}`);
  } else config.headers.delete('Authorization');
  return config;
});
httpClient.interceptors.response.use(response => {
  if (response.data?.isSuccess === false) throw normalizeApiError(response.status, response.data);
  return response;
}, error => {
  if (axios.isCancel(error)) return Promise.reject(error);
  if (!axios.isAxiosError(error)) return Promise.reject(error);
  const status = error.response?.status;
  if (status === 401 && error.config?.url !== '/api/v1/Auth/login') {
    const authorization = error.config?.headers?.Authorization;
    if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) sessionStore.invalidate(authorization.slice(7));
  }
  return Promise.reject(normalizeApiError(status, error.response?.data));
});
