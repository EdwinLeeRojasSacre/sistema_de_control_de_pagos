'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import {
  getStudents,
} from '@/services/students.service';

interface Student {
  id: string;
  studentCode: string;
  documentNumber: string;
  fullName: string;
  birthDate: string;
  isActive: boolean;
}

export default function StudentsPage() {
  const [students, setStudents] =
    useState<Student[]>([]);

  useEffect(() => {
    async function loadStudents() {
      try {
        const data =
          await getStudents();

        setStudents(data);
      } catch (error) {
        console.error(error);
      }
    }

    loadStudents();
  }, []);

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">
          Estudiantes
        </h1>

        <Link href="/dashboard/students/new">
          Nuevo Estudiante
        </Link>
      </div>

      <table className="w-full border">
        <thead>
          <tr className="bg-slate-100">
            <th className="border p-2">
              Código
            </th>

            <th className="border p-2">
              Documento
            </th>

            <th className="border p-2">
              Nombre
            </th>

            <th className="border p-2">
              Estado
            </th>
          </tr>
        </thead>

        <tbody>
          {students.map(
            (student) => (
              <tr key={student.id}>
                <td className="border p-2">
                  {student.studentCode}
                </td>

                <td className="border p-2">
                  {student.documentNumber}
                </td>

                <td className="border p-2">
                  {student.fullName}
                </td>

                <td className="border p-2">
                  {student.isActive
                    ? 'Activo'
                    : 'Inactivo'}
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </>
  );
}