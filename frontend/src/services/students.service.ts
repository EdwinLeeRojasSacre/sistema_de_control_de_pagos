import { api } from '@/lib/axios';

export async function getStudents() {
  const response = await api.get(
    '/students',
  );

  return response.data;
}

export async function createStudent(data: {
  documentType: string;
  documentNumber: string;
  firstName: string;
  lastNameFather: string;
  lastNameMother: string;
  birthDate: string;
}) {
  const response = await api.post(
    '/students',
    data,
  );

  return response.data;
}