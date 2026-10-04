import axios from "axios";

import { api } from "@/lib/axios";
import type {
  CreateSchoolPeriodRequest,
  SchoolPeriod,
  SchoolPeriodsResponse,
  UpdateSchoolPeriodRequest,
} from "@/types/school-periods";

export async function getSchoolPeriods(): Promise<SchoolPeriodsResponse> {
  const response = await api.get<SchoolPeriodsResponse>("/school-periods");
  return response.data;
}

export async function getSchoolPeriod(id: string): Promise<SchoolPeriod> {
  const response = await api.get<SchoolPeriod>(`/school-periods/${id}`);
  return response.data;
}

export async function createSchoolPeriod(
  data: CreateSchoolPeriodRequest,
): Promise<SchoolPeriod> {
  const response = await api.post<SchoolPeriod>("/school-periods", data);
  return response.data;
}

export async function updateSchoolPeriod(
  id: string,
  data: UpdateSchoolPeriodRequest,
): Promise<SchoolPeriod> {
  const response = await api.patch<SchoolPeriod>(`/school-periods/${id}`, data);
  return response.data;
}

export async function openSchoolPeriod(id: string): Promise<SchoolPeriod> {
  const response = await api.patch<SchoolPeriod>(`/school-periods/${id}/open`);
  return response.data;
}

export async function closeSchoolPeriod(id: string): Promise<SchoolPeriod> {
  const response = await api.patch<SchoolPeriod>(`/school-periods/${id}/close`);
  return response.data;
}

export async function enableSchoolPeriod(id: string): Promise<SchoolPeriod> {
  const response = await api.patch<SchoolPeriod>(
    `/school-periods/${id}/enable`,
  );
  return response.data;
}

export async function disableSchoolPeriod(id: string): Promise<SchoolPeriod> {
  const response = await api.patch<SchoolPeriod>(
    `/school-periods/${id}/disable`,
  );
  return response.data;
}

export function getSchoolPeriodError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === "string") {
      return message;
    }
    if (
      Array.isArray(message) &&
      message.every((item) => typeof item === "string")
    ) {
      return message.join(". ");
    }
    if (error.response?.status === 401) {
      return "Tu sesión no es válida. Inicia sesión nuevamente.";
    }
    if (error.response?.status === 403) {
      return "No tienes permisos para administrar períodos escolares.";
    }
  }

  return "No se pudo completar la operación. Intenta nuevamente.";
}
