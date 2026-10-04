"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  closeSchoolPeriod,
  disableSchoolPeriod,
  enableSchoolPeriod,
  getSchoolPeriodError,
  getSchoolPeriods,
  openSchoolPeriod,
} from "@/services/school-periods.service";
import type {
  SchoolPeriod,
  SchoolPeriodStatus,
  SchoolPeriodWarning,
} from "@/types/school-periods";
import { getSchoolPeriodStatusLabel } from "@/lib/school-period-status";

const statusClasses: Record<SchoolPeriodStatus, string> = {
  PLANNED: "bg-slate-100 text-slate-700",
  OPEN: "bg-green-100 text-green-700",
  CLOSED: "bg-slate-100 text-slate-600",
};

export default function SchoolPeriodsPage() {
  const [periods, setPeriods] = useState<SchoolPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<SchoolPeriodWarning | null>(null);

  const loadPeriods = useCallback(async () => {
    try {
      const response = await getSchoolPeriods();
      setPeriods(response.data);
      setWarning(response.warning);
      setError(null);
    } catch (loadError) {
      setError(getSchoolPeriodError(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPeriods();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadPeriods]);

  async function runAction(
    period: SchoolPeriod,
    action: "open" | "close" | "enable" | "disable",
  ) {
    if (
      (action === "close" || action === "disable") &&
      !window.confirm(
        action === "close"
          ? `¿Deseas cerrar el período escolar ${period.year}? Esta acción lo convertirá en histórico.`
          : `¿Deseas deshabilitar el período escolar ${period.year}?`,
      )
    ) {
      return;
    }

    const operations = {
      open: openSchoolPeriod,
      close: closeSchoolPeriod,
      enable: enableSchoolPeriod,
      disable: disableSchoolPeriod,
    };

    setPendingId(period.id);
    setError(null);
    try {
      await operations[action](period.id);
      await loadPeriods();
    } catch (actionError) {
      setError(getSchoolPeriodError(actionError));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href="/dashboard/administration"
            className="text-sm text-red-800 hover:underline"
          >
            Administración
          </Link>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            Períodos Escolares
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Gestión del ciclo de vida de los períodos académicos.
          </p>
        </div>
        <Link
          href="/dashboard/administration/school-periods/new"
          className="rounded-md bg-red-800 px-4 py-2 font-medium text-white transition hover:bg-red-900"
        >
          Nuevo período
        </Link>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {warning && (
        <div
          className={
            warning.type === "OVERDUE"
              ? "rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
              : "rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800"
          }
        >
          {warning.message}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-slate-100 text-left text-sm text-slate-700">
              <tr>
                {[
                  "Año",
                  "Fecha inicio",
                  "Fecha fin",
                  "Estado",
                  "Habilitado",
                  "Acciones",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="border-b border-slate-200 px-4 py-3 font-semibold"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-slate-500"
                  >
                    Cargando períodos...
                  </td>
                </tr>
              ) : periods.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-slate-500"
                  >
                    No hay períodos escolares registrados.
                  </td>
                </tr>
              ) : (
                periods.map((period) => (
                  <tr key={period.id} className="hover:bg-slate-50">
                    <td className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-900">
                      {period.year}
                    </td>
                    <td className="border-b border-slate-200 px-4 py-3 text-sm text-slate-700">
                      {formatDate(period.startDate)}
                    </td>
                    <td className="border-b border-slate-200 px-4 py-3 text-sm text-slate-700">
                      {formatDate(period.endDate)}
                    </td>
                    <td className="border-b border-slate-200 px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClasses[period.status]}`}
                      >
                        {getSchoolPeriodStatusLabel(period.status)}
                      </span>
                    </td>
                    <td className="border-b border-slate-200 px-4 py-3 text-sm text-slate-700">
                      {period.isActive ? "Sí" : "No"}
                    </td>
                    <td className="border-b border-slate-200 px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {period.status !== "CLOSED" && (
                          <Link
                            href={`/dashboard/administration/school-periods/${period.id}/edit`}
                            className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                          >
                            Editar
                          </Link>
                        )}
                        {period.status === "PLANNED" && period.isActive && (
                          <>
                            <ActionButton
                              disabled={pendingId === period.id}
                              onClick={() => void runAction(period, "open")}
                            >
                              Abrir
                            </ActionButton>
                            <ActionButton
                              disabled={pendingId === period.id}
                              onClick={() => void runAction(period, "disable")}
                            >
                              Deshabilitar
                            </ActionButton>
                          </>
                        )}
                        {period.status === "PLANNED" && !period.isActive && (
                          <ActionButton
                            disabled={pendingId === period.id}
                            onClick={() => void runAction(period, "enable")}
                          >
                            Habilitar
                          </ActionButton>
                        )}
                        {period.status === "OPEN" && (
                          <div>
                            <ActionButton
                              disabled={
                                pendingId === period.id ||
                                getCloseRestriction(period) !== null
                              }
                              onClick={() => void runAction(period, "close")}
                            >
                              Cerrar
                            </ActionButton>
                            {getCloseRestriction(period) && (
                              <p className="mt-1 max-w-56 text-xs text-slate-500">
                                {getCloseRestriction(period)}
                              </p>
                            )}
                          </div>
                        )}
                        {period.status === "CLOSED" && (
                          <span className="py-1.5 text-sm text-slate-500">
                            Histórico
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", { timeZone: "UTC" }).format(
    new Date(`${value.slice(0, 10)}T00:00:00.000Z`),
  );
}

function getCloseRestriction(period: SchoolPeriod): string | null {
  const now = new Date();
  const currentYear = now.getFullYear();

  if (period.year > currentYear) {
    return "Un período futuro no puede cerrarse.";
  }

  if (period.year === currentYear && now.getMonth() !== 11) {
    return "Disponible a partir de diciembre.";
  }

  return null;
}
