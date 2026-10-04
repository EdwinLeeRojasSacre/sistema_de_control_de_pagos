'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import {
  getFamilyGroups,
} from '@/services/family-groups.service';

import type {
  FamilyGroup,
  FamilyGroupStatus,
} from '@/services/family-groups.service';

const PAGE_SIZE = 20;

export default function FamilyGroupsPage() {
  const [groups, setGroups] = useState<
    FamilyGroup[]
  >([]);

  const [search, setSearch] =
    useState('');

  const [status, setStatus] =
    useState<FamilyGroupStatus>('ALL');

  const [page, setPage] =
    useState(1);

  const [total, setTotal] =
    useState(0);

  const [totalPages, setTotalPages] =
    useState(0);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      async function loadGroups() {
        try {
          const response =
            await getFamilyGroups({
              search:
                search.trim() || undefined,
              status,
              page,
              limit: PAGE_SIZE,
            });

          setGroups(response.data);

          setTotal(
            response.pagination.total,
          );

          setTotalPages(
            response.pagination.totalPages,
          );

          setError(null);
        } catch (error) {
          console.error(error);

          setError(
            'No se pudo cargar el listado de familias.',
          );
        } finally {
          setLoading(false);
        }
      }

      void loadGroups();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [search, status, page]);

  function handleSearchChange(
    value: string,
  ) {
    setSearch(value);
    setPage(1);
    setLoading(true);
    setError(null);
  }

  function handleStatusChange(
    value: FamilyGroupStatus,
  ) {
    setStatus(value);
    setPage(1);
    setLoading(true);
    setError(null);
  }

  function goToPreviousPage() {
    if (page <= 1) {
      return;
    }

    setPage((current) =>
      current - 1,
    );

    setLoading(true);
    setError(null);
  }

  function goToNextPage() {
    if (page >= totalPages) {
      return;
    }

    setPage((current) =>
      current + 1,
    );

    setLoading(true);
    setError(null);
  }

  const firstItem =
    total === 0
      ? 0
      : (page - 1) * PAGE_SIZE + 1;

  const lastItem =
    Math.min(
      page * PAGE_SIZE,
      total,
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Familias
          </h1>

          <p className="mt-1 text-sm text-slate-600">
            Gestión y consulta de los registros familiares.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/family-groups/new"
            className="rounded-md bg-red-800 px-4 py-2 font-medium text-white transition hover:bg-red-900"
          >
            Nueva familia
          </Link>
          <Link
            href="/dashboard/family-groups/import"
            className="rounded-md border border-red-300 bg-red-50 px-4 py-2 font-medium text-red-800 hover:bg-red-100"
          >
            Importar familias
          </Link>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[1fr_220px]">
          <div>
            <label
              htmlFor="family-search"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Buscar
            </label>

            <input
              id="family-search"
              type="text"
              value={search}
              onChange={(event) =>
                handleSearchChange(
                  event.target.value,
                )
              }
              placeholder="Código, nombre o documento de un integrante"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-red-700 focus:ring-2 focus:ring-red-100"
            />
          </div>

          <div>
            <label
              htmlFor="family-status"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Estado
            </label>

            <select
              id="family-status"
              value={status}
              onChange={(event) =>
                handleStatusChange(
                  event.target.value as FamilyGroupStatus,
                )
              }
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-red-700 focus:ring-2 focus:ring-red-100"
            >
              <option value="ALL">
                Todas
              </option>

              <option value="ACTIVE">
                Activas
              </option>

              <option value="INACTIVE">
                Inactivas
              </option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-100 text-left text-sm text-slate-700">
                <th className="border-b border-slate-200 px-4 py-3 font-semibold">
                  Código
                </th>

                <th className="border-b border-slate-200 px-4 py-3 font-semibold">
                  Integrantes principales
                </th>

                <th className="border-b border-slate-200 px-4 py-3 font-semibold">
                  Miembros
                </th>

                <th className="border-b border-slate-200 px-4 py-3 font-semibold">
                  Estado
                </th>

                <th className="border-b border-slate-200 px-4 py-3 text-right font-semibold">
                  Acciones
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-slate-500"
                  >
                    Cargando familias...
                  </td>
                </tr>
              ) : groups.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-slate-500"
                  >
                    No se encontraron familias.
                  </td>
                </tr>
              ) : (
                groups.map((group) => (
                  <tr
                    key={group.id}
                    className="transition hover:bg-slate-50"
                  >
                    <td className="border-b border-slate-200 px-4 py-3 align-top text-sm text-slate-700">
                      <span className="font-medium">
                        {group.code ??
                          'Sin código'}
                      </span>
                    </td>

                    <td className="border-b border-slate-200 px-4 py-3 align-top">
                      <div className="text-sm">
                        {group.primaryMembers?.length ? (
                          <div className="space-y-2">
                            {group.primaryMembers.map(
                              (member) => (
                                <div
                                  key={`${member.personId}-${member.relationship}`}
                                >
                                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    {member.relationship}
                                  </div>

                                  <div className="font-medium text-slate-900">
                                    {member.fullName}
                                  </div>
                                </div>
                              ),
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">
                            Sin integrantes principales
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="border-b border-slate-200 px-4 py-3 align-top text-sm text-slate-700">
                      {group.membersCount}
                    </td>

                    <td className="border-b border-slate-200 px-4 py-3 align-top">
                      <span
                        className={
                          group.isActive
                            ? 'inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700'
                            : 'inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600'
                        }
                      >
                        {group.isActive
                          ? 'Activa'
                          : 'Inactiva'}
                      </span>
                    </td>

                    <td className="border-b border-slate-200 px-4 py-3 align-top">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/dashboard/family-groups/${group.id}`}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                        >
                          Ver
                        </Link>

                        <Link
                          href={`/dashboard/family-groups/${group.id}/edit`}
                          className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-800 transition hover:bg-red-50"
                        >
                          Modificar
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading &&
          total > 0 && (
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
              <p className="text-sm text-slate-600">
                Mostrando{' '}
                <span className="font-medium text-slate-900">
                  {firstItem}
                </span>{' '}
                a{' '}
                <span className="font-medium text-slate-900">
                  {lastItem}
                </span>{' '}
                de{' '}
                <span className="font-medium text-slate-900">
                  {total}
                </span>{' '}
                familias
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={
                    goToPreviousPage
                  }
                  disabled={page === 1}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Anterior
                </button>

                <span className="px-2 text-sm text-slate-600">
                  Página{' '}
                  <span className="font-medium text-slate-900">
                    {page}
                  </span>{' '}
                  de{' '}
                  <span className="font-medium text-slate-900">
                    {totalPages}
                  </span>
                </span>

                <button
                  type="button"
                  onClick={
                    goToNextPage
                  }
                  disabled={
                    page >= totalPages
                  }
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
      </div>
    </div>
  );
}
