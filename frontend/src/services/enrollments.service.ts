import { api } from '@/lib/axios';
import type { Enrollment, EnrollmentOptions } from '@/types/enrollments';

export function getEnrollmentErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const message = (error as { response?: { data?: { message?: string | string[] } } })
      .response?.data?.message;
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string') return message;
  }
  return fallback;
}

export async function getEnrollments(params?: {
  schoolPeriodId?: string;
  search?: string;
  status?: string;
}): Promise<Enrollment[]> {
  const response = await api.get('/enrollments', { params });
  return response.data;
}

export async function getEnrollment(id: string): Promise<Enrollment> {
  const response = await api.get(`/enrollments/${id}`);
  return response.data;
}

export async function getStudentEnrollments(studentId: string): Promise<Enrollment[]> {
  const response = await api.get(`/enrollments/students/${studentId}`);
  return response.data;
}

export async function getEnrollmentOptions(schoolPeriodId?: string): Promise<EnrollmentOptions> {
  const response = await api.get('/enrollments/options', {
    params: schoolPeriodId ? { schoolPeriodId } : undefined,
  });
  return response.data;
}

export async function createEnrollment(data: {
  studentId: string;
  schoolPeriodId: string;
  classroomId: string;
}): Promise<Enrollment> {
  const response = await api.post('/enrollments', data);
  return response.data;
}

export async function changeEnrollmentClassroom(
  id: string,
  classroomId: string,
): Promise<Enrollment> {
  const response = await api.patch(`/enrollments/${id}/classroom`, { classroomId });
  return response.data;
}
