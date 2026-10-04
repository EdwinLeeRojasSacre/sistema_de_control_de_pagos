interface SessionUser { role: string }
interface SessionResponse { access_token: string; user: SessionUser }

export const SESSION_ACTIVITY_KEY = 'lastActivityAt';
export const SESSION_TOKEN_KEY = 'token';
export const SESSION_USER_KEY = 'user';
export const SESSION_CLEARED_EVENT = 'sgpe:session-cleared';

let redirectingToLogin = false;

export function saveBrowserSession(response: SessionResponse) {
  sessionStorage.setItem(SESSION_TOKEN_KEY, response.access_token);
  sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(response.user));
  sessionStorage.setItem(SESSION_ACTIVITY_KEY, String(Date.now()));
  redirectingToLogin = false;
}

export function clearBrowserSession() {
  const hadSession = Boolean(
    sessionStorage.getItem(SESSION_TOKEN_KEY) ||
    sessionStorage.getItem(SESSION_USER_KEY) ||
    sessionStorage.getItem(SESSION_ACTIVITY_KEY),
  );
  sessionStorage.removeItem(SESSION_TOKEN_KEY);
  sessionStorage.removeItem(SESSION_USER_KEY);
  sessionStorage.removeItem(SESSION_ACTIVITY_KEY);
  if (hadSession) window.dispatchEvent(new Event(SESSION_CLEARED_EVENT));
}

export function requireLogin() {
  if (typeof window === 'undefined') return;
  const isLogin = window.location.pathname === '/login';
  const shouldRedirect = !isLogin && !redirectingToLogin;
  if (shouldRedirect) redirectingToLogin = true;
  clearBrowserSession();
  if (shouldRedirect) window.location.replace('/login');
}

export function getStoredUser(): SessionUser | null {
  const value = sessionStorage.getItem(SESSION_USER_KEY);
  if (!value) return null;
  try { return JSON.parse(value) as SessionUser; }
  catch { return null; }
}

export function redirectAfterForbidden(code?: string) {
  if (typeof window === 'undefined') return;
  const target = code === 'PASSWORD_CHANGE_REQUIRED'
    ? '/dashboard/account/change-password'
    : getStoredUser()?.role === 'DIRECCION'
      ? '/dashboard/reports'
      : '/dashboard';
  if (window.location.pathname !== target) window.location.replace(target);
}
