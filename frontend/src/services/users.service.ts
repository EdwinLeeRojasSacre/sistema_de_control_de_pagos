import { api } from '@/lib/axios';

export interface ManagedUser {
  id: string; username: string; isActive: boolean; mustChangePassword: boolean;
  lastLogin: string | null; createdAt: string;
  person: { id: string; documentType: string; documentNumber: string | null; firstName: string; lastNameFather: string | null; lastNameMother: string | null; birthDate: string | null; gender: string | null; phone: string | null; email: string | null; address: string | null };
  role: { code: string; name: string };
}
export interface NewUserPerson {
  documentType: string; documentNumber: string; firstName: string;
  lastNameFather?: string; lastNameMother?: string; birthDate?: string;
  gender?: string; phone?: string; email?: string; address?: string;
}
export interface PersonLookupResult {
  found: boolean;
  person: null | (NewUserPerson & { id: string; isActive: boolean; hasUser: boolean; user: { id: string; username: string; is_active: boolean } | null });
}
export interface UserOptions {
  persons: Array<{ id: string; first_name: string; last_name_father: string | null; last_name_mother: string | null; document_type: string; document_number: string | null }>;
  roles: Array<{ code: 'SECRETARIA' | 'DIRECCION'; name: string }>;
}

export interface MyProfile {
  username: string;
  role: { code: string; name: string };
  person: {
    firstName: string; lastNameFather: string | null; lastNameMother: string | null;
    documentType: string; documentNumber: string | null; gender: string | null;
    phone: string | null; email: string | null;
  };
}

export type UpdateMyProfile = Partial<Pick<MyProfile['person'],
  'documentType' | 'documentNumber' | 'firstName' | 'lastNameFather' | 'lastNameMother' | 'gender' | 'phone' | 'email'
>>;

export async function listUsers() { return (await api.get<ManagedUser[]>('/users')).data; }
export async function getUserOptions() { return (await api.get<UserOptions>('/users/options')).data; }
export async function lookupPerson(documentType: string, documentNumber: string) { return (await api.get<PersonLookupResult>('/users/person-lookup', { params: { documentType, documentNumber } })).data; }
export async function createUser(data: { personId?: string; person?: NewUserPerson; role: string; username: string; isActive?: boolean }) { return (await api.post<{ user: ManagedUser; temporaryPassword: string }>('/users', data)).data; }
export async function updateUser(id: string, data: { username?: string; person?: Partial<NewUserPerson> }) { return (await api.patch<ManagedUser>(`/users/${id}`, data)).data; }
export async function setUserStatus(id: string, isActive: boolean) { return (await api.patch<ManagedUser>(`/users/${id}/status`, { isActive })).data; }
export async function resetUserPassword(id: string) { return (await api.post<{ temporaryPassword: string }>(`/users/${id}/reset-password`)).data; }
export async function getMyProfile() { return (await api.get<MyProfile>('/users/me')).data; }
export async function updateMyProfile(data: UpdateMyProfile) { return (await api.patch<MyProfile>('/users/me', data)).data; }
