'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import {
  getFamilyGroupById,
} from '@/services/family-groups.service';

import type {
  FamilyGroupDetail,
} from '@/services/family-groups.service';

function getRelationshipLabel(
  relationship: string,
): string {
  switch (relationship) {
    case 'PADRE':
      return 'Padre';

    case 'MADRE':
      return 'Madre';

    case 'PADRE / APODERADO':
      return 'Padre / Apoderado';

    case 'MADRE / APODERADO':
      return 'Madre / Apoderado';

    case 'APODERADO':
      return 'Apoderado';

    case 'PADRASTRO':
      return 'Padrastro';

    case 'MADRASTRA':
      return 'Madrastra';

    case 'ABUELO':
      return 'Abuelo';

    case 'ABUELA':
      return 'Abuela';

    case 'HERMANO':
      return 'Hermano';

    case 'HERMANA':
      return 'Hermana';

    case 'TIO':
      return 'Tío';

    case 'TIA':
      return 'Tía';

    case 'OTRO':
      return 'Otro';

    default:
      return relationship;
  }
}

export default function FamilyGroupDetailPage() {
  const params = useParams();

  const id =
    typeof params.id === 'string'
      ? params.id
      : '';

  const [family, setFamily] =
    useState<FamilyGroupDetail | null>(
      null,
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      async function loadFamily() {
        if (!id) {
          setError(
            'El identificador de la familia no es válido.',
          );

          setLoading(false);

          return;
        }

        try {
          const data =
            await getFamilyGroupById(id);

          setFamily(data);
          setError(null);
        } catch (error) {
          console.error(error);

          setError(
            'No se pudo cargar la información de la familia.',
          );
        } finally {
          setLoading(false);
        }
      }

      void loadFamily();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [id]);

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">
          Cargando información de la familia...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>

        <Link
          href="/dashboard/family-groups"
          className="inline-flex rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
        >
          Volver a familias
        </Link>
      </div>
    );
  }

  if (!family) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          No se encontró la información de la familia.
        </div>

        <Link
          href="/dashboard/family-groups"
          className="inline-flex rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
        >
          Volver a familias
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-slate-900">
              Familia
            </h1>

            <span
              className={
                family.isActive
                  ? 'inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700'
                  : 'inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600'
              }
            >
              {family.isActive
                ? 'Activa'
                : 'Inactiva'}
            </span>
          </div>

          <p className="mt-1 text-sm text-slate-600">
            Detalle del registro familiar.
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href="/dashboard/family-groups"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Volver
          </Link>

          <Link
            href={`/dashboard/family-groups/${family.id}/edit`}
            className="rounded-md bg-red-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-900"
          >
            Modificar
          </Link>

          <Link
            href={`/dashboard/family-groups/${family.id}/students/new`}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700"
          >
            Agregar hijo
          </Link>
        </div>
      </div>

      {/* IDENTIFICATION */}

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          Identificación
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Código de familia
            </p>

            <p className="mt-1 text-sm font-semibold text-slate-900">
              {family.code ??
                'Sin código'}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Fecha de registro
            </p>

            <p className="mt-1 text-sm text-slate-900">
                {family.createdAt
                  ? new Intl.DateTimeFormat(
                'es-PE',
                {
                    dateStyle: 'long',
                },
                ).format(
                new Date(family.createdAt),
                )
                  : 'No disponible'}
            </p>
            </div>
        </div>
      </section>

      {/* MEMBERS */}

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Integrantes
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Personas asociadas al grupo familiar.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-100 text-left text-sm text-slate-700">
                <th className="border-b border-slate-200 px-6 py-3 font-semibold">
                  Persona
                </th>

                <th className="border-b border-slate-200 px-6 py-3 font-semibold">
                  Documento
                </th>

                <th className="border-b border-slate-200 px-6 py-3 font-semibold">
                  Relación
                </th>

                <th className="border-b border-slate-200 px-6 py-3 font-semibold">
                  Apoderado
                </th>
              </tr>
            </thead>

            <tbody>
              {family.members.length ===
              0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-8 text-center text-sm text-slate-500"
                  >
                    No existen integrantes registrados.
                  </td>
                </tr>
              ) : (
                family.members.map(
                  (member) => (
                    <tr
                      key={member.id}
                      className="hover:bg-slate-50"
                    >
                      <td className="border-b border-slate-200 px-6 py-4">
                        <span className="text-sm font-medium text-slate-900">
                          {member.fullName}
                        </span>
                      </td>

                      <td className="border-b border-slate-200 px-6 py-4 text-sm text-slate-700">
                        {member.documentType}
                        {' · '}
                        {member.documentNumber ??
                          'Sin documento'}
                      </td>

                      <td className="border-b border-slate-200 px-6 py-4 text-sm text-slate-700">
                        {getRelationshipLabel(
                          member.relationship,
                        )}
                      </td>

                      <td className="border-b border-slate-200 px-6 py-4">
                        {member.isGuardian ? (
                          <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                            Sí
                          </span>
                        ) : (
                          <span className="text-sm text-slate-500">
                            No
                          </span>
                        )}
                      </td>
                    </tr>
                  ),
                )
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* OBSERVATIONS */}

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">
          Observaciones
        </h2>

        {family.observations ? (
          <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
            {family.observations}
          </p>
        ) : (
          <p className="text-sm text-slate-500">
            No existen observaciones registradas.
          </p>
        )}
      </section>
    </div>
  );
}
