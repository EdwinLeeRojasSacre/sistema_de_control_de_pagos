'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  downloadVoucherFile,
  getPaymentById,
  getPaymentVoucherLinks,
  getVoucherFileBlob,
  updatePaymentVoucherLinks,
} from '@/services/payments.service';

import type {
  Payment,
  PaymentVoucher,
  PaymentVoucherLinks,
} from '@/types/payments';

interface VoucherViewerModalProps {
  paymentId:
    string | null;

  onClose:
    () => void;

  editable?: boolean;
}

const IMAGE_MIME_TYPES =
  new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
  ]);

function isImageVoucher(
  voucher:
    PaymentVoucher,
): boolean {
  if (
    !voucher.mimeType
  ) {
    return false;
  }

  return IMAGE_MIME_TYPES.has(
    voucher.mimeType,
  );
}

function formatFileSize(
  bytes:
    number | null,
): string {
  if (
    bytes === null ||
    bytes < 0
  ) {
    return 'Tamaño no disponible';
  }

  if (
    bytes < 1024
  ) {
    return `${bytes} B`;
  }

  if (
    bytes <
    1024 * 1024
  ) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}

function formatMimeType(
  mimeType:
    string | null,
): string {
  switch (
    mimeType
  ) {
    case 'image/jpeg':
      return 'Imagen JPEG';

    case 'image/png':
      return 'Imagen PNG';

    case 'image/webp':
      return 'Imagen WebP';

    case 'application/pdf':
      return 'Documento PDF';

    default:
      return (
        mimeType ??
        'Archivo'
      );
  }
}

