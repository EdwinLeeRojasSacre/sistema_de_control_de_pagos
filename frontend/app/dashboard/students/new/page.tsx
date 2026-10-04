'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { createStudent } from '@/services/students.service';

export default function NewStudentPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    documentType: 'DNI',
    documentNumber: '',
    firstName: '',
    lastNameFather: '',
    lastNameMother: '',
    birthDate: '',
  });

  async function handleSubmit(
    event: React.FormEvent,
  ) {
    event.preventDefault();

    try {
      await createStudent(form);

      router.push('/dashboard/students');
    } catch (error) {
      console.error(error);
      alert('Error al registrar estudiante');
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold">
        Nuevo Estudiante
      </h1>

      <form
        onSubmit={handleSubmit}
        className="max-w-xl space-y-4"
      >
        <input
          className="w-full border p-2"
          placeholder="Número de documento"
          value={form.documentNumber}
          onChange={(e) =>
            setForm({
              ...form,
              documentNumber: e.target.value,
            })
          }
        />

        <input
          className="w-full border p-2"
          placeholder="Nombres"
          value={form.firstName}
          onChange={(e) =>
            setForm({
              ...form,
              firstName: e.target.value,
            })
          }
        />

        <input
          className="w-full border p-2"
          placeholder="Apellido paterno"
          value={form.lastNameFather}
          onChange={(e) =>
            setForm({
              ...form,
              lastNameFather: e.target.value,
            })
          }
        />

        <input
          className="w-full border p-2"
          placeholder="Apellido materno"
          value={form.lastNameMother}
          onChange={(e) =>
            setForm({
              ...form,
              lastNameMother: e.target.value,
            })
          }
        />

        <input
          type="date"
          className="w-full border p-2"
          value={form.birthDate}
          onChange={(e) =>
            setForm({
              ...form,
              birthDate: e.target.value,
            })
          }
        />

        <button
          type="submit"
          className="rounded bg-green-600 px-4 py-2 text-white"
        >
          Guardar
        </button>
      </form>
    </div>
  );
}