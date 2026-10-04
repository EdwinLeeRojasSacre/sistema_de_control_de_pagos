import { api } from '@/lib/axios';

export interface PublicSupport {
  institution: string;
  administratorName: string | null;
  administratorEmail: string | null;
  administratorPhone: string | null;
  version: string;
}

export async function getPublicSupport() {
  return (await api.get<PublicSupport>('/support/public')).data;
}