export default function VoucherViewerModal({
  paymentId,
  onClose,
  editable = false,
}: VoucherViewerModalProps) {
  const [
    payment,
    setPayment,
  ] =
    useState<
      Payment | null
    >(null);

  const [
    selectedVoucherId,
    setSelectedVoucherId,
  ] =
    useState<
      string | null
    >(null);

  const [
    previewUrl,
    setPreviewUrl,
  ] =
    useState<
      string | null
    >(null);

  const [
    loadingPayment,
    setLoadingPayment,
  ] =
    useState(false);

  const [
    loadingPreview,
    setLoadingPreview,
  ] =
    useState(false);

  const [
    downloadingId,
    setDownloadingId,
  ] =
    useState<
      string | null
    >(null);

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  const [linksByVoucher, setLinksByVoucher] = useState<
    Record<string, PaymentVoucherLinks>
  >({});
  const [editingVoucherId, setEditingVoucherId] = useState<string | null>(null);
  const [editIncludeApafa, setEditIncludeApafa] = useState(false);
  const [editStudentIds, setEditStudentIds] = useState<string[]>([]);
  const [savingLinks, setSavingLinks] = useState(false);

  const selectedVoucher =
    useMemo(
      () =>
        payment
          ?.vouchers.find(
            (
              voucher,
            ) =>
              voucher.id ===
              selectedVoucherId,
          ) ??
        null,
      [
        payment,
        selectedVoucherId,
      ],
    );

  useEffect(() => {
    if (
      !paymentId
    ) {
      return;
    }

    let active =
      true;

    async function loadPayment(
      resolvedPaymentId:
        string,
    ) {
      try {
        setLoadingPayment(
          true,
        );

        const result =
          await getPaymentById(
            resolvedPaymentId,
          );

        if (
          !active
        ) {
          return;
        }

        setPayment(
          result,
        );

        const firstImage =
          result.vouchers.find(
            isImageVoucher,
          );

        setSelectedVoucherId(
          firstImage?.id ??
            result
              .vouchers[0]
              ?.id ??
            null,
        );

        setError(
          null,
        );
      } catch (error) {
        console.error(
          error,
        );

        if (
          !active
        ) {
          return;
        }

        setPayment(
          null,
        );

        setError(
          'No fue posible cargar los comprobantes de este pago.',
        );
      } finally {
        if (
          active
        ) {
          setLoadingPayment(
            false,
          );
        }
      }
    }

    void loadPayment(
      paymentId,
    );

    return () => {
      active =
        false;
    };
  }, [
    paymentId,
  ]);

  useEffect(() => {
    if (
      !paymentId ||
      !selectedVoucher ||
      !isImageVoucher(
        selectedVoucher,
      )
    ) {
      return;
    }

    let active =
      true;

    let objectUrl:
      string | null =
      null;

    async function loadPreview(
      resolvedPaymentId:
        string,
      voucher:
        PaymentVoucher,
    ) {
      try {
        setLoadingPreview(
          true,
        );

        const blob =
          await getVoucherFileBlob(
            resolvedPaymentId,
            voucher.id,
            'view',
          );

        if (
          !active
        ) {
          return;
        }

        objectUrl =
          window.URL.createObjectURL(
            blob,
          );

        setPreviewUrl(
          objectUrl,
        );

        setError(
          null,
        );
      } catch (error) {
        console.error(
          error,
        );

        if (
          active
        ) {
          setError(
            'No fue posible mostrar la vista previa del voucher.',
          );
        }
      } finally {
        if (
          active
        ) {
          setLoadingPreview(
            false,
          );
        }
      }
    }

    void loadPreview(
      paymentId,
      selectedVoucher,
    );

    return () => {
      active =
        false;

      if (
        objectUrl
      ) {
        window.URL
          .revokeObjectURL(
            objectUrl,
          );
      }
    };
  }, [
    paymentId,
    selectedVoucher,
  ]);

  useEffect(() => {
    if (
      !paymentId
    ) {
      return;
    }

    function handleKeyDown(
      event:
        KeyboardEvent,
    ) {
      if (
        event.key ===
        'Escape'
      ) {
        onClose();
      }
    }

    document.addEventListener(
      'keydown',
      handleKeyDown,
    );

    return () => {
      document.removeEventListener(
        'keydown',
        handleKeyDown,
      );
    };
  }, [
    paymentId,
    onClose,
  ]);

  if (
    !paymentId
  ) {
    return null;
  }

  async function handleDownload(
    voucher:
      PaymentVoucher,
  ) {
    if (
      !paymentId
    ) {
      return;
    }

    try {
      setDownloadingId(
        voucher.id,
      );

      setError(
        null,
      );

      await downloadVoucherFile(
        paymentId,
        voucher.id,
        voucher.originalName,
      );
    } catch (error) {
      console.error(
        error,
      );

      setError(
        'No fue posible descargar el voucher.',
      );
    } finally {
      setDownloadingId(
        null,
      );
    }
  }

  async function beginEditLinks(voucherId: string) {
    if (!paymentId || !payment) return;

    try {
      setError(null);
      const entries = await Promise.all(
        payment.vouchers.map(async (voucher) => [
          voucher.id,
          await getPaymentVoucherLinks(paymentId, voucher.id),
        ] as const),
      );
      const links = Object.fromEntries(entries);
      const current = links[voucherId];
      setLinksByVoucher(links);
      setEditingVoucherId(voucherId);
      setEditIncludeApafa(current?.includeApafa ?? false);
      setEditStudentIds(current?.students.map((student) => student.studentId) ?? []);
    } catch (editError) {
      console.error(editError);
      setError('No fue posible cargar las asociaciones del voucher.');
    }
  }

  async function saveLinks() {
    if (!paymentId || !editingVoucherId) return;
    if (!editIncludeApafa && editStudentIds.length === 0) {
      setError('Todo voucher debe estar asociado al menos a un concepto. Elimine el voucher si ya no corresponde.');
      return;
    }

    try {
      setSavingLinks(true);
      setError(null);
      await updatePaymentVoucherLinks(paymentId, editingVoucherId, {
        includeApafa: editIncludeApafa,
        studentIds: editStudentIds,
      });
      const refreshed = await getPaymentById(paymentId);
      setPayment(refreshed);
      setEditingVoucherId(null);
    } catch (editError) {
      console.error(editError);
      setError('No fue posible guardar: el concepto puede estar asociado a otro voucher o la selección es inválida.');
    } finally {
      setSavingLinks(false);
    }
  }

  function handleClose() {
    setPayment(
      null,
    );

    setSelectedVoucherId(
      null,
    );

    setPreviewUrl(
      null,
    );

    setError(
      null,
    );

    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="voucher-modal-title"
    >
      <button
        type="button"
        aria-label="Cerrar visor de comprobantes"
        className="absolute inset-0 cursor-default"
        onClick={
          handleClose
        }
      />

      <div className="relative z-10 flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2
              id="voucher-modal-title"
              className="text-lg font-semibold text-slate-900"
            >
              Comprobantes del pago
            </h2>

            {payment && (
              <p className="mt-1 text-sm text-slate-500">
                {
                  payment
                    .family
                    .name
                }
                {' · '}
                {
                  payment
                    .schoolPeriod
                    .year
                }
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={
              handleClose
            }
            className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loadingPayment ? (
          <div className="flex min-h-[420px] items-center justify-center p-8 text-sm text-slate-500">
            Cargando comprobantes...
          </div>
        ) : !payment ? (
          <div className="flex min-h-[420px] items-center justify-center p-8 text-sm text-slate-500">
            No se pudo obtener el pago.
          </div>
        ) : payment
            .vouchers
            .length ===
          0 ? (
          <div className="flex min-h-[420px] items-center justify-center p-8 text-sm text-slate-500">
            Este pago no tiene vouchers registrados.
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 md:grid-cols-[320px_minmax(0,1fr)]">
            <div className="overflow-y-auto border-b border-slate-200 bg-slate-50 p-4 md:border-b-0 md:border-r">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Archivos
              </p>

              <div className="space-y-3">
                {payment
                  .vouchers
                  .map(
                    (
                      voucher,
                      index,
                    ) => {
                      const image =
                        isImageVoucher(
                          voucher,
                        );

                      const selected =
                        selectedVoucherId ===
                        voucher.id;

                      return (
                        <div
                          key={
                            voucher.id
                          }
                          className={[
                            'rounded-xl border p-3 transition',
                            selected
                              ? 'border-red-700 bg-red-50'
                              : 'border-slate-200 bg-white',
                          ].join(
                            ' ',
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">
                              {index +
                                1}
                            </div>

                            <div className="min-w-0 flex-1">
                              <p
                                className="truncate text-sm font-medium text-slate-900"
                                title={
                                  voucher.originalName
                                }
                              >
                                {
                                  voucher.originalName
                                }
                              </p>

                              <p className="mt-1 text-xs text-slate-500">
                                {formatMimeType(
                                  voucher.mimeType,
                                )}
                              </p>

                              <p className="text-xs text-slate-500">
                                {formatFileSize(
                                  voucher.fileSize,
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 flex gap-2">
                            {image && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedVoucherId(
                                    voucher.id,
                                  );

                                  setError(
                                    null,
                                  );
                                }}
                                className="flex-1 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-800 transition hover:bg-red-100"
                              >
                                Ver
                              </button>
                            )}

                            <button
                              type="button"
                              disabled={
                                downloadingId ===
                                voucher.id
                              }
                              onClick={() =>
                                void handleDownload(
                                  voucher,
                                )
                              }
                              className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {downloadingId ===
                              voucher.id
                                ? 'Descargando...'
                                : 'Descargar'}
                            </button>

                            {editable && (
                              <button
                                type="button"
                                onClick={() => void beginEditLinks(voucher.id)}
                                className="flex-1 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 transition hover:bg-amber-100"
                              >
                                Asociaciones
                              </button>
                            )}
                          </div>

                          {editingVoucherId === voucher.id && (
                            <div className="mt-3 space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                              {payment.apafa.included && (() => {
                                const assignedElsewhere = Object.values(linksByVoucher).some(
                                  (links) => links.voucherId !== voucher.id && links.includeApafa,
                                );
                                return (
                                  <label className="flex items-center gap-2 text-xs text-slate-700">
                                    <input
                                      type="checkbox"
                                      checked={editIncludeApafa}
                                      disabled={!editIncludeApafa && assignedElsewhere}
                                      onChange={(event) => setEditIncludeApafa(event.target.checked)}
                                    />
                                    APAFA
                                  </label>
                                );
                              })()}

                              {payment.talleres.map((student) => {
                                const selected = editStudentIds.includes(student.studentId);
                                const assignedElsewhere = Object.values(linksByVoucher).some(
                                  (links) =>
                                    links.voucherId !== voucher.id &&
                                    links.students.some((item) => item.studentId === student.studentId),
                                );
                                return (
                                  <label key={student.studentId} className="flex items-center gap-2 text-xs text-slate-700">
                                    <input
                                      type="checkbox"
                                      checked={selected}
                                      disabled={!selected && assignedElsewhere}
                                      onChange={() => setEditStudentIds((current) =>
                                        selected
                                          ? current.filter((id) => id !== student.studentId)
                                          : [...current, student.studentId],
                                      )}
                                    />
                                    Taller - {student.studentName}
                                  </label>
                                );
                              })}

                              <div className="flex gap-2 pt-1">
                                <button
                                  type="button"
                                  disabled={savingLinks}
                                  onClick={() => void saveLinks()}
                                  className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                                >
                                  {savingLinks ? 'Guardando...' : 'Guardar'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingVoucherId(null)}
                                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    },
                  )}
              </div>
            </div>

            <div className="flex min-h-[420px] flex-col bg-slate-900">
              {selectedVoucher &&
              isImageVoucher(
                selectedVoucher,
              ) ? (
                <>
                  <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">
                        {
                          selectedVoucher.originalName
                        }
                      </p>

                      <p className="mt-0.5 text-xs text-slate-400">
                        Vista previa de imagen
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={
                        downloadingId ===
                        selectedVoucher.id
                      }
                      onClick={() =>
                        void handleDownload(
                          selectedVoucher,
                        )
                      }
                      className="shrink-0 rounded-md bg-white px-3 py-2 text-xs font-medium text-slate-800 transition hover:bg-slate-100 disabled:opacity-50"
                    >
                      Descargar
                    </button>
                  </div>

                  <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
                    {loadingPreview ? (
                      <p className="text-sm text-slate-300">
                        Cargando imagen...
                      </p>
                    ) : previewUrl ? (
                      <img
                        src={
                          previewUrl
                        }
                        alt={`Voucher ${selectedVoucher.originalName}`}
                        className="max-h-[68vh] max-w-full object-contain shadow-2xl"
                      />
                    ) : (
                      <p className="text-sm text-slate-300">
                        No fue posible mostrar la imagen.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-2xl text-white">
                    ↓
                  </div>

                  <p className="mt-4 text-base font-medium text-white">
                    Vista previa no disponible
                  </p>

                  <p className="mt-2 max-w-md text-sm text-slate-400">
                    Este tipo de archivo solo puede descargarse.
                  </p>

                  {selectedVoucher && (
                    <button
                      type="button"
                      disabled={
                        downloadingId ===
                        selectedVoucher.id
                      }
                      onClick={() =>
                        void handleDownload(
                          selectedVoucher,
                        )
                      }
                      className="mt-5 rounded-md bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-100 disabled:opacity-50"
                    >
                      Descargar archivo
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
