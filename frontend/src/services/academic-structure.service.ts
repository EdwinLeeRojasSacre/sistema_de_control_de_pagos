import axios from "axios";

import { api } from "@/lib/axios";
import type {
  AcademicClassroom,
  AcademicStructure,
  AcademicStructureOptions,
  CreateClassroomRequest,
} from "@/types/academic-structure";

export async function getAcademicStructureOptions() {
  const response = await api.get<AcademicStructureOptions>(
    "/academic-structure/options",
  );
  return response.data;
}

export async function getAcademicStructure(schoolPeriodId: string) {
  const response = await api.get<AcademicStructure>("/academic-structure", {
    params: { schoolPeriodId },
  });
  return response.data;
}

export async function createClassroom(data: CreateClassroomRequest) {
  const response = await api.post<AcademicClassroom>(
    "/academic-structure/classrooms",
    data,
  );
  return response.data;
}

export async function enableClassroom(id: string) {
  const response = await api.patch<AcademicClassroom>(
    `/academic-structure/classrooms/${id}/enable`,
  );
  return response.data;
}

export async function disableClassroom(id: string) {
  const response = await api.patch<AcademicClassroom>(
    `/academic-structure/classrooms/${id}/disable`,
  );
  return response.data;
}

export function getAcademicStructureError(error: unknown) {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === "string") return message;
    if (
      Array.isArray(message) &&
      message.every((item) => typeof item === "string")
    ) {
      return message.join(". ");
    }
    if (error.response?.status === 403) {
      return "No tienes permisos para administrar la estructura académica.";
    }
  }
  return "No se pudo completar la operación. Intenta nuevamente.";
}
