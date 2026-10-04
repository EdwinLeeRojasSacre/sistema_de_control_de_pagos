import { api } from '@/lib/axios';

import type {
  AddFamilyStudentRequest,
  CreateFamilyGroupRequest,
  FamilyGroupCreateOptions,
  UpdateFamilyGroupRequest,
} from '@/types/family-groups';

export interface PersonLookupFamily {
  familyGroupId: string;
  code: string | null;
  name: string;
  relationshipType: string;
  isGuardian: boolean;
  isActive: boolean;
}

export interface PersonLookupPerson {
  id: string;
  documentType: string;
  documentNumber: string | null;
  firstName: string;
  lastNameFather: string | null;
  lastNameMother: string | null;
  birthDate: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
}

export interface PersonLookupResponse {
  exists: boolean;
  person: PersonLookupPerson | null;
  families: PersonLookupFamily[];
  student: {
    id: string;
    isActive: boolean;
  } | null;
}

export interface FamilyGroupPrimaryMember {
  personId: string;
  fullName: string;
  documentType: string;
  documentNumber: string | null;
  relationship: string;
  isGuardian: boolean;
}

export interface FamilyGroup {
  id: string;
  code: string | null;
  name: string;
  observations?: string | null;
  membersCount: number;
  isActive: boolean;
  primaryMembers: FamilyGroupPrimaryMember[];
}

export interface FamilyGroupMember {
  id: string;
  personId: string;
  fullName: string;
  documentType: string;
  documentNumber: string | null;
  relationship: string;
  isGuardian: boolean;
}

export interface FamilyGroupDetail {
  id: string;
  code: string | null;
  name: string;
  observations: string | null;
  createdAt?: string;
  isActive: boolean;
  members: FamilyGroupMember[];
}

export type FamilyGroupStatus =
  | 'ALL'
  | 'ACTIVE'
  | 'INACTIVE';

export interface GetFamilyGroupsParams {
  search?: string;
  status?: FamilyGroupStatus;
  page?: number;
  limit?: number;
}

export interface FamilyGroupsPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface FamilyGroupsResponse {
  data: FamilyGroup[];
  pagination: FamilyGroupsPagination;
}

export async function getFamilyGroups(
  params?: GetFamilyGroupsParams,
): Promise<FamilyGroupsResponse> {
  const response =
    await api.get<FamilyGroupsResponse>(
      '/family-groups',
      {
        params,
      },
    );

  return response.data;
}

export async function getFamilyGroupById(
  id: string,
): Promise<FamilyGroupDetail> {
  const response =
    await api.get<FamilyGroupDetail>(
      `/family-groups/${id}`,
    );

  return response.data;
}

export async function getFamilyGroupCreateOptions(): Promise<
  FamilyGroupCreateOptions
> {
  const response =
    await api.get<FamilyGroupCreateOptions>(
      '/family-groups/create-options',
    );

  return response.data;
}

export async function createFamilyGroup(
  data: CreateFamilyGroupRequest,
): Promise<FamilyGroupDetail> {
  const response =
    await api.post<FamilyGroupDetail>(
      '/family-groups',
      data,
    );

  return response.data;
}

export async function updateFamilyGroup(
  id: string,
  data: UpdateFamilyGroupRequest,
): Promise<FamilyGroupDetail> {
  const response =
    await api.patch<FamilyGroupDetail>(
      `/family-groups/${id}`,
      data,
    );

  return response.data;
}

export async function lookupPersonByDocument(
  documentType: string,
  documentNumber: string,
): Promise<PersonLookupResponse> {
  const response =
    await api.get<PersonLookupResponse>(
      '/family-groups/person-lookup',
      {
        params: {
          documentType,
          documentNumber,
        },
      },
    );

  return response.data;
}

export async function addStudentToFamilyGroup(
  id: string,
  data: AddFamilyStudentRequest,
): Promise<FamilyGroupDetail> {
  const response =
    await api.post<FamilyGroupDetail>(
      `/family-groups/${id}/students`,
      data,
    );

  return response.data;
}