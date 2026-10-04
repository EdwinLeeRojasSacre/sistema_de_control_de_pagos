'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useRef, useState } from 'react';

import { getEnrollmentOptions, getEnrollments } from '@/services/enrollments.service';
import type { Enrollment, EnrollmentOptions } from '@/types/enrollments';
import { getSchoolPeriodStatusLabel } from '@/lib/school-period-status';

function getInitialSchoolPeriodId(
  periods: EnrollmentOptions['schoolPeriods'],
  currentYear = new Date().getFullYear(),
) {
  const currentPeriod = periods.find((period) => period.year === currentYear);
  if (currentPeriod) return currentPeriod.id;

  const closestOpenPeriod = periods
    .filter((period) => period.status === 'OPEN')
    .reduce<(typeof periods)[number] | undefined>((closest, period) => {
      if (!closest) return period;
      return Math.abs(period.year - currentYear) < Math.abs(closest.year - currentYear)
        ? period
        : closest;
    }, undefined);

  return closestOpenPeriod?.id ?? periods[0]?.id ?? '';
}

export default function EnrollmentsPage() {
  const [rows, setRows] = useState<Enrollment[]>([]);
  const [options, setOptions] = useState<EnrollmentOptions | null>(null);
  const [periodId, setPeriodId] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestIdRef = useRef(0);

  async function load(selectedPeriod = periodId, term = search) {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError('');
    setRows([]);
    try {
      const data = await getEnrollments({
        schoolPeriodId: selectedPeriod || undefined,
        search: term.trim() || undefined,
      });
      if (requestId === requestIdRef.current) {
        setRows(data);
      }
    } catch {
      if (requestId === requestIdRef.current) {
        setError('No se pudieron cargar las matrículas. Intente nuevamente.');
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    let active = true;
    getEnrollmentOptions()
      .then(async (data) => {
        if (!active) return;
        setOptions(data);
        const initial = getInitialSchoolPeriodId(data.schoolPeriods);
        setPeriodId(initial);
        await load(initial, '');
      })
      .catch(() => {
        if (active) {
          setError('No se pudieron cargar las opciones académicas.');
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
    // La carga inicial fija explícitamente sus filtros.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    void load();
  }

  function handlePeriodChange(selectedPeriod: string) {
    setPeriodId(selectedPeriod);
    void load(selectedPeriod, search);
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-red-800">Gestión académica</p>
          <h1 className="text-3xl font-bold text-slate-900">Matrículas</h1>
          <p className="mt-1 text-sm text-slate-600">Consulta asignaciones vigentes e historial por período.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-lg bg-red-800 px-4 py-2 font-semibold text-white hover:bg-red-900" href="/dashboard/enrollments/new">
            Nueva matrícula
          </Link>
          <Link className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 font-semibold text-red-800 hover:bg-red-100" href="/dashboard/enrollments/import">
            Importar matrículas
          </Link>
        </div>
      </div>

      <form onSubmit={submit} className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[220px_1fr_auto]">
        <label className="text-sm font-medium text-slate-700">
          Período escolar
          <select className="mt-1 w-full rounded-lg border border-slate-300 p-2" value={periodId} onChange={(event) => handlePeriodChange(event.target.value)}>
            <option value="">Todos los períodos</option>
            {options?.schoolPeriods.map((period) => (
              <option key={period.id} value={period.id}>{period.year} · {getSchoolPeriodStatusLabel(period.status)}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Estudiante
          <input className="mt-1 w-full rounded-lg border border-slate-300 p-2" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, documento o código" />
        </label>
        <button className="self-end rounded-lg border border-slate-300 px-5 py-2 font-semibold text-slate-700 hover:bg-slate-50" type="submit">Buscar</button>
      </form>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              {['Estudiante', 'Documento', 'Período', 'Ciclo / nivel', 'Aula', 'Turno', 'Fecha', 'Estado', ''].map((label) => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!loading && rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-4 py-3"><p className="font-semibold text-slate-900">{row.student.fullName}</p><p className="text-xs text-slate-500">{row.student.code ?? 'Sin código'}</p></td>
                <td className="px-4 py-3">{row.student.documentNumber ?? '—'}</td>
                <td className="px-4 py-3">{row.schoolPeriod.year}</td>
                <td className="px-4 py-3">{row.classroom.educationLevel.cycle.name} / {row.classroom.educationLevel.name}</td>
                <td className="px-4 py-3">{row.classroom.name}</td>
                <td className="px-4 py-3">{row.classroom.shift.name}</td>
                <td className="px-4 py-3">{new Date(row.enrollmentDate).toLocaleDateString('es-PE')}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.isHistorical ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>{row.isHistorical ? 'Histórica' : 'Activa'}</span></td>
                <td className="px-4 py-3"><Link className="font-semibold text-red-800 hover:underline" href={`/dashboard/enrollments/${row.id}`}>Ver detalle</Link></td>
              </tr>
            ))}
            {loading && <tr><td className="px-4 py-10 text-center text-slate-500" colSpan={9}>Cargando matrículas…</td></tr>}
            {!loading && rows.length === 0 && <tr><td className="px-4 py-10 text-center text-slate-500" colSpan={9}>No hay matrículas para los filtros seleccionados.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
