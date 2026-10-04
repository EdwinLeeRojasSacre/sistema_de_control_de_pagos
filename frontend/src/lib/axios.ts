import axios from 'axios';
import { redirectAfterForbidden, requireLogin, SESSION_TOKEN_KEY } from '@/lib/session';

const baseURL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
// Axios sets JSON for plain objects and lets the browser add the multipart boundary for FormData.
export const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = sessionStorage.getItem(SESSION_TOKEN_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use((response) => response, (error: unknown) => {
  if (axios.isAxiosError(error) && typeof window !== 'undefined') {
    const status = error.response?.status;
    const code = (error.response?.data as { code?: string } | undefined)?.code;
    if (status === 401 && !error.config?.url?.endsWith('/auth/login')) requireLogin();
    else if (status === 403) redirectAfterForbidden(code);
  }
  return Promise.reject(error);
});
