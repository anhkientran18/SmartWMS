import { isDemoMode } from '../../app/dataMode';

export type Role = 'Admin' | 'WarehouseManager' | 'Staff';
export interface Session {
  token: string;
  username: string;
  role: Role;
  fullName?: string;
}
export const SESSION_KEY = isDemoMode ? 'smartwms.demo-session' : 'smartwms.session';
export const isRole = (value: unknown): value is Role =>
  value === 'Admin' || value === 'WarehouseManager' || value === 'Staff';

// exp is a UX expiry hint only; backend signature/authorization remain authoritative.
export function expiresAt(token: string): number {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { exp } = JSON.parse(atob(part));
    return typeof exp === 'number' && Number.isFinite(exp) ? exp * 1000 : 0;
  } catch { return 0; }
}
export function validSession(value: unknown): value is Session {
  if (!value || typeof value !== 'object') return false;
  const s = value as Session;
  return typeof s.username === 'string' && !!s.username.trim() && isRole(s.role)
    && typeof s.token === 'string' && (isDemoMode || expiresAt(s.token) > Date.now())
    && (s.fullName === undefined || typeof s.fullName === 'string');
}
function readSession(): Session | null {
  try {
    const value = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null');
    return validSession(value) ? value : null;
  } catch { return null; }
}
let current = readSession();
let reason: 'expired' | 'logout' | null = null;
const listeners = new Set<() => void>();
// Legacy auth never grants access, including after migration/reload.
try {
  for (const key of ['token', 'access_token', 'smartwms_token', 'smartwms_is_logged_in', 'smartwms_logged_in_user', 'smartwms_user_role']) localStorage.removeItem(key);
  if (!current) localStorage.removeItem(SESSION_KEY);
} catch { /* In-memory sessions remain usable when storage is unavailable. */ }
export const sessionStore = {
  get: () => current,
  getReason: () => reason,
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  set(value: Session | null, nextReason: typeof reason = null) {
    current = value;
    reason = nextReason;
    try {
      if (value) localStorage.setItem(SESSION_KEY, JSON.stringify(value));
      else localStorage.removeItem(SESSION_KEY);
    } catch { /* Use memory for this tab if persistence is unavailable. */ }
    listeners.forEach(listener => listener());
  },
  invalidate(token?: string) {
    // A late 401 from a previous session must not log out a new user.
    if (current && (!token || token === current.token)) sessionStore.set(null, 'expired');
  },
};
if (typeof window !== 'undefined') window.addEventListener('storage', event => {
  if (event.key === SESSION_KEY || event.key === null) {
    const next = readSession();
    if (JSON.stringify(next) !== JSON.stringify(current)) {
      current = next;
      reason = next ? null : 'logout';
      listeners.forEach(listener => listener());
    }
  }
});
