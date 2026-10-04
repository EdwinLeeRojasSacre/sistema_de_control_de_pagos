'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import {
  changeEnrollmentClassroom,
  getEnrollment,
  getEnrollmentOptions,
  getEnrollmentErrorMessage,
  getStudentEnrollments,
} from '@/services/enrollments.service';
import type { Enrollment, EnrollmentOptions } from '@/types/enrollments';
import { getSchoolPeriodStatusLabel } from '@/lib/school-period-status';

export default function EnrollmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [history, setHistory] = useState<Enrollment[]>([]);
  const [options, setOptions] = useState<EnrollmentOptions | null>(null);
  const [classroomId, setClassroomId] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const detail = await getEnrollment(id);
      setEnrollment(detail);
      setClassroomId(detail.classroom.id);
      const [studentHistory, optionRows] = await Promise.all([
        getStudentEnrollments(detail.student.id),
        getEnrollmentOptions(detail.schoolPeriod.id),
      ]);
      setHistory(studentHistory);
      setOptions(optionRows);
    } catch {
      setError('No se pudo cargar la matrícula.');
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function saveClassroom() {
    if (!enrollment || classroomId === enrollment.classroom.id) return;
    setSaving(true);
    setError('');
    try {
      await changeEnrollmentClassroom(enrollment.id, classroomId);
      await load();
    } catch (requestError) {
      setError(getEnrollmentErrorMessage(requestError, 'No se pudo cambiar el aula.'));
    } finally {
      setSaving(false);
    }
  }

  if (!enrollment && !error) return <p className="text-slate-500">Cargando matrícula…</p>;

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link className="text-sm font-semibold text-red-800 hover:underline" href="/dashboard/enrollments">← Volver a matrículas</Link>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Detalle de matrícula</h1>
      </div>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
      {enrollment && (
        <>
          <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-3">
            <Info label="Estudiante" value={enrollment.student.fullName} />
            <Info label="Documento" value={enrollment.student.documentNumber ?? '—'} />
            <Info label="Código" value={enrollment.student.code ?? 'Sin código'} />
            <Info label="Período" value={`${enrollment.schoolPeriod.year} · ${getSchoolPeriodStatusLabel(enrollment.schoolPeriod.status)}`} />
            <Info label="Ciclo / nivel" value={`${enrollment.classroom.educationLevel.cycle.name} / ${enrollment.classroom.educationLevel.name}`} />
            <Info label="Fecha de matrícula" value={new Date(enrollment.enrollmentDate).toLocaleDateString('es-PE')} />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Asignación de aula</h2>
            <p className="mt-1 text-sm text-slate-600">El cambio conserva al estudiante y el período de esta matrícula.</p>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="min-w-72 flex-1 text-sm font-medium text-slate-700">Aula, nivel y turno
                <select className="mt-1 w-full rounded-lg border border-slate-300 p-2" disabled={!enrollment.canChangeClassroom} value={classroomId} onChange={(event) => setClassroomId(event.target.value)}>
                  {options?.classrooms.map((room) => <option key={room.id} value={room.id}>{room.educationLevel.name} · {room.name} · {room.shift.name}</option>)}
                </select>
              </label>
              {enrollment.canChangeClassroom ? (
                <button className="rounded-lg bg-red-800 px-4 py-2 font-semibold text-white hover:bg-red-900 disabled:opacity-50" disabled={saving || classroomId === enrollment.classroom.id} onClick={() => void saveClassroom()} type="button">{saving ? 'Guardando…' : 'Cambiar aula'}</button>
              ) : (
                <span className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">Período histórico: solo lectura</span>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <h2 className="border-b border-slate-200 px-6 py-4 text-lg font-semibold">Historial del estudiante</h2>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50"><tr><th className="px-4 py-3">Período</th><th className="px-4 py-3">Nivel</th><th className="px-4 py-3">Aula</th><th className="px-4 py-3">Turno</th><th className="px-4 py-3">Estado</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((item) => <tr key={item.id}><td className="px-4 py-3">{item.schoolPeriod.year}</td><td className="px-4 py-3">{item.classroom.educationLevel.name}</td><td className="px-4 py-3">{item.classroom.name}</td><td className="px-4 py-3">{item.classroom.shift.name}</td><td className="px-4 py-3">{item.isHistorical ? 'Histórica' : 'Activa'}</td></tr>)}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 font-medium text-slate-900">{value}</p></div>;
}
