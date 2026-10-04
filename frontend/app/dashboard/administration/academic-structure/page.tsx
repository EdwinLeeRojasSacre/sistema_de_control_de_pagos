"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

import {
  createClassroom,
  disableClassroom,
  enableClassroom,
  getAcademicStructure,
  getAcademicStructureError,
  getAcademicStructureOptions,
} from "@/services/academic-structure.service";
import type {
  AcademicClassroom,
  AcademicStructure,
  AcademicStructureOptions,
} from "@/types/academic-structure";
import { getSchoolPeriodStatusLabel } from "@/lib/school-period-status";

export default function AcademicStructurePage() {
  const [options, setOptions] = useState<AcademicStructureOptions | null>(null);
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [structure, setStructure] = useState<AcademicStructure | null>(null);
  const [levelId, setLevelId] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStructure = useCallback(async (periodId: string) => {
    if (!periodId) return;
    try {
      setStructure(await getAcademicStructure(periodId));
      setError(null);
    } catch (loadError) {
      setError(getAcademicStructureError(loadError));
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      getAcademicStructureOptions()
        .then((loadedOptions) => {
          setOptions(loadedOptions);
          const open = loadedOptions.periods.find(
            (period) => period.status === "OPEN",
          );
          const planned = [...loadedOptions.periods]
            .filter((period) => period.status === "PLANNED")
            .sort((left, right) => left.year - right.year)[0];
          const selected = open ?? planned ?? loadedOptions.periods[0];
          if (selected) {
            setSelectedPeriodId(selected.id);
            void loadStructure(selected.id);
          }
        })
        .catch((loadError) => setError(getAcademicStructureError(loadError)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadStructure]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPeriodId || !levelId || !shiftId || !name.trim()) return;
    setPending(true);
    setError(null);
    try {
      await createClassroom({
        schoolPeriodId: selectedPeriodId,
        educationLevelId: levelId,
        shiftId,
        name,
        ...(capacity ? { capacity: Number(capacity) } : {}),
      });
      setName("");
      setCapacity("");
      await loadStructure(selectedPeriodId);
    } catch (createError) {
      setError(getAcademicStructureError(createError));
    } finally {
      setPending(false);
    }
  }

  async function toggleClassroom(classroom: AcademicClassroom) {
    const action = classroom.isActive ? "deshabilitar" : "habilitar";
    if (!window.confirm(`¿Deseas ${action} el aula ${classroom.name}?`)) return;
    setPending(true);
    try {
      if (classroom.isActive) await disableClassroom(classroom.id);
      else await enableClassroom(classroom.id);
      await loadStructure(selectedPeriodId);
    } catch (toggleError) {
      setError(getAcademicStructureError(toggleError));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/administration"
          className="text-sm text-red-800 hover:underline"
        >
          Administración
        </Link>
        <h1 className="mt-1 text-3xl font-bold text-slate-900">
          Estructura Académica
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Oferta anual de aulas organizada por ciclo, grado y turno.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <label
          htmlFor="academic-period"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Período escolar
        </label>
        <select
          id="academic-period"
          value={selectedPeriodId}
          onChange={(event) => {
            setSelectedPeriodId(event.target.value);
            void loadStructure(event.target.value);
          }}
          className="w-full max-w-sm rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900"
        >
          {options?.periods.map((period) => (
            <option key={period.id} value={period.id}>
              {period.year} — {getSchoolPeriodStatusLabel(period.status)}
            </option>
          ))}
        </select>
      </div>

      {structure && !structure.period.isReadOnly && options && (
        <form
          onSubmit={handleCreate}
          className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-lg font-bold text-slate-900">Nueva aula</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <select
              required
              value={levelId}
              onChange={(event) => setLevelId(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="">Seleccionar grado</option>
              {options.levels.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.name}
                </option>
              ))}
            </select>
            <input
              required
              maxLength={150}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nombre del aula"
              className="rounded-md border border-slate-300 px-3 py-2"
            />
            <select
              required
              value={shiftId}
              onChange={(event) => setShiftId(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="">Seleccionar turno</option>
              {options.shifts.map((shift) => (
                <option key={shift.id} value={shift.id}>
                  {shift.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              max={1000}
              value={capacity}
              onChange={(event) => setCapacity(event.target.value)}
              placeholder="Capacidad (opcional)"
              className="rounded-md border border-slate-300 px-3 py-2"
            />
          </div>
          <button
            disabled={pending}
            className="mt-4 rounded-md bg-red-800 px-4 py-2 font-medium text-white hover:bg-red-900 disabled:opacity-50"
          >
            Crear aula
          </button>
        </form>
      )}

      {structure?.period.isReadOnly && (
        <div className="rounded-md border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-700">
          Período cerrado: estructura disponible únicamente para consulta
          histórica.
        </div>
      )}

      <div className="space-y-5">
        {structure?.cycles.map((cycle) => (
          <section
            key={cycle.id}
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h2 className="text-xl font-bold text-slate-900">{cycle.name}</h2>
            <div className="mt-4 space-y-4">
              {cycle.levels.map((level) => (
                <div
                  key={level.id}
                  className="rounded-md border border-slate-200"
                >
                  <h3 className="bg-slate-50 px-4 py-3 font-semibold text-slate-800">
                    {level.name}
                  </h3>
                  {level.classrooms.length === 0 ? (
                    <p className="px-4 py-4 text-sm text-slate-500">
                      Sin aulas configuradas.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-200">
                      {level.classrooms.map((classroom) => (
                        <div
                          key={classroom.id}
                          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                        >
                          <div>
                            <span className="font-medium text-slate-900">
                              {classroom.name}
                            </span>
                            <span className="ml-2 text-sm text-slate-600">
                              {classroom.shift.name}
                              {classroom.capacity
                                ? ` · Capacidad ${classroom.capacity}`
                                : ""}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span
                              className={
                                classroom.isActive
                                  ? "rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700"
                                  : "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
                              }
                            >
                              {classroom.isActive
                                ? "Habilitada"
                                : "Deshabilitada"}
                            </span>
                            {!structure.period.isReadOnly && (
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() => void toggleClassroom(classroom)}
                                className="text-sm font-medium text-red-800 hover:underline disabled:opacity-50"
                              >
                                {classroom.isActive
                                  ? "Deshabilitar"
                                  : "Habilitar"}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
