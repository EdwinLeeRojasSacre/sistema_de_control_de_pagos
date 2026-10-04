'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

import {
  createSchoolPeriod,
  getSchoolPeriod,
  getSchoolPeriodError,
  updateSchoolPeriod,
} from '@/services/school-periods.service';

interface SchoolPeriodFormProps {
  periodId?: string;
}

export function SchoolPeriodForm({ periodId }: SchoolPeriodFormProps) {
  const router = useRouter();
  const editing = Boolean(periodId);
  const [year, setYear] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [hasReferences, setHasReferences] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!periodId) {
      return;
    }

    let active = true;
    getSchoolPeriod(periodId)
      .then((period) => {
        if (!active) return;
        setYear(String(period.year));
        setStartDate(period.startDate.slice(0, 10));
        setEndDate(period.endDate.slice(0, 10));
        setHasReferences(Boolean(period.hasReferences));
        setStatus(period.status);
      })
      .catch((loadError) => {
        if (active) setError(getSchoolPeriodError(loadError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [periodId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numericYear = Number(year);

    if (!Number.isInteger(numericYear) || numericYear < 2000 || numericYear > 2100) {
      setError('El año debe ser un entero entre 2000 y 2100.');
      return;
    }
    if (!startDate || !endDate || startDate >= endDate) {
      setError('La fecha de inicio debe ser anterior a la fecha de fin.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (periodId) {
        await updateSchoolPeriod(periodId, {
          year: numericYear,
          startDate,
          endDate,
        });
      } else {
        await createSchoolPeriod({ year: numericYear, startDate, endDate });
      }
      router.push('/dashboard/administration/school-periods');
    } catch (saveError) {
      setError(getSchoolPeriodError(saveError));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Cargando período...</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/dashboard/administration/school-periods" className="text-sm text-red-800 hover:underline">
          Períodos Escolares
        </Link>
        <h1 className="mt-1 text-3xl font-bold text-slate-900">
          {editing ? 'Editar período escolar' : 'Nuevo período escolar'}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {editing
            ? 'Actualiza la identidad y las fechas del período.'
            : 'El período se creará planificado y habilitado.'}
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {status === 'CLOSED' && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Este período está cerrado y se conserva como información histórica. No puede editarse.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <label htmlFor="period-year" className="mb-1 block text-sm font-medium text-slate-700">Año *</label>
          <input
            id="period-year"
            type="number"
            min={2000}
            max={2100}
            required
            value={year}
            onChange={(event) => setYear(event.target.value)}
            disabled={saving || hasReferences || status === 'CLOSED'}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-red-700 focus:ring-2 focus:ring-red-100 disabled:cursor-not-allowed disabled:bg-slate-100"
          />
          {hasReferences && (
            <p className="mt-1 text-xs text-slate-500">
              El año es identidad histórica y no puede cambiar porque ya existen registros relacionados.
            </p>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="period-start" className="mb-1 block text-sm font-medium text-slate-700">Fecha de inicio *</label>
            <input id="period-start" type="date" required value={startDate} onChange={(event) => setStartDate(event.target.value)} disabled={saving || status === 'CLOSED'} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-red-700 focus:ring-2 focus:ring-red-100 disabled:bg-slate-100" />
          </div>
          <div>
            <label htmlFor="period-end" className="mb-1 block text-sm font-medium text-slate-700">Fecha de fin *</label>
            <input id="period-end" type="date" required value={endDate} onChange={(event) => setEndDate(event.target.value)} disabled={saving || status === 'CLOSED'} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-red-700 focus:ring-2 focus:ring-red-100 disabled:bg-slate-100" />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
          <Link href="/dashboard/administration/school-periods" className="rounded-md border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-100">
            Cancelar
          </Link>
          {status !== 'CLOSED' && (
            <button type="submit" disabled={saving} className="rounded-md bg-red-800 px-4 py-2 font-medium text-white hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear período'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
