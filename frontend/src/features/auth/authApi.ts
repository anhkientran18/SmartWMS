import { httpClient, normalizeApiError } from '../../services/api/httpClient';
import { Result } from '../../services/api/apiTypes';
import { Session, sessionStore, validSession } from './session';

export interface LoginRequest { username: string; password: string }
export async function login(credentials: LoginRequest): Promise<Session> {
  const response = await httpClient.post<Result<Session>>('/api/v1/Auth/login', credentials);
  if (response.data?.isSuccess !== true || !validSession(response.data.data)) throw normalizeApiError(502);
  const { token, username, role, fullName } = response.data.data;
  const session = { token, username, role, fullName };
  sessionStore.set(session);
  return session;
}
export async function logout(): Promise<void> {
  const session = sessionStore.get();
  // Capture the canonical token before clearing UI/cache immediately, even offline.
  sessionStore.set(null, 'logout');
  if (session) await httpClient.post('/api/v1/Auth/logout', { token: session.token }, {
    headers: { Authorization: `Bearer ${session.token}` },
  });
}
