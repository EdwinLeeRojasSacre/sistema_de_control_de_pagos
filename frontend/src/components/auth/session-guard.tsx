'use client';

import axios from 'axios';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { getProfile, type AuthenticatedUser } from '@/services/auth.service';
import { requireLogin, SESSION_ACTIVITY_KEY, SESSION_CLEARED_EVENT, SESSION_TOKEN_KEY, SESSION_USER_KEY } from '@/lib/session';

const INACTIVITY_MS = 30 * 60 * 1000;
const ACTIVITY_WRITE_INTERVAL_MS = 10_000;

export function SessionGuard({ children, onAuthenticated }: {
  children: ReactNode;
  onAuthenticated?: (profile: AuthenticatedUser) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState<'checking' | 'allowed' | 'unavailable'>('checking');

  const validateSession = useCallback(async () => {
    // El layout ya autenticado debe permanecer visible durante la validación
    // de una nueva ruta interna; ocultarlo producía el parpadeo del sidebar.
    setState((current) => current === 'allowed' ? 'allowed' : 'checking');
    const token = sessionStorage.getItem(SESSION_TOKEN_KEY);
    const lastActivity = Number(sessionStorage.getItem(SESSION_ACTIVITY_KEY) ?? 0);
    if (!token || !lastActivity || Date.now() - lastActivity >= INACTIVITY_MS) {
      requireLogin();
      return;
    }
    try {
      const profile = await getProfile();
      sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(profile));
      onAuthenticated?.(profile);
      const changePasswordPath = '/dashboard/account/change-password';
      if (profile.mustChangePassword && pathname !== changePasswordPath) {
        setState('checking');
        router.replace(changePasswordPath);
        return;
      }
      const directionSafePath = pathname.startsWith('/dashboard/reports') || pathname === '/dashboard/about';
      if (!profile.mustChangePassword && profile.role === 'DIRECCION' && !directionSafePath && pathname !== changePasswordPath) {
        setState('checking');
        router.replace('/dashboard/reports');
        return;
      }
      setState('allowed');
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) requireLogin();
      else setState('unavailable');
    }
  }, [onAuthenticated, pathname, router]);

  useEffect(() => { void validateSession(); }, [validateSession]);

  useEffect(() => {
    let lastWrite = 0;
    const verifySession = () => {
      const token = sessionStorage.getItem(SESSION_TOKEN_KEY);
      const timestamp = Number(sessionStorage.getItem(SESSION_ACTIVITY_KEY) ?? 0);
      if (!token || !timestamp || Date.now() - timestamp >= INACTIVITY_MS) requireLogin();
    };
    const recordActivity = () => {
      verifySession();
      const now = Date.now();
      if (sessionStorage.getItem(SESSION_TOKEN_KEY) && now - lastWrite >= ACTIVITY_WRITE_INTERVAL_MS) {
        sessionStorage.setItem(SESSION_ACTIVITY_KEY, String(now));
        lastWrite = now;
      }
    };
    const handleVisibility = () => { if (document.visibilityState === 'visible') verifySession(); };
    const activityEvents: Array<keyof WindowEventMap> = ['pointerdown', 'pointermove', 'keydown', 'click', 'touchstart'];
    activityEvents.forEach((event) => window.addEventListener(event, recordActivity, { passive: true }));
    window.addEventListener('focus', verifySession);
    window.addEventListener(SESSION_CLEARED_EVENT, verifySession);
    document.addEventListener('visibilitychange', handleVisibility);
    const interval = window.setInterval(verifySession, 15_000);
    return () => {
      activityEvents.forEach((event) => window.removeEventListener(event, recordActivity));
      window.removeEventListener('focus', verifySession);
      window.removeEventListener(SESSION_CLEARED_EVENT, verifySession);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.clearInterval(interval);
    };
  }, []);

  if (state === 'unavailable') {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6"><div className="rounded-xl border bg-white p-6 text-center shadow-sm"><p className="font-semibold text-slate-900">No se pudo validar la sesión</p><p className="mt-2 text-sm text-slate-600">Verifique la conexión e inténtelo nuevamente.</p><button type="button" onClick={() => void validateSession()} className="mt-4 rounded-lg bg-red-800 px-4 py-2 text-sm font-medium text-white">Reintentar</button></div></div>;
  }
  return state === 'allowed' ? children : <div className="min-h-screen bg-slate-50" aria-label="Validando sesión" />;
}
