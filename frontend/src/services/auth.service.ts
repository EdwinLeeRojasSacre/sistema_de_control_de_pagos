import { api } from '@/lib/axios';
import { clearBrowserSession, saveBrowserSession } from '@/lib/session';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  user: AuthenticatedUser;
}

export interface AuthenticatedUser {
  sub?: string;
  id?: string;
  username: string;
  role: string;
  name?: string;
  mustChangePassword: boolean;
}

export async function login(
  data: LoginRequest,
): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>(
    '/auth/login',
    data,
  );

  return response.data;
}

export async function getProfile(): Promise<AuthenticatedUser> {
  const response = await api.get<AuthenticatedUser>('/auth/profile');
  return response.data;
}

export async function changePassword(data: { currentPassword: string; newPassword: string }) {
  const response = await api.post<{ changedAt: string }>('/auth/change-password', data);
  return response.data;
}

export function saveSession(response: LoginResponse) {
  saveBrowserSession(response);
}

export function clearSession() { clearBrowserSession(); }
