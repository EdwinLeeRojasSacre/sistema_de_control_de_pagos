'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { createEnrollment, getEnrollmentErrorMessage, getEnrollmentOptions } from '@/services/enrollments.service';
import { getStudents } from '@/services/students.service';
import type { EnrollmentOptions, StudentListItem } from '@/types/enrollments';

export default function NewEnrollmentPage() {
  const router = useRouter();
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [options, setOptions] = useState<EnrollmentOptions | null>(null);
  const [studentId, setStudentId] = useState('');
  const [periodId, setPeriodId] = useState('');
  const [levelId, setLevelId] = useState('');
  const [classroomId, setClassroomId] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const requestedStudentId = new URLSearchParams(window.location.search).get('studentId');
    Promise.all([getStudents(), getEnrollmentOptions()])
      .then(([studentRows, optionRows]) => {
        setStudents((studentRows as StudentListItem[]).filter((student) => student.isActive));
        if (requestedStudentId) setStudentId(requestedStudentId);
        setOptions(optionRows);
        setPeriodId(optionRows.schoolPeriods.find((period) => period.status === 'OPEN')?.id ?? '');
      })
      .catch(() => setError('No se pudieron cargar los datos necesarios.'));
  }, []);

  const availableRooms = useMemo(
    () => options?.classrooms.filter((room) => room.schoolPeriodId === periodId) ?? [],
    [options, periodId],
  );
  const levels = useMemo(
    () => Array.from(new Map(availableRooms.map((room) => [room.educationLevel.id, room.educationLevel])).values()),
    [availableRooms],
  );
  const roomsForLevel = availableRooms.filter((room) => room.educationLevel.id === levelId);
  const visibleStudents = students.filter((student) =>
    `${student.fullName} ${student.documentNumber ?? ''} ${student.studentCode ?? ''}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!studentId || !periodId || !classroomId) {
      setError('Seleccione estudiante, período, nivel y aula.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const enrollment = await createEnrollment({ studentId, schoolPeriodId: periodId, classroomId });
      router.push(`/dashboard/enrollments/${enrollment.id}`);
    } catch (requestError) {
      setError(getEnrollmentErrorMessage(requestError, 'No se pudo registrar la matrícula.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link className="text-sm font-semibold text-red-800 hover:underline" href="/dashboard/enrollments">← Volver a matrículas</Link>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Nueva matrícula</h1>
        <p className="mt-1 text-slate-600">Matricula a un estudiante ya registrado y vinculado a una familia activa.</p>
      </div>
      <form onSubmit={submit} className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
        <fieldset className="space-y-3">
          <legend className="text-lg font-semibold text-slate-900">1. Estudiante existente</legend>
          <input className="w-full rounded-lg border border-slate-300 p-2" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filtrar por nombre, documento o código" />
          <select className="w-full rounded-lg border border-slate-300 p-2" value={studentId} onChange={(event) => setStudentId(event.target.value)} required>
            <option value="">Seleccione un estudiante</option>
            {visibleStudents.map((student) => <option key={student.id} value={student.id}>{student.fullName} · {student.documentNumber ?? student.studentCode ?? 'Sin documento'}</option>)}
          </select>
        </fieldset>
        <fieldset className="grid gap-4 md:grid-cols-3">
          <legend className="col-span-full text-lg font-semibold text-slate-900">2. Asignación académica</legend>
          <label className="text-sm font-medium text-slate-700">Período abierto
            <select className="mt-1 w-full rounded-lg border border-slate-300 p-2" value={periodId} onChange={(event) => { setPeriodId(event.target.value); setLevelId(''); setClassroomId(''); }} required>
              <option value="">Seleccione</option>
              {options?.schoolPeriods.filter((period) => period.status === 'OPEN').map((period) => <option key={period.id} value={period.id}>{period.year}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">Nivel / grado
            <select className="mt-1 w-full rounded-lg border border-slate-300 p-2" value={levelId} onChange={(event) => { setLevelId(event.target.value); setClassroomId(''); }} required>
              <option value="">Seleccione</option>
              {levels.map((level) => <option key={level.id} value={level.id}>{level.cycle.name} · {level.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">Aula y turno
            <select className="mt-1 w-full rounded-lg border border-slate-300 p-2" value={classroomId} onChange={(event) => setClassroomId(event.target.value)} required>
              <option value="">Seleccione</option>
              {roomsForLevel.map((room) => <option key={room.id} value={room.id}>{room.name} · {room.shift.name}</option>)}
            </select>
          </label>
        </fieldset>
        {!periodId && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">No existe un período escolar abierto. Abra uno desde Administración para matricular.</p>}
        <div className="flex justify-end gap-3">
          <Link className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700" href="/dashboard/enrollments">Cancelar</Link>
          <button className="rounded-lg bg-red-800 px-4 py-2 font-semibold text-white hover:bg-red-900 disabled:opacity-50" disabled={saving || !periodId} type="submit">{saving ? 'Guardando…' : 'Registrar matrícula'}</button>
        </div>
      </form>
    </section>
  );
}
