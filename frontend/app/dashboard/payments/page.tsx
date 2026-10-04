'use client';

import Link from 'next/link';
import {
  type FormEvent,
  useEffect,
  useState,
} from 'react';

import VoucherViewerModal from '@/components/payments/voucher-viewer-modal';

import {
  getPayments,
} from '@/services/payments.service';

import {
  getSchoolPeriods,
} from '@/services/school-periods.service';

import type {
  Payment,
} from '@/types/payments';

import type {
  SchoolPeriod,
} from '@/types/school-periods';

import {
  getSchoolPeriodStatusLabel,
} from '@/lib/school-period-status';

const PAGE_SIZE = 20;

function formatDate(
  value: string,
): string {
  const [
    year,
    month,
    day,
  ] =
    value.split('-');

  if (
    !year ||
    !month ||
    !day
  ) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

export default function PaymentsPage() {
  const [
    payments,
    setPayments,
  ] =
    useState<
      Payment[]
    >([]);

  const [
    periods,
    setPeriods,
  ] =
    useState<
      SchoolPeriod[]
    >([]);

  const [
    schoolPeriodId,
    setSchoolPeriodId,
  ] =
    useState('');

  const [
    page,
    setPage,
  ] =
    useState(1);

  const [
    searchInput,
    setSearchInput,
  ] = useState('');

  const [
    search,
    setSearch,
  ] = useState('');

  const [
    total,
    setTotal,
  ] =
    useState(0);

  const [
    totalPages,
    setTotalPages,
  ] =
    useState(0);

  const [
    loadingPeriods,
    setLoadingPeriods,
  ] =
    useState(true);

  const [
    loadingPayments,
    setLoadingPayments,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  const [
    voucherPaymentId,
    setVoucherPaymentId,
  ] =
    useState<
      string | null
    >(null);

  useEffect(() => {
    async function loadPeriods() {
      try {
        setLoadingPeriods(
          true,
        );

        const response =
          await getSchoolPeriods();

        setPeriods(
          response.data,
        );

        if (
          response
            .currentOpenPeriod
        ) {
          setSchoolPeriodId(
            response
              .currentOpenPeriod
              .id,
          );
        }

        setError(
          null,
        );
      } catch (error) {
        console.error(
          error,
        );

        setError(
          'No se pudieron cargar los períodos escolares.',
        );
      } finally {
        setLoadingPeriods(
          false,
        );
      }
    }

    void loadPeriods();
  }, []);

  useEffect(() => {
    async function loadPayments() {
      try {
        setLoadingPayments(
          true,
        );

        const response =
          await getPayments({
            schoolPeriodId:
              schoolPeriodId ||
              undefined,

            search:
              search ||
              undefined,

            page,

            limit:
              PAGE_SIZE,
          });

        setPayments(
          response.data,
        );

        setTotal(
          response
            .pagination
            .total,
        );

        setTotalPages(
          response
            .pagination
            .totalPages,
        );

        setError(
          null,
        );
      } catch (error) {
        console.error(
          error,
        );

        setPayments(
          [],
        );

        setTotal(
          0,
        );

        setTotalPages(
          0,
        );

        setError(
          'No se pudo cargar el listado de pagos.',
        );
      } finally {
        setLoadingPayments(
          false,
        );
      }
    }

    if (
      !loadingPeriods
    ) {
      void loadPayments();
    }
  }, [
    loadingPeriods,
    schoolPeriodId,
    search,
    page,
  ]);

  function handlePeriodChange(
    value: string,
  ) {
    setSchoolPeriodId(
      value,
    );

    setPage(
      1,
    );

    setError(
      null,
    );
  }

  function handleSearch(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
    setError(null);
  }

  function goToPreviousPage() {
    if (
      page <= 1
    ) {
      return;
    }

    setPage(
      (current) =>
        current - 1,
    );
  }

  function goToNextPage() {
    if (
      totalPages ===
        0 ||
      page >=
        totalPages
    ) {
      return;
    }

    setPage(
      (current) =>
        current + 1,
    );
  }

  const firstItem =
    total === 0
      ? 0
      : (
          page - 1
        ) *
          PAGE_SIZE +
        1;

  const lastItem =
    Math.min(
      page *
        PAGE_SIZE,
      total,
    );

  const loading =
    loadingPeriods ||
    loadingPayments;

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Pagos
            </h1>

            <p className="mt-1 text-sm text-slate-600">
              Consulta y registro de pagos de APAFA y Taller.
            </p>
          </div>

          <Link
            href="/dashboard/payments/new"
            className="inline-flex items-center justify-center rounded-md bg-red-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-900"
          >
            Registrar pago
          </Link>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
            <label
              htmlFor="school-period"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Período escolar
            </label>

            <select
              id="school-period"
              value={
                schoolPeriodId
              }
              disabled={
                loadingPeriods
              }
              onChange={(
                event,
              ) =>
                handlePeriodChange(
                  event
                    .target
                    .value,
                )
              }
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-red-700 focus:ring-2 focus:ring-red-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              <option value="">
                Todos los períodos
              </option>

              {periods.map(
                (
                  period,
                ) => (
                  <option
                    key={
                      period.id
                    }
                    value={
                      period.id
                    }
                  >
                    {
                      period.year
                    }
                    {' - '}
                    {getSchoolPeriodStatusLabel(
                      period.status,
                    )}
                  </option>
                ),
              )}
            </select>
            </div>

            <form onSubmit={handleSearch}>
              <label
                htmlFor="payment-search"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Buscar integrante familiar
              </label>

              <div className="flex gap-2">
                <input
                  id="payment-search"
                  type="search"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Nombre, apellido o documento"
                  className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-red-700 focus:ring-2 focus:ring-red-100"
                />

                <button
                  type="submit"
                  className="shrink-0 rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-900"
                >
                  Buscar
                </button>
              </div>
            </form>
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
                <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <th className="border-b border-slate-200 px-4 py-3">
                    Fecha
                  </th>

                  <th className="border-b border-slate-200 px-4 py-3">
                    Apoderado
                  </th>

                  <th className="border-b border-slate-200 px-4 py-3">
                    Período
                  </th>

                  <th className="border-b border-slate-200 px-4 py-3">
                    Conceptos
                  </th>

                  <th className="border-b border-slate-200 px-4 py-3">
                    Operación
                  </th>

                  <th className="border-b border-slate-200 px-4 py-3 text-center">
                    Comprobantes
                  </th>

                  <th className="border-b border-slate-200 px-4 py-3">
                    Registrado por
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={
                        7
                      }
                      className="px-4 py-10 text-center text-sm text-slate-500"
                    >
                      Cargando pagos...
                    </td>
                  </tr>
                ) : payments.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan={
                        7
                      }
                      className="px-4 py-10 text-center"
                    >
                      <div className="text-sm font-medium text-slate-700">
                        No se encontraron pagos
                      </div>

                      <div className="mt-1 text-sm text-slate-500">
                        No existen registros para los filtros seleccionados.
                      </div>
                    </td>
                  </tr>
                ) : (
                  payments.map(
                    (
                      payment,
                    ) => (
                      <tr
                        key={
                          payment.id
                        }
                        className="transition hover:bg-slate-50"
                      >
                        <td className="border-b border-slate-200 px-4 py-3 text-sm text-slate-700">
                          {formatDate(
                            payment.paymentDate,
                          )}
                        </td>

                        <td className="border-b border-slate-200 px-4 py-3">
                          <div className="text-sm font-medium text-slate-900">
                            {
                              payment
                                .family
                                .guardianName
                            }
                          </div>

                          <div className="mt-0.5 text-xs text-slate-500">
                            {payment
                              .family
                              .code ??
                              'Sin código'}
                          </div>
                        </td>

                        <td className="border-b border-slate-200 px-4 py-3 text-sm text-slate-700">
                          {
                            payment
                              .schoolPeriod
                              .year
                          }
                        </td>

                        <td className="border-b border-slate-200 px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            {payment
                              .apafa
                              .included && (
                              <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                                APAFA
                              </span>
                            )}

                            {payment
                              .talleres
                              .length >
                              0 && (
                              <span className="inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-800">
                                Taller ×{' '}
                                {
                                  payment
                                    .talleres
                                    .length
                                }
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="border-b border-slate-200 px-4 py-3 text-sm text-slate-700">
                          {payment.operationNumber ??
                            '—'}
                        </td>

                        <td className="border-b border-slate-200 px-4 py-3 text-center">
                          {payment
                            .vouchers
                            .length >
                          0 ? (
                            <button
                              type="button"
                              onClick={() =>
                                setVoucherPaymentId(
                                  payment.id,
                                )
                              }
                              className="inline-flex items-center rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-800 transition hover:bg-red-100"
                            >
                              Ver{' '}
                              {
                                payment
                                  .vouchers
                                  .length
                              }{' '}
                              {payment
                                .vouchers
                                .length ===
                              1
                                ? 'comprobante'
                                : 'comprobantes'}
                            </button>
                          ) : (
                            <span className="text-sm text-slate-400">
                              —
                            </span>
                          )}
                        </td>

                        <td className="border-b border-slate-200 px-4 py-3">
                          <div className="text-sm font-medium text-slate-900">
                            {
                              payment
                                .registeredBy
                                .fullName
                            }
                          </div>

                          <div className="mt-0.5 text-xs text-slate-500">
                            {
                              payment
                                .registeredBy
                                .username
                            }
                          </div>
                        </td>
                      </tr>
                    ),
                  )
                )}
              </tbody>
            </table>
          </div>

          {!loading &&
            total >
              0 && (
              <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-600">
                  Mostrando{' '}
                  {
                    firstItem
                  }
                  {' - '}
                  {
                    lastItem
                  }
                  {' de '}
                  {
                    total
                  }
                </p>

                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-500">
                    Página{' '}
                    {page}
                    {totalPages >
                    0
                      ? ` de ${totalPages}`
                      : ''}
                  </span>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={
                        page <=
                        1
                      }
                      onClick={
                        goToPreviousPage
                      }
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Anterior
                    </button>

                    <button
                      type="button"
                      disabled={
                        totalPages ===
                          0 ||
                        page >=
                          totalPages
                      }
                      onClick={
                        goToNextPage
                      }
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              </div>
            )}
        </div>
      </div>

      <VoucherViewerModal
        editable
        paymentId={
          voucherPaymentId
        }
        onClose={() =>
          setVoucherPaymentId(
            null,
          )
        }
      />
    </>
  );
}
