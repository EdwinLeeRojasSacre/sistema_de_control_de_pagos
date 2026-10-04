'use client';

import {
  useEffect,
  useState,
} from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

import {
  getFamilyGroupById,
  lookupPersonByDocument,
  updateFamilyGroup,
} from '@/services/family-groups.service';
import { getStudentEnrollments } from '@/services/enrollments.service';
import type { Enrollment } from '@/types/enrollments';

import type {
  FamilyGroupDetail,
  FamilyGroupMember,
} from '@/services/family-groups.service';

import type {
  UpdateFamilyGroupRequest,
  UpdateFamilyGroupStudentRequest,
  UpdateFamilyGroupAdultRequest,
} from '@/types/family-groups';

interface StudentForm {
  studentId: string;
  enrollments: Enrollment[];
  memberId: string;
  documentType: string;
  documentNumber: string;
  firstName: string;
  lastNameFather: string;
  lastNameMother: string;
  birthDate: string;
}

interface AdultForm {
  memberId: string;
  documentType: string;
  documentNumber: string;
  firstName: string;
  lastNameFather: string;
  lastNameMother: string;
  birthDate: string;
  phone: string;
  email: string;
  address: string;
  relationshipType: string;
  isGuardian: boolean;
}

function formatDateForInput(
  value: string | null,
): string {
  if (!value) {
    return '';
  }

  return value.slice(0, 10);
}

function getApiErrorMessage(
  error: unknown,
): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error
  ) {
    const response = (
      error as {
        response?: {
          status?: number;
          data?: {
            message?: string | string[];
          };
        };
      }
    ).response;

    const message =
      response?.data?.message;

    if (Array.isArray(message)) {
      return message.join(', ');
    }

    if (typeof message === 'string') {
      return message;
    }

    if (response?.status === 409) {
      return 'La modificación no puede realizarse porque genera un conflicto con los datos existentes.';
    }

    if (response?.status === 400) {
      return 'Los datos enviados no son válidos. Verifica la información ingresada.';
    }

    if (response?.status === 403) {
      return 'No tienes permisos para modificar esta familia.';
    }
  }

  return 'No se pudo modificar la familia.';
}

function isStudentMember(
  member: FamilyGroupMember,
): boolean {
  return (
    member.relationship === 'ESTUDIANTE' ||
    member.relationship === 'ALUMNO' ||
    member.relationship === 'ESTUDIANTE / HIJO'
  );
}

const RELATIONSHIP_LABELS = {
  PADRE: 'Padre',
  MADRE: 'Madre',
  PADRASTRO: 'Padrastro',
  MADRASTRA: 'Madrastra',
  ABUELO: 'Abuelo',
  ABUELA: 'Abuela',
  HERMANO: 'Hermano',
  HERMANA: 'Hermana',
  TIO: 'Tío',
  TIA: 'Tía',
  OTRO: 'Otro',
} as const;

