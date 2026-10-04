'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

import {
  addStudentToFamilyGroup,
  getFamilyGroupCreateOptions,
  lookupPersonByDocument,
} from '@/services/family-groups.service';

import type { AddFamilyStudentRequest, FamilyGroupCreateOptions } from '@/types/family-groups';

function getApiErrorMessage(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error
  ) {
    const response = (error as {
      response?: { data?: { message?: string | string[] } };
    }).response;
    const message = response?.data?.message;

    if (Array.isArray(message)) {
      return message.join(', ');
    }

    if (typeof message === 'string') {
      return message;
    }
  }

  return 'No se pudo registrar el hijo en la familia.';
}

export default function AddFamilyStudentPage() {
  const params = useParams();
  const router = useRouter();
  const familyGroupId =
    typeof params.id === 'string' ? params.id : '';

  const [form, setForm] = useState<AddFamilyStudentRequest>({
    schoolPeriodId: '',
    classroomId: '',
    documentType: 'DNI',
    documentNumber: '',
    firstName: '',
    lastNameFather: '',
    lastNameMother: '',
    birthDate: '',
  });
  const [existingPerson, setExistingPerson] = useState(false);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [options, setOptions] = useState<FamilyGroupCreateOptions | null>(null);
  const [educationLevelId, setEducationLevelId] = useState('');

  useEffect(() => {
    getFamilyGroupCreateOptions()
      .then((data) => {
        setOptions(data);
        setForm((current) => ({
          ...current,
          schoolPeriodId: data.schoolPeriods[0]?.id ?? '',
        }));
      })
      .catch(() => setError('No se pudieron cargar las opciones académicas.'));
  }, []);

  useEffect(() => {
    const documentNumber = form.documentNumber.trim();

    if (!documentNumber) {
      return;
    }

    const timer = window.setTimeout(() => {
      async function lookup() {
        try {
          const result = await lookupPersonByDocument(
            form.documentType,
            documentNumber,
          );

          if (!result.exists || !result.person) {
            setExistingPerson(false);
            setLookupMessage('No existe una persona con este documento. Complete los datos para registrarla.');
            return;
          }

          setExistingPerson(true);
          setForm((current) => ({
            ...current,
            firstName: result.person?.firstName ?? '',
            lastNameFather: result.person?.lastNameFather ?? '',
            lastNameMother: result.person?.lastNameMother ?? '',
            birthDate: result.person?.birthDate?.slice(0, 10) ?? '',
          }));
          setLookupMessage('Persona existente encontrada. Sus datos se conservarán y el backend validará su asociación familiar.');
        } catch {
          setLookupMessage('No fue posible consultar el documento. Intente nuevamente.');
        }
      }

      void lookup();
    }, 400);

    return () => window.clearTimeout(timer);
  }, [form.documentNumber, form.documentType]);

  function updateField(
    field: keyof AddFamilyStudentRequest,
    value: string,
  ) {
    setError(null);

    if (
      field === 'documentType' ||
      field === 'documentNumber'
    ) {
      setExistingPerson(false);
      setLookupMessage(null);
    }

    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!familyGroupId) {
      setError('El identificador de la familia no es válido.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await addStudentToFamilyGroup(familyGroupId, form);
      router.push(`/dashboard/family-groups/${familyGroupId}`);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  const identityIsLocked = existingPerson || saving;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Agregar hijo</h1>
          <p className="mt-1 text-sm text-slate-600">
            Registra al estudiante y su matrícula en una sola operación.
          </p>
        </div>
        <Link
          href={`/dashboard/family-groups/${familyGroupId}`}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Cancelar
        </Link>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {lookupMessage && (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {lookupMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Tipo de documento *
            <select
              value={form.documentType}
              onChange={(event) => updateField('documentType', event.target.value)}
              disabled={identityIsLocked}
              className="mt-1 block w-full rounded-md border border-slate-300 p-2 disabled:bg-slate-100"
            >
              <option value="DNI">DNI</option>
              <option value="CE">Carné de Extranjería</option>
              <option value="PASAPORTE">Pasaporte</option>
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700">
            Número de documento *
            <input
              value={form.documentNumber}
              onChange={(event) => updateField('documentNumber', event.target.value)}
              disabled={identityIsLocked}
              required
              maxLength={20}
              className="mt-1 block w-full rounded-md border border-slate-300 p-2 disabled:bg-slate-100"
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Nombres *
            <input value={form.firstName} onChange={(event) => updateField('firstName', event.target.value)} disabled={identityIsLocked} required maxLength={150} className="mt-1 block w-full rounded-md border border-slate-300 p-2 disabled:bg-slate-100" />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Apellido paterno *
            <input value={form.lastNameFather} onChange={(event) => updateField('lastNameFather', event.target.value)} disabled={identityIsLocked} required maxLength={150} className="mt-1 block w-full rounded-md border border-slate-300 p-2 disabled:bg-slate-100" />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Apellido materno *
            <input value={form.lastNameMother} onChange={(event) => updateField('lastNameMother', event.target.value)} disabled={identityIsLocked} required maxLength={150} className="mt-1 block w-full rounded-md border border-slate-300 p-2 disabled:bg-slate-100" />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Fecha de nacimiento *
            <input type="date" value={form.birthDate} onChange={(event) => updateField('birthDate', event.target.value)} disabled={identityIsLocked} required className="mt-1 block w-full rounded-md border border-slate-300 p-2 disabled:bg-slate-100" />
          </label>
        </div>

        <div className="border-t border-slate-200 pt-5">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Asignación académica</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-sm font-medium text-slate-700">
              Período escolar abierto *
              <select value={form.schoolPeriodId} onChange={(event) => { updateField('schoolPeriodId', event.target.value); updateField('classroomId', ''); setEducationLevelId(''); }} required className="mt-1 block w-full rounded-md border border-slate-300 p-2">
                <option value="">Seleccione</option>
                {options?.schoolPeriods.map((period) => <option key={period.id} value={period.id}>{period.year}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Nivel / grado *
              <select value={educationLevelId} onChange={(event) => { setEducationLevelId(event.target.value); updateField('classroomId', ''); }} required className="mt-1 block w-full rounded-md border border-slate-300 p-2">
                <option value="">Seleccione</option>
                {Array.from(new Map(options?.classrooms.filter((room) => room.schoolPeriodId === form.schoolPeriodId).map((room) => [room.educationLevel.id, room.educationLevel]) ?? []).values()).map((level) => <option key={level.id} value={level.id}>{level.cycle.name} · {level.name}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Aula y turno *
              <select value={form.classroomId} onChange={(event) => updateField('classroomId', event.target.value)} required className="mt-1 block w-full rounded-md border border-slate-300 p-2">
                <option value="">Seleccione</option>
                {options?.classrooms.filter((room) => room.schoolPeriodId === form.schoolPeriodId && room.educationLevel.id === educationLevelId).map((room) => <option key={room.id} value={room.id}>{room.name} · {room.shift.name}</option>)}
              </select>
            </label>
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="rounded-md bg-green-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
            {saving ? 'Registrando...' : 'Registrar hijo'}
          </button>
        </div>
      </form>
    </div>
  );
}
