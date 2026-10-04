'use client';

import axios from 'axios';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';

import {
  getFamilyGroups,
  type FamilyGroup,
} from '@/services/family-groups.service';

import {
  createPayment,
  getFamilyPaymentStatus,
} from '@/services/payments.service';

import {
  getSchoolPeriods,
} from '@/services/school-periods.service';

import type {
  FamilyPaymentStatus,
} from '@/types/payments';

import type {
  SchoolPeriod,
} from '@/types/school-periods';

import {
  getSchoolPeriodStatusLabel,
} from '@/lib/school-period-status';


interface VoucherDraft {
  file: File;
  includeApafa: boolean;
  studentIds: string[];
}

function isApafaAssignedElsewhere(
  vouchers: VoucherDraft[],
  currentVoucherIndex: number,
): boolean {
  return vouchers.some(
    (voucher, index) =>
      index !== currentVoucherIndex &&
      voucher.includeApafa,
  );
}

function isStudentAssignedElsewhere(
  vouchers: VoucherDraft[],
  studentId: string,
  currentVoucherIndex: number,
): boolean {
  return vouchers.some(
    (voucher, index) =>
      index !== currentVoucherIndex &&
      voucher.studentIds.includes(studentId),
  );
}

function getCurrentLocalDate(): string {
  const now = new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() + 1,
    ).padStart(2, '0');

  const day =
    String(
      now.getDate(),
    ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getApiErrorMessage(
  error: unknown,
): string {
  if (
    axios.isAxiosError(error)
  ) {
    const message =
      error.response?.data?.message;

    if (
      Array.isArray(message)
    ) {
      const messages =
        message.filter(
          (
            item,
          ): item is string =>
            typeof item ===
            'string',
        );

      if (
        messages.length > 0
      ) {
        return messages.join(
          '. ',
        );
      }
    }

    if (
      typeof message ===
        'string' &&
      message.trim()
    ) {
      return message;
    }

    if (
      error.response?.status ===
      401
    ) {
      return 'Tu sesión no es válida. Inicia sesión nuevamente.';
    }

    if (
      error.response?.status ===
      403
    ) {
      return 'No tienes permisos para registrar pagos.';
    }
  }

  return 'No fue posible completar la operación.';
}

function isAllowedVoucher(
  file: File,
): boolean {
  const allowedTypes =
    new Set([
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
    ]);

  return allowedTypes.has(
    file.type,
  );
}

function getGuardian(
  family: FamilyGroup,
) {
  return (
    family.primaryMembers.find(
      (member) =>
        member.isGuardian,
    ) ?? null
  );
}

function getFather(
  family: FamilyGroup,
) {
  return (
    family.primaryMembers.find(
      (member) =>
        member.relationship ===
          'PADRE' ||
        member.relationship ===
          'PADRE / APODERADO',
    ) ?? null
  );
}

function getMother(
  family: FamilyGroup,
) {
  return (
    family.primaryMembers.find(
      (member) =>
        member.relationship ===
          'MADRE' ||
        member.relationship ===
          'MADRE / APODERADO',
    ) ?? null
  );
}

function getDocumentLabel(
  documentType: string,
  documentNumber:
    string | null,
): string {
  if (!documentNumber) {
    return documentType;
  }

  return `${documentType} ${documentNumber}`;
}

export default function NewPaymentPage() {
  const router =
    useRouter();

  const searchContainerRef =
    useRef<HTMLDivElement | null>(
      null,
    );

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
    familySearch,
    setFamilySearch,
  ] =
    useState('');

  const [
    familyResults,
    setFamilyResults,
  ] =
    useState<
      FamilyGroup[]
    >([]);

  const [
    selectedFamily,
    setSelectedFamily,
  ] =
    useState<
      FamilyGroup | null
    >(null);

  const [
    familySearchOpen,
    setFamilySearchOpen,
  ] =
    useState(false);

  const [
    searchingFamilies,
    setSearchingFamilies,
  ] =
    useState(false);

  const [
    paymentDate,
    setPaymentDate,
  ] =
    useState(
      getCurrentLocalDate(),
    );

  const [
    operationNumber,
    setOperationNumber,
  ] =
    useState('');

  const [
    observations,
    setObservations,
  ] =
    useState('');

  const [
    paymentStatus,
    setPaymentStatus,
  ] =
    useState<
      FamilyPaymentStatus | null
    >(null);

  const [
    includeApafa,
    setIncludeApafa,
  ] =
    useState(false);

  const [
    studentIds,
    setStudentIds,
  ] =
    useState<string[]>(
      [],
    );

  const [
    vouchers,
    setVouchers,
  ] =
    useState<VoucherDraft[]>([]);

  const [
    loadingOptions,
    setLoadingOptions,
  ] =
    useState(true);

  const [
    loadingStatus,
    setLoadingStatus,
  ] =
    useState(false);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  /*
   * Carga inicial de períodos.
   */
  useEffect(() => {
    let active = true;

    async function loadOptions() {
      try {
        const periodsResponse =
          await getSchoolPeriods();

        if (!active) {
          return;
        }

        setPeriods(
          periodsResponse.data,
        );

        if (
          periodsResponse
            .currentOpenPeriod
        ) {
          setSchoolPeriodId(
            periodsResponse
              .currentOpenPeriod
              .id,
          );
        }

        setError(null);
      } catch (error) {
        console.error(error);

        if (active) {
          setError(
            'No fue posible cargar los períodos escolares.',
          );
        }
      } finally {
        if (active) {
          setLoadingOptions(
            false,
          );
        }
      }
    }

    void loadOptions();

    return () => {
      active = false;
    };
  }, []);

  /*
   * Cierra el autocomplete al hacer
   * clic fuera del componente.
   */
  useEffect(() => {
    function handleOutsideClick(
      event: MouseEvent,
    ) {
      if (
        searchContainerRef
          .current &&
        !searchContainerRef
          .current.contains(
            event.target as Node,
          )
      ) {
        setFamilySearchOpen(
          false,
        );
      }
    }

    document.addEventListener(
      'mousedown',
      handleOutsideClick,
    );

    return () => {
      document.removeEventListener(
        'mousedown',
        handleOutsideClick,
      );
    };
  }, []);

  /*
   * Búsqueda de familias con debounce.
   *
   * Los resets inmediatos se realizan
   * desde handleFamilySearchChange.
   * El effect se limita a ejecutar
   * el efecto externo: consultar API.
   */
  useEffect(() => {
    if (selectedFamily) {
      return;
    }

    const normalizedSearch =
      familySearch.trim();

    if (
      normalizedSearch.length <
      2
    ) {
      return;
    }

    let active = true;

    const timer =
      window.setTimeout(
        async () => {
          try {
            if (!active) {
              return;
            }

            setSearchingFamilies(
              true,
            );

            const response =
              await getFamilyGroups({
                search:
                  normalizedSearch,

                status:
                  'ACTIVE',

                page: 1,

                limit: 10,
              });

            if (!active) {
              return;
            }

            setFamilyResults(
              response.data,
            );

            setFamilySearchOpen(
              true,
            );
          } catch (error) {
            console.error(error);

            if (!active) {
              return;
            }

            setFamilyResults(
              [],
            );

            setError(
              'No fue posible buscar las familias.',
            );
          } finally {
            if (active) {
              setSearchingFamilies(
                false,
              );
            }
          }
        },
        350,
      );

    return () => {
      active = false;

      window.clearTimeout(
        timer,
      );
    };
  }, [
    familySearch,
    selectedFamily,
  ]);

  /*
   * Consulta estado de APAFA/Taller.
   *
   * selectedFamily se copia a una
   * constante local para mantener el
   * narrowing de TypeScript dentro de
   * la función async.
   */
  useEffect(() => {
    const familyId =
      selectedFamily?.id;

    const periodId =
      schoolPeriodId;

    if (
      !familyId ||
      !periodId
    ) {
      return;
    }

    let active = true;

    async function loadPaymentStatus(
      currentFamilyId: string,
      currentPeriodId: string,
    ) {
      try {
        setLoadingStatus(
          true,
        );

        const response =
          await getFamilyPaymentStatus(
            currentFamilyId,
            currentPeriodId,
          );

        if (!active) {
          return;
        }

        setPaymentStatus(
          response,
        );

        setError(null);
      } catch (error) {
        console.error(
          error,
        );

        if (!active) {
          return;
        }

        setPaymentStatus(
          null,
        );

        setError(
          getApiErrorMessage(
            error,
          ),
        );
      } finally {
        if (active) {
          setLoadingStatus(
            false,
          );
        }
      }
    }

    void loadPaymentStatus(
      familyId,
      periodId,
    );

    return () => {
      active = false;
    };
  }, [
    schoolPeriodId,
    selectedFamily,
  ]);

  const payableStudents =
    useMemo(
      () =>
        paymentStatus
          ?.students
          .filter(
            (student) =>
              student
                .enrolledInPeriod &&
              student.taller
                .status ===
                'NO_PAGADO',
          ) ?? [],
      [
        paymentStatus,
      ],
    );

  const selectedPeriod =
    useMemo(
      () =>
        periods.find(
          (period) =>
            period.id ===
            schoolPeriodId,
        ) ?? null,
      [
        periods,
        schoolPeriodId,
      ],
    );

  const selectedGuardian =
    useMemo(
      () =>
        selectedFamily
          ? getGuardian(
              selectedFamily,
            )
          : null,
      [
        selectedFamily,
      ],
    );

  const selectedFather =
    useMemo(
      () =>
        selectedFamily
          ? getFather(
              selectedFamily,
            )
          : null,
      [
        selectedFamily,
      ],
    );

  const selectedMother =
    useMemo(
      () =>
        selectedFamily
          ? getMother(
              selectedFamily,
            )
          : null,
      [
        selectedFamily,
      ],
    );

  function resetPaymentSelection() {
    setPaymentStatus(
      null,
    );

    setIncludeApafa(
      false,
    );

    setStudentIds(
      [],
    );

    setVouchers(
      (current) =>
        current.map(
          (voucher) => ({
            ...voucher,
            includeApafa: false,
            studentIds: [],
          }),
        ),
    );
  }

  function handlePeriodChange(
    value: string,
  ) {
    setSchoolPeriodId(
      value,
    );

    resetPaymentSelection();

    setError(null);
  }

  function handleFamilySearchChange(
    value: string,
  ) {
    setFamilySearch(
      value,
    );

    if (
      selectedFamily
    ) {
      setSelectedFamily(
        null,
      );

      resetPaymentSelection();
    }

    /*
     * Limpiamos los resultados desde
     * el handler y no desde useEffect.
     */
    setFamilyResults(
      [],
    );

    const canSearch =
      value.trim().length >= 2;

    setFamilySearchOpen(
      canSearch,
    );

    if (!canSearch) {
      setSearchingFamilies(
        false,
      );
    }

    setError(null);
  }

  function handleSelectFamily(
    family: FamilyGroup,
  ) {
    /*
     * Limpiamos el estado anterior antes
     * de establecer la nueva familia.
     */
    resetPaymentSelection();

    setSelectedFamily(
      family,
    );

    setFamilySearch(
      family.name,
    );

    setFamilyResults(
      [],
    );

    setFamilySearchOpen(
      false,
    );

    setSearchingFamilies(
      false,
    );

    setError(null);
  }

  function clearSelectedFamily() {
    setSelectedFamily(
      null,
    );

    setFamilySearch(
      '',
    );

    setFamilyResults(
      [],
    );

    setFamilySearchOpen(
      false,
    );

    setSearchingFamilies(
      false,
    );

    resetPaymentSelection();

    setError(null);
  }

  function handleIncludeApafaChange(
    checked: boolean,
  ) {
    setIncludeApafa(
      checked,
    );

    if (!checked) {
      setVouchers(
        (current) =>
          current.map(
            (voucher) => ({
              ...voucher,
              includeApafa: false,
            }),
          ),
      );
    }
  }

  function toggleStudent(
    studentId: string,
  ) {
    const removing =
      studentIds.includes(
        studentId,
      );

    setStudentIds(
      (current) =>
        removing
          ? current.filter(
              (id) =>
                id !==
                studentId,
            )
          : [
              ...current,
              studentId,
            ],
    );

    if (removing) {
      setVouchers(
        (current) =>
          current.map(
            (voucher) => ({
              ...voucher,
              studentIds:
                voucher.studentIds.filter(
                  (id) =>
                    id !==
                    studentId,
                ),
            }),
          ),
      );
    }
  }

  function handleVoucherChange(
    files:
      FileList | null,
  ) {
    setError(null);

    if (
      !files ||
      files.length === 0
    ) {
      return;
    }

    const selectedFiles =
      Array.from(files);

    const invalidFile =
      selectedFiles.find(
        (file) =>
          !isAllowedVoucher(
            file,
          ),
      );

    if (invalidFile) {
      setError(
        `El archivo "${invalidFile.name}" no tiene un formato permitido. Solo se admite PDF, JPG, PNG o WEBP.`,
      );

      return;
    }

    const oversizedFile =
      selectedFiles.find(
        (file) =>
          file.size >
          10 *
            1024 *
            1024,
      );

    if (oversizedFile) {
      setError(
        `El archivo "${oversizedFile.name}" supera el límite de 10 MB.`,
      );

      return;
    }

    setVouchers(
      (current) => {
        const existingKeys =
          new Set(
            current.map(
              (voucher) =>
                [
                  voucher.file.name,
                  voucher.file.size,
                  voucher.file.lastModified,
                ].join(':'),
            ),
          );

        const newFiles =
          selectedFiles.filter(
            (file) => {
              const key =
                [
                  file.name,
                  file.size,
                  file.lastModified,
                ].join(':');

              return !existingKeys.has(
                key,
              );
            },
          );

        if (
          current.length +
            newFiles.length >
          10
        ) {
          setError(
            'Puede adjuntar como máximo 10 vouchers por operación.',
          );

          return current;
        }

        return [
          ...current,
          ...newFiles.map(
            (file) => ({
              file,
              includeApafa: false,
              studentIds: [],
            }),
          ),
        ];
      },
    );
  }

  function removeVoucher(
    index: number,
  ) {
    setVouchers(
      (current) =>
        current.filter(
          (
            _,
            currentIndex,
          ) =>
            currentIndex !==
            index,
        ),
    );
  }

  function toggleVoucherApafa(
    index: number,
  ) {
    if (!includeApafa) {
      return;
    }

    setVouchers(
      (current) => {
        const selectedVoucher =
          current[index];

        if (
          !selectedVoucher
        ) {
          return current;
        }

        /*
        * Si ya está seleccionado
        * en este voucher,
        * permitimos desmarcarlo.
        */
        if (
          selectedVoucher
            .includeApafa
        ) {
          return current.map(
            (
              voucher,
              currentIndex,
            ) =>
              currentIndex ===
              index
                ? {
                    ...voucher,
                    includeApafa:
                      false,
                  }
                : voucher,
          );
        }

        /*
        * APAFA ya está respaldado
        * por otro voucher.
        */
        const alreadyAssigned =
          isApafaAssignedElsewhere(
            current,
            index,
          );

        if (
          alreadyAssigned
        ) {
          return current;
        }

        return current.map(
          (
            voucher,
            currentIndex,
          ) =>
            currentIndex ===
            index
              ? {
                  ...voucher,
                  includeApafa:
                    true,
                }
              : voucher,
        );
      },
    );
  }

  function toggleVoucherStudent(
    index: number,
    studentId: string,
  ) {
    if (
      !studentIds.includes(
        studentId,
      )
    ) {
      return;
    }

    setVouchers(
      (current) => {
        const selectedVoucher =
          current[index];

        if (
          !selectedVoucher
        ) {
          return current;
        }

        const currentlySelected =
          selectedVoucher
            .studentIds
            .includes(
              studentId,
            );

        /*
        * Siempre permitimos
        * quitar la asociación
        * del voucher actual.
        */
        if (
          currentlySelected
        ) {
          return current.map(
            (
              voucher,
              currentIndex,
            ) =>
              currentIndex ===
              index
                ? {
                    ...voucher,

                    studentIds:
                      voucher
                        .studentIds
                        .filter(
                          (id) =>
                            id !==
                            studentId,
                        ),
                  }
                : voucher,
          );
        }

        /*
        * El Taller ya está
        * respaldado por otro voucher.
        */
        const alreadyAssigned =
          isStudentAssignedElsewhere(
            current,
            studentId,
            index,
          );

        if (
          alreadyAssigned
        ) {
          return current;
        }

        return current.map(
          (
            voucher,
            currentIndex,
          ) =>
            currentIndex ===
            index
              ? {
                  ...voucher,

                  studentIds: [
                    ...voucher
                      .studentIds,

                    studentId,
                  ],
                }
              : voucher,
        );
      },
    );
  }

  function validateForm():
    | string
    | null {
    if (
      !schoolPeriodId
    ) {
      return 'Debe seleccionar un período escolar.';
    }

    if (
      !selectedFamily
    ) {
      return 'Debe buscar y seleccionar una familia.';
    }

    if (
      !paymentDate
    ) {
      return 'Debe ingresar la fecha del pago.';
    }

    if (
      !includeApafa &&
      studentIds.length ===
        0
    ) {
      return 'Debe seleccionar APAFA o al menos un Taller.';
    }

    if (
      vouchers.length ===
      0
    ) {
      return 'Debe adjuntar al menos un voucher.';
    }

    if (
      vouchers.some(
        (voucher) =>
          !voucher.includeApafa &&
          voucher.studentIds.length === 0,
      )
    ) {
      return 'Todo voucher debe estar asociado al menos a un concepto.';
    }

    const selectedStudentIds =
      new Set(studentIds);

    if (
      vouchers.some(
        (voucher) =>
          (!includeApafa && voucher.includeApafa) ||
          voucher.studentIds.some(
            (studentId) =>
              !selectedStudentIds.has(studentId),
          ),
      )
    ) {
      return 'Los conceptos asociados a vouchers deben coincidir con los conceptos seleccionados para pagar.';
    }

    /*
    * APAFA debe estar respaldado
    * exactamente por un voucher.
    */
    if (
      includeApafa
    ) {
      const apafaVoucherCount =
        vouchers.filter(
          (voucher) =>
            voucher
              .includeApafa,
        ).length;

      if (
        apafaVoucherCount ===
        0
      ) {
        return 'Debe asociar APAFA a uno de los vouchers adjuntos.';
      }

      if (
        apafaVoucherCount >
        1
      ) {
        return 'APAFA solo puede estar respaldado por un voucher.';
      }
    }

    /*
    * Cada Taller seleccionado debe
    * estar respaldado exactamente
    * por un voucher.
    */
    for (
      const studentId
      of studentIds
    ) {
      const voucherCount =
        vouchers.filter(
          (voucher) =>
            voucher
              .studentIds
              .includes(
                studentId,
              ),
        ).length;

      const student =
        paymentStatus
          ?.students
          .find(
            (item) =>
              item.studentId ===
              studentId,
          );

      const studentName =
        student?.fullName ??
        'el estudiante seleccionado';

      if (
        voucherCount ===
        0
      ) {
        return `Debe asociar el Taller de ${studentName} a uno de los vouchers adjuntos.`;
      }

      if (
        voucherCount >
        1
      ) {
        return `El Taller de ${studentName} solo puede estar respaldado por un voucher.`;
      }
    }

    return null;
  }

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError(null);

    const validationError =
      validateForm();

    if (
      validationError
    ) {
      setError(
        validationError,
      );

      return;
    }

    const family =
      selectedFamily;

    if (!family) {
      return;
    }

    try {
      setSaving(true);

      await createPayment({
        schoolPeriodId,

        familyGroupId:
          family.id,

        paymentDate,

        includeApafa,

        studentIds,

        operationNumber:
          operationNumber
            .trim(),

        observations:
          observations
            .trim(),

        vouchers:
          vouchers.map(
            (voucher) =>
              voucher.file,
          ),

        voucherAssociations:
          vouchers.map(
            (voucher) => ({
              includeApafa:
                voucher.includeApafa,
              studentIds:
                voucher.studentIds,
            }),
          ),
      });

      router.push(
        '/dashboard/payments',
      );

      router.refresh();
    } catch (error) {
      console.error(error);

      setError(
        getApiErrorMessage(
          error,
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  if (
    loadingOptions
  ) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">
          Cargando información
          necesaria para registrar
          el pago...
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          href="/dashboard/payments"
          className="text-sm font-medium text-red-800 transition hover:text-red-900"
        >
          ← Volver a pagos
        </Link>

        <h1 className="mt-3 text-3xl font-bold text-slate-900">
          Registrar pago
        </h1>

        <p className="mt-1 text-sm text-slate-600">
          Registra APAFA,
          Taller o ambos en una
          misma operación y
          adjunta el voucher como
          evidencia.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form
        onSubmit={
          handleSubmit
        }
        className="space-y-6"
      >
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Datos del pago
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Selecciona el período
              y busca la familia
              asociada al pago.
            </p>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
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
                onChange={(
                  event,
                ) =>
                  handlePeriodChange(
                    event.target.value,
                  )
                }
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-red-700 focus:ring-2 focus:ring-red-100"
              >
                <option value="">
                  Seleccione un período
                </option>

                {periods.map(
                  (period) => (
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

            <div
              ref={
                searchContainerRef
              }
              className="relative"
            >
              <label
                htmlFor="family-search"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Familia
              </label>

              <div className="relative">
                <input
                  id="family-search"
                  type="text"
                  autoComplete="off"
                  value={
                    familySearch
                  }
                  onFocus={() => {
                    if (
                      !selectedFamily &&
                      familySearch
                        .trim()
                        .length >= 2
                    ) {
                      setFamilySearchOpen(
                        true,
                      );
                    }
                  }}
                  onChange={(
                    event,
                  ) =>
                    handleFamilySearchChange(
                      event.target.value,
                    )
                  }
                  placeholder="DNI, nombre, apellido o código de familia"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 pr-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-red-700 focus:ring-2 focus:ring-red-100"
                />

                {selectedFamily && (
                  <button
                    type="button"
                    onClick={
                      clearSelectedFamily
                    }
                    aria-label="Quitar familia seleccionada"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  >
                    ×
                  </button>
                )}
              </div>

              {!selectedFamily &&
                familySearchOpen && (
                  <div className="absolute z-30 mt-2 max-h-96 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
                    {searchingFamilies ? (
                      <div className="px-4 py-4 text-sm text-slate-500">
                        Buscando familias...
                      </div>
                    ) : familyResults.length ===
                      0 ? (
                      <div className="px-4 py-4">
                        <p className="text-sm font-medium text-slate-700">
                          No se encontraron
                          familias.
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Prueba con DNI,
                          nombres,
                          apellidos o código
                          de familia.
                        </p>
                      </div>
                    ) : (
                      familyResults.map(
                        (family) => {
                          const guardian =
                            getGuardian(
                              family,
                            );

                          const father =
                            getFather(
                              family,
                            );

                          const mother =
                            getMother(
                              family,
                            );

                          return (
                            <button
                              key={
                                family.id
                              }
                              type="button"
                              onClick={() =>
                                handleSelectFamily(
                                  family,
                                )
                              }
                              className="block w-full border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-red-50"
                            >
                              {guardian ? (
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">
                                    {
                                      guardian.fullName
                                    }
                                  </p>

                                  <p className="mt-0.5 text-xs font-medium text-red-800">
                                    Apoderado
                                    {' · '}
                                    {getDocumentLabel(
                                      guardian.documentType,
                                      guardian.documentNumber,
                                    )}
                                  </p>
                                </div>
                              ) : (
                                <p className="text-sm font-semibold text-slate-900">
                                  {
                                    family.name
                                  }
                                </p>
                              )}

                              <div className="mt-2 space-y-0.5 text-xs text-slate-600">
                                {father &&
                                  father.personId !==
                                    guardian
                                      ?.personId && (
                                    <p>
                                      <span className="font-medium">
                                        Padre:
                                      </span>{' '}
                                      {
                                        father.fullName
                                      }
                                    </p>
                                  )}

                                {mother &&
                                  mother.personId !==
                                    guardian
                                      ?.personId && (
                                    <p>
                                      <span className="font-medium">
                                        Madre:
                                      </span>{' '}
                                      {
                                        mother.fullName
                                      }
                                    </p>
                                  )}
                              </div>

                              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                                <span>
                                  {
                                    family.name
                                  }
                                </span>

                                <span>
                                  ·
                                </span>

                                <span>
                                  {family.code ??
                                    'Sin código'}
                                </span>
                              </div>
                            </button>
                          );
                        },
                      )
                    )}
                  </div>
                )}

              {!selectedFamily && (
                <p className="mt-2 text-xs text-slate-500">
                  Escribe al menos
                  2 caracteres.
                  Puedes buscar por
                  DNI, nombres,
                  apellidos o código.
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="payment-date"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Fecha del pago
              </label>

              <input
                id="payment-date"
                type="date"
                value={
                  paymentDate
                }
                onChange={(
                  event,
                ) =>
                  setPaymentDate(
                    event.target.value,
                  )
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-red-700 focus:ring-2 focus:ring-red-100"
              />
            </div>

            <div>
              <label
                htmlFor="operation-number"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Número de operación
              </label>

              <input
                id="operation-number"
                type="text"
                maxLength={100}
                value={
                  operationNumber
                }
                onChange={(
                  event,
                ) =>
                  setOperationNumber(
                    event.target.value,
                  )
                }
                placeholder="Opcional"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-red-700 focus:ring-2 focus:ring-red-100"
              />
            </div>
          </div>

          {(selectedFamily ||
            selectedPeriod) && (
            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                {selectedPeriod && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Período
                    </p>

                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {
                        selectedPeriod.year
                      }
                      {' - '}
                      {getSchoolPeriodStatusLabel(
                        selectedPeriod.status,
                      )}
                    </p>
                  </div>
                )}

                {selectedFamily && (
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Familia seleccionada
                        </p>

                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {
                            selectedFamily.name
                          }
                        </p>

                        <p className="mt-0.5 text-xs text-slate-500">
                          {selectedFamily.code ??
                            'Sin código'}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={
                          clearSelectedFamily
                        }
                        className="text-xs font-medium text-red-800 transition hover:text-red-900"
                      >
                        Cambiar
                      </button>
                    </div>

                    {selectedGuardian && (
                      <div className="mt-3 rounded-md bg-white p-3">
                        <p className="text-xs font-medium text-slate-500">
                          Apoderado
                        </p>

                        <p className="mt-1 text-sm font-medium text-slate-900">
                          {
                            selectedGuardian.fullName
                          }
                        </p>

                        <p className="mt-0.5 text-xs text-slate-500">
                          {getDocumentLabel(
                            selectedGuardian.documentType,
                            selectedGuardian.documentNumber,
                          )}
                        </p>
                      </div>
                    )}

                    {(selectedFather ||
                      selectedMother) && (
                      <div className="mt-3 space-y-1 text-xs text-slate-600">
                        {selectedFather &&
                          selectedFather.personId !==
                            selectedGuardian
                              ?.personId && (
                            <p>
                              <span className="font-medium">
                                Padre:
                              </span>{' '}
                              {
                                selectedFather.fullName
                              }
                            </p>
                          )}

                        {selectedMother &&
                          selectedMother.personId !==
                            selectedGuardian
                              ?.personId && (
                            <p>
                              <span className="font-medium">
                                Madre:
                              </span>{' '}
                              {
                                selectedMother.fullName
                              }
                            </p>
                          )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Conceptos
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              El estado mostrado
              corresponde al período
              y familia seleccionados.
            </p>
          </div>

          {!schoolPeriodId ||
          !selectedFamily ? (
            <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              Seleccione un período
              escolar y busque una
              familia para consultar
              APAFA y Taller.
            </div>
          ) : loadingStatus ? (
            <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              Consultando estado
              de pagos...
            </div>
          ) : paymentStatus ? (
            <div className="mt-5 space-y-6">
              <div className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900">
                        APAFA
                      </h3>

                      {paymentStatus
                        .apafa
                        .status ===
                      'PAGADO' ? (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                          PAGADO
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                          NO PAGADO
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-sm text-slate-500">
                      APAFA se
                      registra una
                      sola vez por
                      familia para
                      cada período.
                    </p>
                  </div>

                  {paymentStatus
                    .apafa
                    .status ===
                  'NO_PAGADO' && (
                    <label className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={
                          includeApafa
                        }
                        onChange={(
                          event,
                        ) =>
                          handleIncludeApafaChange(
                            event
                              .target
                              .checked,
                          )
                        }
                        className="h-4 w-4 rounded border-slate-300"
                      />

                      Incluir APAFA
                    </label>
                  )}
                </div>
              </div>

              <div>
                <div>
                  <h3 className="font-semibold text-slate-900">
                    Taller
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Taller se controla
                    de manera
                    independiente por
                    cada estudiante
                    matriculado.
                  </p>
                </div>

                <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
                  {paymentStatus
                    .students
                    .length ===
                  0 ? (
                    <div className="p-5 text-sm text-slate-500">
                      La familia no
                      tiene estudiantes
                      registrados.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-200">
                      {paymentStatus.students.map(
                        (
                          student,
                        ) => {
                          const paid =
                            student
                              .taller
                              .status ===
                            'PAGADO';

                          const canPay =
                            student
                              .enrolledInPeriod &&
                            !paid;

                          const selected =
                            studentIds.includes(
                              student.studentId,
                            );

                          return (
                            <div
                              key={
                                student.studentId
                              }
                              className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div>
                                <div className="font-medium text-slate-900">
                                  {
                                    student.fullName
                                  }
                                </div>

                                {student.enrollment && (
                                  <p className="mt-1 text-xs text-slate-500">
                                    {student.enrollment.classroom.level.cycle.name}
                                    {' / '}
                                    {student.enrollment.classroom.level.name}
                                    {' · '}
                                    {student.enrollment.classroom.name}
                                    {' · '}
                                    {student.enrollment.classroom.shift.name}
                                  </p>
                                )}

                                <div className="mt-1 flex flex-wrap gap-2">
                                  {student.enrolledInPeriod ? (
                                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                                      Matriculado
                                    </span>
                                  ) : (
                                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                                      Sin matrícula
                                      en el período
                                    </span>
                                  )}

                                  {paid ? (
                                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                                      Taller PAGADO
                                    </span>
                                  ) : (
                                    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
                                      Taller NO PAGADO
                                    </span>
                                  )}
                                </div>
                              </div>

                              {canPay ? (
                                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
                                  <input
                                    type="checkbox"
                                    checked={
                                      selected
                                    }
                                    onChange={() =>
                                      toggleStudent(
                                        student.studentId,
                                      )
                                    }
                                    className="h-4 w-4 rounded border-slate-300"
                                  />

                                  Incluir Taller
                                </label>
                              ) : (
                                <span className="text-sm text-slate-400">
                                  No disponible
                                </span>
                              )}
                            </div>
                          );
                        },
                      )}
                    </div>
                  )}
                </div>

                {paymentStatus
                  .students
                  .length >
                  0 &&
                  payableStudents.length ===
                    0 && (
                    <p className="mt-3 text-sm text-slate-500">
                      No existen
                      estudiantes con
                      Taller pendiente
                      y matrícula
                      disponible para
                      este período.
                    </p>
                  )}
              </div>
            </div>
          ) : null}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Voucher
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Todo registro de pago
              debe tener al menos una
              evidencia.
            </p>
          </div>

          <div className="mt-5">
            <label
              htmlFor="vouchers"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Adjuntar vouchers
            </label>

            <input
              id="vouchers"
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
              onChange={(
                event,
              ) => {
                handleVoucherChange(
                  event.target.files,
                );

                event.currentTarget.value =
                  '';
              }}
              className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-4 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
            />

            <p className="mt-2 text-xs text-slate-500">
              Puede seleccionar varios archivos
              al mismo tiempo o agregarlos en
              varias selecciones. Formatos
              permitidos: PDF, JPG, PNG y WEBP.
              Máximo 10 archivos y 10 MB por
              archivo.
            </p>

            {vouchers.length >
              0 && (
              <div className="mt-4 space-y-4">
                <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  Indica qué conceptos respalda cada voucher. Si no seleccionas ningún concepto, el archivo quedará como evidencia general.
                </div>

                {vouchers.map(
                  (
                    voucher,
                    index,
                  ) => {
                    const isEmpty =
                      !voucher.includeApafa &&
                      voucher.studentIds.length ===
                        0;

                    const apafaAssignedElsewhere =
                      isApafaAssignedElsewhere(
                        vouchers,
                        index,
                      );

                    return (
                      <div
                        key={`${voucher.file.name}-${voucher.file.size}-${index}`}
                        className="rounded-lg border border-slate-200 bg-white p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-900">
                              {
                                voucher.file.name
                              }
                            </div>

                            <div className="mt-1 text-xs text-slate-500">
                              {(
                                voucher.file.size /
                                1024 /
                                1024
                              ).toFixed(
                                2,
                              )}{' '}
                              MB
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              removeVoucher(
                                index,
                              )
                            }
                            className="shrink-0 text-sm font-medium text-red-600 transition hover:text-red-700"
                          >
                            Quitar
                          </button>
                        </div>

                        <div className="mt-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium text-slate-700">
                              Conceptos respaldados
                            </p>

                            {isEmpty && (
                              <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
                                Falta asociar un concepto
                              </span>
                            )}
                          </div>

                          <div className="mt-3 space-y-2">
                            {includeApafa && (
                              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={
                                    voucher.includeApafa
                                  }
                                  disabled={
                                    !voucher.includeApafa &&
                                    apafaAssignedElsewhere
                                  }
                                  onChange={() =>
                                    toggleVoucherApafa(
                                      index,
                                    )
                                  }
                                  className="h-4 w-4 rounded border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                                />
                                APAFA
                              </label>
                            )}

                            {studentIds.map(
                              (studentId) => {
                                const student =
                                  paymentStatus?.students.find(
                                    (item) =>
                                      item.studentId ===
                                      studentId,
                                  );

                                const studentAssignedElsewhere =
                                  isStudentAssignedElsewhere(
                                    vouchers,
                                    studentId,
                                    index,
                                  );

                                if (!student) {
                                  return null;
                                }

                                return (
                                  <label
                                    key={
                                      studentId
                                    }
                                    className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={
                                        voucher.studentIds.includes(
                                          studentId,
                                        )
                                      }
                                      disabled={
                                        !voucher.studentIds.includes(
                                          studentId,
                                        ) &&
                                        studentAssignedElsewhere
                                      }
                                      onChange={() =>
                                        toggleVoucherStudent(
                                          index,
                                          studentId,
                                        )
                                      }
                                      className="h-4 w-4 rounded border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                                    />

                                    Taller -{' '}
                                    {
                                      student.fullName
                                    }
                                  </label>
                                );
                              },
                            )}

                            {!includeApafa &&
                              studentIds.length ===
                                0 && (
                                <p className="text-xs text-slate-500">
                                  Primero selecciona APAFA o uno o más Talleres en la sección anterior para poder asociarlos a este voucher.
                                </p>
                              )}
                          </div>
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Observaciones
          </h2>

          <div className="mt-4">
            <label
              htmlFor="observations"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Observación del registro
            </label>

            <textarea
              id="observations"
              rows={4}
              value={
                observations
              }
              onChange={(
                event,
              ) =>
                setObservations(
                  event.target.value,
                )
              }
              placeholder="Opcional"
              className="w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-red-700 focus:ring-2 focus:ring-red-100"
            />
          </div>
        </section>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link
            href="/dashboard/payments"
            className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Cancelar
          </Link>

          <button
            type="submit"
            disabled={
              saving ||
              loadingStatus
            }
            className="inline-flex items-center justify-center rounded-md bg-red-800 px-5 py-2 text-sm font-medium text-white transition hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? 'Registrando...'
              : 'Registrar pago'}
          </button>
        </div>
      </form>
    </div>
  );
}