export default function EditFamilyGroupPage() {
  const params = useParams();
  const router = useRouter();

  const id =
    typeof params.id === 'string'
      ? params.id
      : '';

  const [family, setFamily] =
    useState<FamilyGroupDetail | null>(
      null,
    );

  const [students, setStudents] =
    useState<StudentForm[]>([]);

  const [adults, setAdults] =
    useState<AdultForm[]>([]);

  const [observations, setObservations] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [success, setSuccess] =
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
          setLoading(true);
          setError(null);

          const familyData =
            await getFamilyGroupById(id);

          setFamily(familyData);
          setObservations(
            familyData.observations ?? '',
          );

          const studentMembers =
            familyData.members.filter(
              isStudentMember,
            );

          const adultMembers =
            familyData.members.filter(
              (member) =>
                !isStudentMember(member),
            );

          const studentResults =
            await Promise.all(
              studentMembers.map(
                async (member) => {
                  const person =
                    await lookupPersonByDocument(
                      member.documentType,
                      member.documentNumber ?? '',
                    );

                  const enrollments = person.student
                    ? await getStudentEnrollments(person.student.id)
                    : [];

                  return {
                    member,
                    person:
                      person.person,
                    studentId: person.student?.id ?? '',
                    enrollments,
                  };
                },
              ),
            );

          const adultResults =
            await Promise.all(
              adultMembers.map(
                async (member) => {
                  const person =
                    await lookupPersonByDocument(
                      member.documentType,
                      member.documentNumber ?? '',
                    );

                  return {
                    member,
                    person:
                      person.person,
                  };
                },
              ),
            );

          setStudents(
            studentResults.map(
              ({ member, person, studentId, enrollments }) => ({
                studentId,
                enrollments,
                memberId: member.id,
                documentType:
                  member.documentType,
                documentNumber:
                  member.documentNumber ?? '',
                firstName:
                  person?.firstName ?? '',
                lastNameFather:
                  person?.lastNameFather ?? '',
                lastNameMother:
                  person?.lastNameMother ?? '',
                birthDate:
                  formatDateForInput(
                    person?.birthDate ?? null,
                  ),
              }),
            ),
          );

          setAdults(
            adultResults.map(
              ({ member, person }) => ({
                memberId: member.id,
                documentType:
                  member.documentType,
                documentNumber:
                  member.documentNumber ?? '',
                firstName:
                  person?.firstName ?? '',
                lastNameFather:
                  person?.lastNameFather ?? '',
                lastNameMother:
                  person?.lastNameMother ?? '',
                birthDate:
                  formatDateForInput(
                    person?.birthDate ?? null,
                  ),
                phone:
                  person?.phone ?? '',
                email:
                  person?.email ?? '',
                address:
                  person?.address ?? '',
                relationshipType:
                  member.relationship,
                isGuardian:
                  member.isGuardian,
              }),
            ),
          );
        } catch (error) {
          console.error(error);

          setError(
            'No se pudo cargar la información de la familia para modificarla.',
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

  function updateStudent(
    index: number,
    field: keyof StudentForm,
    value: string,
  ) {
    setStudents((current) =>
      current.map((student, currentIndex) =>
        currentIndex === index
          ? {
              ...student,
              [field]: value,
            }
          : student,
      ),
    );
  }

  function updateAdult(
    index: number,
    field: keyof AdultForm,
    value: string | boolean,
  ) {
    setAdults((current) =>
      current.map((adult, currentIndex) =>
        currentIndex === index
          ? {
              ...adult,
              [field]: value,
            }
          : adult,
      ),
    );
  }

  function handleGuardianChange(
    index: number,
  ) {
    setAdults((current) =>
      current.map((adult, currentIndex) => ({
        ...adult,
        isGuardian:
          currentIndex === index,
      })),
    );
  }

  function validateForm(): string | null {
    if (students.length === 0) {
      return 'La familia debe tener al menos un estudiante.';
    }

    if (adults.length === 0) {
      return 'La familia debe tener al menos un adulto.';
    }

    const guardians =
      adults.filter(
        (adult) => adult.isGuardian,
      );

    if (guardians.length !== 1) {
      return 'Debe existir exactamente un apoderado activo.';
    }

    const fathers =
      adults.filter(
        (adult) =>
          adult.relationshipType ===
          'PADRE',
      );

    if (fathers.length > 1) {
      return 'Solo puede existir un PADRE dentro de la familia.';
    }

    const mothers =
      adults.filter(
        (adult) =>
          adult.relationshipType ===
          'MADRE',
      );

    if (mothers.length > 1) {
      return 'Solo puede existir una MADRE dentro de la familia.';
    }

    for (const student of students) {
      if (
        !student.firstName.trim() ||
        !student.lastNameFather.trim() ||
        !student.lastNameMother.trim()
      ) {
        return 'Todos los estudiantes deben tener nombres y apellidos completos.';
      }

      if (!student.birthDate) {
        return 'Todos los estudiantes deben tener fecha de nacimiento.';
      }
    }

    for (const adult of adults) {
      if (
        !adult.firstName.trim()
      ) {
        return 'Todos los integrantes adultos deben tener nombres.';
      }

      if (
        adult.isGuardian &&
        !adult.birthDate
      ) {
        return 'El apoderado debe tener fecha de nacimiento.';
      }

      if (!adult.relationshipType) {
        return 'Todos los integrantes adultos deben tener una relación definida.';
      }
    }

    return null;
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError(null);
    setSuccess(null);

    const validationError =
      validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    if (!id) {
      setError(
        'El identificador de la familia no es válido.',
      );
      return;
    }

    const requestStudents: UpdateFamilyGroupStudentRequest[] =
      students.map((student) => ({
        memberId: student.memberId,
        firstName:
          student.firstName.trim(),
        lastNameFather:
          student.lastNameFather.trim(),
        lastNameMother:
          student.lastNameMother.trim(),
        birthDate:
          student.birthDate,
      }));

    const requestAdults: UpdateFamilyGroupAdultRequest[] =
      adults.map((adult) => ({
        memberId: adult.memberId,
        documentType:
          adult.documentType.trim(),
        documentNumber:
          adult.documentNumber.trim(),
        firstName:
          adult.firstName.trim(),
        lastNameFather:
          adult.lastNameFather.trim() ||
          undefined,
        lastNameMother:
          adult.lastNameMother.trim() ||
          undefined,
        birthDate:
          adult.birthDate ||
          undefined,
        phone:
          adult.phone.trim() ||
          undefined,
        email:
          adult.email.trim() ||
          undefined,
        address:
          adult.address.trim() ||
          undefined,
        relationshipType:
          adult.relationshipType,
        isGuardian:
          adult.isGuardian,
      }));

    const request: UpdateFamilyGroupRequest =
      {
        observations:
          observations.trim() ||
          undefined,
        students:
          requestStudents,
        adults:
          requestAdults,
      };

    try {
      setSaving(true);

      await updateFamilyGroup(
        id,
        request,
      );

      setSuccess(
        'Los cambios de la familia se guardaron correctamente.',
      );

      window.setTimeout(() => {
        router.push(
          `/dashboard/family-groups/${id}`,
        );
      }, 700);
    } catch (error) {
      console.error(error);

      setError(
        getApiErrorMessage(error),
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">
          Cargando información de la
          familia...
        </p>
      </div>
    );
  }

  if (error && !family) {
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
          No se encontró la familia.
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
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-slate-900">
              Modificar familia
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
            {family.code ??
              'Familia sin código'}
          </p>
        </div>

        <Link
          href={`/dashboard/family-groups/${family.id}`}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
        >
          Cancelar
        </Link>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-6"
      >
        {/* ESTUDIANTES */}

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Estudiantes
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Los estudiantes pertenecen
              permanentemente al registro
              familiar. La modificación no
              permite reasignarlos desde este
              formulario.
            </p>
          </div>

          <div className="space-y-6 p-6">
            {students.map(
              (student, index) => (
                <div
                  key={student.memberId}
                  className="rounded-md border border-slate-200 p-5"
                >
                  <div className="mb-5 flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900">
                      Estudiante{' '}
                      {index + 1}
                    </h3>

                    <span className="text-sm text-slate-500">
                      {student.documentType}{' '}
                      ·{' '}
                      {student.documentNumber ||
                        'Sin documento'}
                    </span>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label
                        htmlFor={`student-first-${index}`}
                        className="mb-2 block text-sm font-medium text-slate-700"
                      >
                        Nombres
                      </label>

                      <input
                        id={`student-first-${index}`}
                        value={
                          student.firstName
                        }
                        onChange={(event) =>
                          updateStudent(
                            index,
                            'firstName',
                            event.target.value,
                          )
                        }
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-red-700 focus:ring-2 focus:ring-red-100"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`student-birth-${index}`}
                        className="mb-2 block text-sm font-medium text-slate-700"
                      >
                        Fecha de nacimiento
                      </label>

                      <input
                        id={`student-birth-${index}`}
                        type="date"
                        value={
                          student.birthDate
                        }
                        onChange={(event) =>
                          updateStudent(
                            index,
                            'birthDate',
                            event.target.value,
                          )
                        }
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-red-700 focus:ring-2 focus:ring-red-100"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`student-father-${index}`}
                        className="mb-2 block text-sm font-medium text-slate-700"
                      >
                        Apellido paterno
                      </label>

                      <input
                        id={`student-father-${index}`}
                        value={
                          student.lastNameFather
                        }
                        onChange={(event) =>
                          updateStudent(
                            index,
                            'lastNameFather',
                            event.target.value,
                          )
                        }
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-red-700 focus:ring-2 focus:ring-red-100"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`student-mother-${index}`}
                        className="mb-2 block text-sm font-medium text-slate-700"
                      >
                        Apellido materno
                      </label>

                      <input
                        id={`student-mother-${index}`}
                        value={
                          student.lastNameMother
                        }
                        onChange={(event) =>
                          updateStudent(
                            index,
                            'lastNameMother',
                            event.target.value,
                          )
                        }
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-red-700 focus:ring-2 focus:ring-red-100"
                      />
                    </div>
                  </div>

                  <div className="mt-5 border-t border-slate-200 pt-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h4 className="font-semibold text-slate-900">Matrícula actual e historial</h4>
                      {student.enrollments.length === 0 && student.studentId && (
                        <Link className="rounded-md bg-sky-700 px-3 py-2 text-sm font-semibold text-white" href={`/dashboard/enrollments/new?studentId=${encodeURIComponent(student.studentId)}`}>
                          Matricular estudiante
                        </Link>
                      )}
                    </div>
                    {student.enrollments.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {student.enrollments.map((enrollment) => (
                          <div key={enrollment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2 text-sm">
                            <span>{enrollment.schoolPeriod.year} · {enrollment.classroom.educationLevel.name} · {enrollment.classroom.name} · {enrollment.classroom.shift.name}</span>
                            <Link className="font-semibold text-sky-700 hover:underline" href={`/dashboard/enrollments/${enrollment.id}`}>
                              {enrollment.canChangeClassroom ? 'Cambiar aula' : 'Ver historial'}
                            </Link>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-amber-700">El estudiante aún no tiene matrículas registradas.</p>
                    )}
                  </div>
                </div>
              ),
            )}
          </div>
        </section>

        {/* ADULTOS */}

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Integrantes adultos
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Se puede actualizar la
              información personal, relación
              familiar y apoderado.
            </p>
          </div>

          <div className="space-y-6 p-6">
            {adults.map(
              (adult, index) => (
                <div
                  key={adult.memberId}
                  className="rounded-md border border-slate-200 p-5"
                >
                  <div className="mb-5 flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900">
                      Integrante{' '}
                      {index + 1}
                    </h3>

                    {adult.isGuardian && (
                      <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-800">
                        Apoderado
                      </span>
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label
                        htmlFor={`adult-document-type-${index}`}
                        className="mb-2 block text-sm font-medium text-slate-700"
                      >
                        Tipo de documento
                      </label>

                      <input
                        id={`adult-document-type-${index}`}
                        value={
                          adult.documentType
                        }
                        disabled
                        className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-slate-600"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`adult-document-${index}`}
                        className="mb-2 block text-sm font-medium text-slate-700"
                      >
                        Número de documento
                      </label>

                      <input
                        id={`adult-document-${index}`}
                        value={
                          adult.documentNumber
                        }
                        disabled
                        className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-slate-600"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`adult-first-${index}`}
                        className="mb-2 block text-sm font-medium text-slate-700"
                      >
                        Nombres
                      </label>

                      <input
                        id={`adult-first-${index}`}
                        value={
                          adult.firstName
                        }
                        onChange={(event) =>
                          updateAdult(
                            index,
                            'firstName',
                            event.target.value,
                          )
                        }
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-red-700 focus:ring-2 focus:ring-red-100"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`adult-birth-${index}`}
                        className="mb-2 block text-sm font-medium text-slate-700"
                      >
                        Fecha de nacimiento
                      </label>

                      <input
                        id={`adult-birth-${index}`}
                        type="date"
                        value={
                          adult.birthDate
                        }
                        onChange={(event) =>
                          updateAdult(
                            index,
                            'birthDate',
                            event.target.value,
                          )
                        }
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-red-700 focus:ring-2 focus:ring-red-100"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`adult-father-${index}`}
                        className="mb-2 block text-sm font-medium text-slate-700"
                      >
                        Apellido paterno
                      </label>

                      <input
                        id={`adult-father-${index}`}
                        value={
                          adult.lastNameFather
                        }
                        onChange={(event) =>
                          updateAdult(
                            index,
                            'lastNameFather',
                            event.target.value,
                          )
                        }
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-red-700 focus:ring-2 focus:ring-red-100"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`adult-mother-${index}`}
                        className="mb-2 block text-sm font-medium text-slate-700"
                      >
                        Apellido materno
                      </label>

                      <input
                        id={`adult-mother-${index}`}
                        value={
                          adult.lastNameMother
                        }
                        onChange={(event) =>
                          updateAdult(
                            index,
                            'lastNameMother',
                            event.target.value,
                          )
                        }
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-red-700 focus:ring-2 focus:ring-red-100"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`adult-relationship-${index}`}
                        className="mb-2 block text-sm font-medium text-slate-700"
                      >
                        Relación
                      </label>

                      <select
                        id={`adult-relationship-${index}`}
                        value={
                          adult.relationshipType
                        }
                        onChange={(event) =>
                          updateAdult(
                            index,
                            'relationshipType',
                            event.target.value,
                          )
                        }
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-red-700 focus:ring-2 focus:ring-red-100"
                      >
                        {Object.entries(
                          RELATIONSHIP_LABELS,
                        ).map(
                          ([
                            code,
                            label,
                          ]) => (
                            <option
                              key={code}
                              value={code}
                            >
                              {label}
                            </option>
                          ),
                        )}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor={`adult-phone-${index}`}
                        className="mb-2 block text-sm font-medium text-slate-700"
                      >
                        Teléfono
                      </label>

                      <input
                        id={`adult-phone-${index}`}
                        value={
                          adult.phone
                        }
                        onChange={(event) =>
                          updateAdult(
                            index,
                            'phone',
                            event.target.value,
                          )
                        }
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-red-700 focus:ring-2 focus:ring-red-100"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`adult-email-${index}`}
                        className="mb-2 block text-sm font-medium text-slate-700"
                      >
                        Correo electrónico
                      </label>

                      <input
                        id={`adult-email-${index}`}
                        type="email"
                        value={
                          adult.email
                        }
                        onChange={(event) =>
                          updateAdult(
                            index,
                            'email',
                            event.target.value,
                          )
                        }
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-red-700 focus:ring-2 focus:ring-red-100"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label
                        htmlFor={`adult-address-${index}`}
                        className="mb-2 block text-sm font-medium text-slate-700"
                      >
                        Dirección
                      </label>

                      <input
                        id={`adult-address-${index}`}
                        value={
                          adult.address
                        }
                        onChange={(event) =>
                          updateAdult(
                            index,
                            'address',
                            event.target.value,
                          )
                        }
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-red-700 focus:ring-2 focus:ring-red-100"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="flex cursor-pointer items-center gap-3">
                        <input
                          type="radio"
                          name="guardian"
                          checked={
                            adult.isGuardian
                          }
                          onChange={() =>
                            handleGuardianChange(
                              index,
                            )
                          }
                          className="h-4 w-4"
                        />

                        <span className="text-sm font-medium text-slate-700">
                          Es apoderado
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              ),
            )}
          </div>
        </section>

        {/* OBSERVACIONES */}

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">
            Observaciones
          </h2>

          <textarea
            value={observations}
            onChange={(event) =>
              setObservations(
                event.target.value,
              )
            }
            rows={5}
            maxLength={1000}
            placeholder="Ingrese observaciones relacionadas con la familia..."
            className="w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-red-700 focus:ring-2 focus:ring-red-100"
          />

          <p className="mt-2 text-right text-xs text-slate-400">
            {observations.length}/1000
          </p>
        </section>

        {/* ACTIONS */}

        <div className="flex justify-end gap-3">
          <Link
            href={`/dashboard/family-groups/${family.id}`}
            className="rounded-md border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Cancelar
          </Link>

          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-red-800 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? 'Guardando...'
              : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  );
}
