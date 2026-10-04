'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

import {
  createFamilyGroup,
  getFamilyGroupCreateOptions,
  lookupPersonByDocument,
} from '@/services/family-groups.service';

import type {
  AdultForm,
  FamilyGroupCreateOptions,
  PersonLookupResponse,
  StudentForm,
} from '@/types/family-groups';

const createEmptyAdult = (
  relationshipType: string,
): AdultForm => ({
  documentType: 'DNI',
  documentNumber: '',
  firstName: '',
  lastNameFather: '',
  lastNameMother: '',
  birthDate: '',
  phone: '',
  email: '',
  address: '',
  relationshipType,
  isGuardian: false,
});

const createEmptyStudent = (): StudentForm => ({
  educationLevelId: '',
  classroomId: '',
  documentType: 'DNI',
  documentNumber: '',
  firstName: '',
  lastNameFather: '',
  lastNameMother: '',
  birthDate: '',
});

type LookupStatus =
  | 'idle'
  | 'searching'
  | 'found'
  | 'not-found'
  | 'error';

interface LookupState {
  status: LookupStatus;
  data: PersonLookupResponse | null;
  documentKey: string;
  message: string | null;
}

const emptyLookupState = (): LookupState => ({
  status: 'idle',
  data: null,
  documentKey: '',
  message: null,
});

export default function NewFamilyGroupPage() {
  const router = useRouter();

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [options, setOptions] =
    useState<FamilyGroupCreateOptions | null>(
      null,
    );

  const [error, setError] =
    useState<string | null>(null);

  interface FamilyFormState {
    schoolPeriodId: string;
    observations: string;
    adults: AdultForm[];
    students: StudentForm[];
  }

  const [form, setForm] =
    useState<FamilyFormState>({
      schoolPeriodId: '',
      observations: '',
      students: [createEmptyStudent()],
      adults: [],
    });

  /*
   * Estado de búsqueda de personas.
   *
   * Se mantiene por índice porque AdultForm y StudentForm
   * actualmente no tienen un identificador de UI propio.
   */
  const [adultLookups, setAdultLookups] =
    useState<Record<number, LookupState>>({});

  const [studentLookups, setStudentLookups] =
    useState<Record<number, LookupState>>({});

  /*
   * Permite invalidar respuestas de búsquedas anteriores.
   *
   * Ejemplo:
   * DNI A -> búsqueda
   * usuario cambia a DNI B
   * DNI A responde después
   *
   * La respuesta A no debe modificar el formulario.
   */
  const adultLookupKeys =
    useRef<Record<number, string>>({});

  const studentLookupKeys =
    useRef<Record<number, string>>({});

  useEffect(() => {
    async function loadData() {
      try {
        const data =
          await getFamilyGroupCreateOptions();

        setOptions(data);

        /*
         * El backend devuelve los periodos activos
         * ordenados desde el más reciente.
         *
         * El primero corresponde al periodo operativo
         * que debe aparecer inicialmente.
         */
        if (data.schoolPeriods.length > 0) {
          setForm((current) => ({
            ...current,
            schoolPeriodId:
              data.schoolPeriods[0].id,
          }));
        }
      } catch (loadError) {
        console.error(loadError);

        setError(
          'No fue posible cargar la información necesaria para registrar la familia.',
        );
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, []);

  const otherRelationshipTypes =
    useMemo(() => {
      if (!options) {
        return [];
      }

      return options.relationshipTypes.filter(
        (relationship) =>
          relationship.code !== 'PADRE' &&
          relationship.code !== 'MADRE',
      );
    }, [options]);

  const father =
    form.adults.find(
      (adult) =>
        adult.relationshipType === 'PADRE',
    ) ?? null;

  const mother =
    form.adults.find(
      (adult) =>
        adult.relationshipType === 'MADRE',
    ) ?? null;

  const otherAdults =
    form.adults.filter(
      (adult) =>
        adult.relationshipType !== 'PADRE' &&
        adult.relationshipType !== 'MADRE',
    );

  const guardianCount =
    form.adults.filter(
      (adult) => adult.isGuardian,
    ).length;

  /*
   * ============================================================
   * LOOKUP
   * ============================================================
   */

  function getDocumentKey(
    documentType: string,
    documentNumber: string,
  ): string {
    return `${documentType.trim().toUpperCase()}|${documentNumber.trim()}`;
  }

  function shouldLookup(
    documentType: string,
    documentNumber: string,
  ): boolean {
    const type =
      documentType.trim().toUpperCase();

    const number =
      documentNumber.trim();

    /*
     * Para DNI hacemos la búsqueda exactamente
     * cuando tenemos los 8 dígitos.
     */
    if (type === 'DNI') {
      return /^\d{8}$/.test(number);
    }

    /*
     * Para otros documentos no hacemos consultas
     * automáticas todavía.
     *
     * El backend soporta esos tipos, pero la regla
     * solicitada para UX automática es DNI.
     */
    return false;
  }

  function formatDateForInput(
    value: string | null,
  ): string {
    if (!value) {
      return '';
    }

    /*
     * El backend serializa Date como ISO.
     *
     * Tomamos solamente YYYY-MM-DD.
     */
    return value.slice(0, 10);
  }

  function isAdultBirthDate(
    birthDate: string,
  ): boolean {
    if (!birthDate) {
      return false;
    }

    const birth =
      new Date(`${birthDate}T00:00:00`);

    if (Number.isNaN(birth.getTime())) {
      return false;
    }

    const today = new Date();

    let age =
      today.getFullYear() -
      birth.getFullYear();

    const monthDifference =
      today.getMonth() -
      birth.getMonth();

    if (
      monthDifference < 0 ||
      (
        monthDifference === 0 &&
        today.getDate() < birth.getDate()
      )
    ) {
      age--;
    }

    return age >= 18;
  }

  function getLookupMessage(
    data: PersonLookupResponse,
  ): string {
    if (!data.exists) {
      return 'No existe una persona registrada con este documento. Puede completar los datos manualmente.';
    }

    return 'Persona existente encontrada. Sus datos personales fueron recuperados del sistema.';
  }

  function getApiErrorMessage(
    submitError: unknown,
  ): string {
    if (
      axios.isAxiosError(submitError)
    ) {
      const responseData =
        submitError.response?.data;

      if (
        responseData &&
        typeof responseData.message === 'string'
      ) {
        return responseData.message;
      }

      if (
        Array.isArray(responseData?.message)
      ) {
        return responseData.message.join(
          ' ',
        );
      }

      if (
        submitError.response?.status === 409
      ) {
        return 'La operación no puede realizarse porque existe un conflicto con la información registrada.';
      }

      if (
        submitError.response?.status === 403
      ) {
        return 'No tiene permisos suficientes para realizar esta operación.';
      }

      if (
        submitError.response?.status === 401
      ) {
        return 'La sesión ha expirado. Inicie sesión nuevamente.';
      }
    }

    return 'No fue posible registrar la familia. Verifique los datos e inténtelo nuevamente.';
  }

  async function lookupAdult(
    index: number,
    documentType: string,
    documentNumber: string,
  ) {
    if (
      !shouldLookup(
        documentType,
        documentNumber,
      )
    ) {
      return;
    }

    const documentKey =
      getDocumentKey(
        documentType,
        documentNumber,
      );

    adultLookupKeys.current[index] =
      documentKey;

    setAdultLookups((current) => ({
      ...current,
      [index]: {
        status: 'searching',
        data: null,
        documentKey,
        message:
          'Buscando persona registrada...',
      },
    }));

    try {
      const data =
        await lookupPersonByDocument(
          documentType.trim(),
          documentNumber.trim(),
        );

      /*
       * Ignorar una respuesta perteneciente
       * a un documento anterior.
       */
      if (
        adultLookupKeys.current[index] !==
        documentKey
      ) {
        return;
      }

      if (!data.exists || !data.person) {
        setAdultLookups((current) => ({
          ...current,
          [index]: {
            status: 'not-found',
            data,
            documentKey,
            message:
              getLookupMessage(data),
          },
        }));

        return;
      }

      const person = data.person;

      setForm((current) => ({
        ...current,
        adults: current.adults.map(
          (adult, adultIndex) =>
            adultIndex === index
              ? {
                  ...adult,
                  firstName:
                    person.firstName,
                  lastNameFather:
                    person.lastNameFather ??
                    '',
                  lastNameMother:
                    person.lastNameMother ??
                    '',
                  birthDate:
                    formatDateForInput(
                      person.birthDate,
                    ),
                  phone:
                    person.phone ?? '',
                  email:
                    person.email ?? '',
                  address:
                    person.address ?? '',
                }
              : adult,
        ),
      }));

      setAdultLookups((current) => ({
        ...current,
        [index]: {
          status: 'found',
          data,
          documentKey,
          message:
            getLookupMessage(data),
        },
      }));
    } catch (lookupError) {
      console.error(
        'Error buscando adulto:',
        lookupError,
      );

      if (
        adultLookupKeys.current[index] !==
        documentKey
      ) {
        return;
      }

      setAdultLookups((current) => ({
        ...current,
        [index]: {
          status: 'error',
          data: null,
          documentKey,
          message:
            'No fue posible consultar el documento. Puede continuar completando los datos manualmente.',
        },
      }));
    }
  }

  async function lookupStudent(
    index: number,
    documentType: string,
    documentNumber: string,
  ) {
    if (
      !shouldLookup(
        documentType,
        documentNumber,
      )
    ) {
      return;
    }

    const documentKey =
      getDocumentKey(
        documentType,
        documentNumber,
      );

    studentLookupKeys.current[index] =
      documentKey;

    setStudentLookups((current) => ({
      ...current,
      [index]: {
        status: 'searching',
        data: null,
        documentKey,
        message:
          'Buscando persona registrada...',
      },
    }));

    try {
      const data =
        await lookupPersonByDocument(
          documentType.trim(),
          documentNumber.trim(),
        );

      if (
        studentLookupKeys.current[index] !==
        documentKey
      ) {
        return;
      }

      if (!data.exists || !data.person) {
        setStudentLookups((current) => ({
          ...current,
          [index]: {
            status: 'not-found',
            data,
            documentKey,
            message:
              getLookupMessage(data),
          },
        }));

        return;
      }

      const person = data.person;

      setForm((current) => ({
        ...current,
        students: current.students.map(
          (student, studentIndex) =>
            studentIndex === index
              ? {
                  ...student,
                  firstName:
                    person.firstName,
                  lastNameFather:
                    person.lastNameFather ??
                    '',
                  lastNameMother:
                    person.lastNameMother ??
                    '',
                  birthDate:
                    formatDateForInput(
                      person.birthDate,
                    ),
                }
              : student,
        ),
      }));

      setStudentLookups((current) => ({
        ...current,
        [index]: {
          status: 'found',
          data,
          documentKey,
          message:
            getLookupMessage(data),
        },
      }));
    } catch (lookupError) {
      console.error(
        'Error buscando estudiante:',
        lookupError,
      );

      if (
        studentLookupKeys.current[index] !==
        documentKey
      ) {
        return;
      }

      setStudentLookups((current) => ({
        ...current,
        [index]: {
          status: 'error',
          data: null,
          documentKey,
          message:
            'No fue posible consultar el documento. Puede continuar completando los datos manualmente.',
        },
      }));
    }
  }

  /*
   * ============================================================
   * ADULTOS
   * ============================================================
   */

  function updateAdult(
    index: number,
    field: keyof AdultForm,
    value: string | boolean,
  ) {
    /*
     * Si se modifica el documento, debemos
     * invalidar inmediatamente el resultado anterior.
     */
    if (
      field === 'documentNumber' ||
      field === 'documentType'
    ) {
      adultLookupKeys.current[index] = '';

      setAdultLookups((current) => ({
        ...current,
        [index]: emptyLookupState(),
      }));

      setForm((current) => ({
        ...current,
        adults: current.adults.map(
          (adult, adultIndex) =>
            adultIndex === index
              ? {
                  ...adult,
                  [field]: value,
                  firstName: '',
                  lastNameFather: '',
                  lastNameMother: '',
                  birthDate: '',
                  phone: '',
                  email: '',
                  address: '',
                }
              : adult,
        ),
      }));

      if (
        field === 'documentNumber'
      ) {
        void lookupAdult(
          index,
          form.adults[index]
            ?.documentType ?? 'DNI',
          String(value),
        );
      }

      if (
        field === 'documentType'
      ) {
        void lookupAdult(
          index,
          String(value),
          form.adults[index]
            ?.documentNumber ?? '',
        );
      }

      return;
    }

    setForm((current) => ({
      ...current,
      adults: current.adults.map(
        (adult, adultIndex) =>
          adultIndex === index
            ? {
                ...adult,
                [field]: value,
              }
            : adult,
      ),
    }));
  }

  function addFather() {
    if (father) {
      return;
    }

    setForm((current) => ({
      ...current,
      adults: [
        ...current.adults,
        createEmptyAdult('PADRE'),
      ],
    }));
  }

  function addMother() {
    if (mother) {
      return;
    }

    setForm((current) => ({
      ...current,
      adults: [
        ...current.adults,
        createEmptyAdult('MADRE'),
      ],
    }));
  }

  function addOtherAdult() {
    const defaultRelationship =
      otherRelationshipTypes[0]?.code ??
      'OTRO';

    setForm((current) => ({
      ...current,
      adults: [
        ...current.adults,
        createEmptyAdult(
          defaultRelationship,
        ),
      ],
    }));
  }

  function removeAdult(index: number) {
    adultLookupKeys.current =
      shiftLookupKeys(
        adultLookupKeys.current,
        index,
      );

    setAdultLookups((current) =>
      shiftLookupStates(current, index),
    );

    setForm((current) => ({
      ...current,
      adults: current.adults.filter(
        (_, adultIndex) =>
          adultIndex !== index,
      ),
    }));
  }

  function setGuardian(index: number) {
    setForm((current) => ({
      ...current,
      adults: current.adults.map(
        (adult, adultIndex) => ({
          ...adult,
          isGuardian:
            adultIndex === index,
        }),
      ),
    }));
  }

  /*
   * ============================================================
   * ESTUDIANTES
   * ============================================================
   */

  function updateStudent(
    index: number,
    field: keyof StudentForm,
    value: string,
  ) {
    if (
      field === 'documentNumber' ||
      field === 'documentType'
    ) {
      studentLookupKeys.current[index] =
        '';

      setStudentLookups((current) => ({
        ...current,
        [index]: emptyLookupState(),
      }));

      setForm((current) => ({
        ...current,
        students: current.students.map(
          (student, studentIndex) =>
            studentIndex === index
              ? {
                  ...student,
                  [field]: value,
                  firstName: '',
                  lastNameFather: '',
                  lastNameMother: '',
                  birthDate: '',
                }
              : student,
        ),
      }));

      if (
        field === 'documentNumber'
      ) {
        void lookupStudent(
          index,
          form.students[index]
            ?.documentType ?? 'DNI',
          value,
        );
      }

      if (
        field === 'documentType'
      ) {
        void lookupStudent(
          index,
          value,
          form.students[index]
            ?.documentNumber ?? '',
        );
      }

      return;
    }

    setForm((current) => ({
      ...current,
      students: current.students.map(
        (student, studentIndex) =>
          studentIndex === index
            ? {
                ...student,
                [field]: value,
              }
            : student,
      ),
    }));
  }

  function addStudent() {
    setForm((current) => ({
      ...current,
      students: [
        ...current.students,
        createEmptyStudent(),
      ],
    }));
  }

  function removeStudent(index: number) {
    studentLookupKeys.current =
      shiftLookupKeys(
        studentLookupKeys.current,
        index,
      );

    setStudentLookups((current) =>
      shiftLookupStates(current, index),
    );

    setForm((current) => ({
      ...current,
      students:
        current.students.filter(
          (_, studentIndex) =>
            studentIndex !== index,
        ),
    }));
  }

  function getAdultIndex(
    adult: AdultForm,
  ): number {
    return form.adults.indexOf(adult);
  }

  function getDuplicateAdultDocumentMessage(
    index: number,
  ): string | null {
    const adult = form.adults[index];

    if (!adult) {
      return null;
    }

    const documentType =
      adult.documentType.trim();

    const documentNumber =
      adult.documentNumber.trim();

    if (!documentType || !documentNumber) {
      return null;
    }

    const documentKey =
      getDocumentKey(
        documentType,
        documentNumber,
      );

    const duplicateIndex =
      form.adults.findIndex(
        (candidate, candidateIndex) =>
          candidateIndex !== index &&
          candidate.documentType.trim() !== '' &&
          candidate.documentNumber.trim() !== '' &&
          getDocumentKey(
            candidate.documentType,
            candidate.documentNumber,
          ) === documentKey,
      );

    if (duplicateIndex === -1) {
      return null;
    }

    return `El documento ${documentNumber} ya fue utilizado en el familiar ${duplicateIndex + 1}. Una misma persona no puede registrarse más de una vez como familiar en esta operación.`;
  }

  /*
   * ============================================================
   * VALIDACIÓN
   * ============================================================
   */

  function validateForm(): string | null {
  if (!form.schoolPeriodId) {
    return 'Debe seleccionar un periodo escolar.';
  }

  if (form.students.length === 0) {
    return 'Debe registrar al menos un estudiante.';
  }

  if (form.adults.length === 0) {
    return 'Debe registrar al menos un familiar adulto.';
  }

  if (guardianCount !== 1) {
    return 'Debe existir exactamente un apoderado.';
  }

  /*
   * ----------------------------------------------------------
   * ESTUDIANTES
   * ----------------------------------------------------------
   */

  const studentDocumentKeys =
    new Set<string>();

  for (
    let index = 0;
    index < form.students.length;
    index++
  ) {
    const student =
      form.students[index];

    const documentType =
      student.documentType.trim();

    const documentNumber =
      student.documentNumber.trim();

    if (!documentType) {
      return `Debe seleccionar el tipo de documento del estudiante ${index + 1}.`;
    }

    if (!documentNumber) {
      return `Debe ingresar el documento del estudiante ${index + 1}.`;
    }

    if (!student.firstName.trim()) {
      return `Debe ingresar los nombres del estudiante ${index + 1}.`;
    }

    if (
      !student.lastNameFather.trim()
    ) {
      return `Debe ingresar el apellido paterno del estudiante ${index + 1}.`;
    }

    if (
      !student.lastNameMother.trim()
    ) {
      return `Debe ingresar el apellido materno del estudiante ${index + 1}.`;
    }

    if (!student.birthDate) {
      return `Debe ingresar la fecha de nacimiento del estudiante ${index + 1}.`;
    }

    if (!student.classroomId) {
      return `Debe seleccionar el aula del estudiante ${index + 1}.`;
    }

    /*
     * No permitimos dos estudiantes con el
     * mismo documento dentro de la misma operación.
     */
    const documentKey =
      getDocumentKey(
        documentType,
        documentNumber,
      );

    if (
      studentDocumentKeys.has(
        documentKey,
      )
    ) {
      return `El estudiante ${index + 1} utiliza un documento que ya fue registrado en otro estudiante.`;
    }

    studentDocumentKeys.add(
      documentKey,
    );

    /*
     * --------------------------------------------------------
     * VALIDACIÓN CONTRA PERSONA EXISTENTE
     * --------------------------------------------------------
     *
     * Si el documento ya existe, verificamos si la persona
     * pertenece actualmente a una familia activa.
     *
     * La existencia de una persona por sí sola NO es error.
     * Lo que bloquea el registro es que el estudiante ya
     * pertenezca a una familia activa.
     *
     * El backend continúa siendo la autoridad final.
     */
    const lookup =
      studentLookups[index];

    if (
      lookup?.status === 'found' &&
      lookup.data
    ) {
      const activeFamilies =
        lookup.data.families.filter(
          (family) =>
            family.isActive,
        );

      if (
        activeFamilies.length > 0
      ) {
        const familyNames =
          activeFamilies
            .map(
              (family) =>
                family.code ??
                family.name,
            )
            .join(', ');

        return `El estudiante ${index + 1} ya pertenece a una familia activa (${familyNames}). No puede ser reasignado mediante el registro familiar.`;
      }

      /*
       * Si existe como persona pero todavía
       * no pertenece a una familia activa,
       * permitimos continuar.
       *
       * El backend decidirá si corresponde
       * reutilizar o crear el registro.
       */
    }
  }

  /*
   * ----------------------------------------------------------
   * ADULTOS
   * ----------------------------------------------------------
   */

  const adultDocumentKeys =
    new Set<string>();

  let fatherCount = 0;
  let motherCount = 0;

  for (
    let index = 0;
    index < form.adults.length;
    index++
  ) {
    const adult =
      form.adults[index];

    const documentType =
      adult.documentType.trim();

    const documentNumber =
      adult.documentNumber.trim();

    if (!documentType) {
      return `Debe seleccionar el tipo de documento del familiar ${index + 1}.`;
    }

    if (!documentNumber) {
      return `Debe ingresar el documento del familiar ${index + 1}.`;
    }

    if (!adult.firstName.trim()) {
      return `Debe ingresar los nombres del familiar ${index + 1}.`;
    }

    if (!adult.relationshipType) {
      return `Debe seleccionar el parentesco del familiar ${index + 1}.`;
    }

    /*
     * --------------------------------------------------------
     * PADRE / MADRE
     * --------------------------------------------------------
     */

    if (
      adult.relationshipType ===
      'PADRE'
    ) {
      fatherCount++;
    }

    if (
      adult.relationshipType ===
      'MADRE'
    ) {
      motherCount++;
    }

    /*
     * --------------------------------------------------------
     * APODERADO
     * --------------------------------------------------------
     *
     * La fecha de nacimiento es obligatoria para el
     * apoderado y debe corresponder a una persona
     * mayor o igual a 18 años.
     */
    if (
      adult.isGuardian &&
      !adult.birthDate
    ) {
      return 'El apoderado debe tener registrada su fecha de nacimiento.';
    }

    if (
      adult.isGuardian &&
      adult.birthDate &&
      !isAdultBirthDate(
        adult.birthDate,
      )
    ) {
      return 'El apoderado debe ser mayor de edad (18 años o más).';
    }

    /*
     * --------------------------------------------------------
     * PERSONA EXISTENTE COMO ESTUDIANTE ACTIVO
     * --------------------------------------------------------
     *
     * Una persona que actualmente está registrada como
     * estudiante activo no puede registrarse simultáneamente
     * como familiar adulto.
     *
     * Esto es independiente de que también pertenezca
     * o no a una familia.
     */
    const lookup =
      adultLookups[index];

    if (
      lookup?.status === 'found' &&
      lookup.data?.student?.isActive === true
    ) {
      return `La persona con documento ${documentNumber} está registrada como estudiante activo y no puede registrarse simultáneamente como familiar adulto.`;
    }

    /*
     * --------------------------------------------------------
     * DUPLICIDAD DE DOCUMENTO ENTRE ADULTOS
     * --------------------------------------------------------
     */

    const documentKey =
      getDocumentKey(
        documentType,
        documentNumber,
      );

    if (
      adultDocumentKeys.has(
        documentKey,
      )
    ) {
      return `El familiar ${index + 1} utiliza un documento que ya fue registrado en otro integrante de la familia.`;
    }

    adultDocumentKeys.add(
      documentKey,
    );
  }

  /*
   * ----------------------------------------------------------
   * CANTIDAD DE PADRES
   * ----------------------------------------------------------
   */

  if (fatherCount > 1) {
    return 'La familia no puede tener más de un PADRE.';
  }

  /*
   * ----------------------------------------------------------
   * CANTIDAD DE MADRES
   * ----------------------------------------------------------
   */

  if (motherCount > 1) {
    return 'La familia no puede tener más de una MADRE.';
  }

  /*
   * ----------------------------------------------------------
   * DOCUMENTO ADULTO VS. DOCUMENTO ESTUDIANTE
   * ----------------------------------------------------------
   *
   * Una misma persona no puede aparecer como estudiante
   * y familiar adulto dentro de esta misma operación.
   */

  for (
    let studentIndex = 0;
    studentIndex < form.students.length;
    studentIndex++
  ) {
    const student =
      form.students[studentIndex];

    const studentKey =
      getDocumentKey(
        student.documentType,
        student.documentNumber,
      );

    if (
      adultDocumentKeys.has(
        studentKey,
      )
    ) {
      return `El documento del estudiante ${studentIndex + 1} también fue utilizado por un familiar. Una misma persona no puede registrarse como familiar y estudiante dentro de esta operación.`;
    }
  }

  return null;
}

  /*
   * ============================================================
   * SUBMIT
   * ============================================================
   */

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError(null);

    const validationError =
      validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSaving(true);

      await createFamilyGroup({
        schoolPeriodId:
          form.schoolPeriodId,

        observations:
          form.observations.trim() ||
          undefined,

        students:
          form.students.map(
            (student) => ({
              classroomId: student.classroomId,
              documentType:
                student.documentType.trim(),

              documentNumber:
                student.documentNumber.trim(),

              firstName:
                student.firstName.trim(),

              lastNameFather:
                student.lastNameFather.trim(),

              lastNameMother:
                student.lastNameMother.trim(),

              birthDate:
                student.birthDate,
            }),
          ),

        adults:
          form.adults.map(
            (adult) => ({
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
                adult.birthDate,

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
            }),
          ),
      });

      router.push(
        '/dashboard/family-groups',
      );
    } catch (submitError) {
      console.error(
        'Error registrando familia:',
        submitError,
      );

      setError(
        getApiErrorMessage(
          submitError,
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  /*
   * ============================================================
   * LOADING
   * ============================================================
   */

  if (loading) {
    return (
      <div className="max-w-5xl p-6">
        <p className="text-sm text-slate-600">
          Cargando información...
        </p>
      </div>
    );
  }

  if (!options) {
    return (
      <div className="max-w-5xl p-6">
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          No fue posible cargar los datos
          necesarios para registrar la
          familia.
        </div>
      </div>
    );
  }

  /*
   * ============================================================
   * RENDER
   * ============================================================
   */

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">
          Registro Familiar
        </h1>

        <p className="mt-2 text-sm text-slate-600">
          Registre los integrantes y
          estudiantes que conforman el grupo
          familiar.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-8"
      >
        {/* =====================================================
            1. PERIODO
        ====================================================== */}

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-2 text-xl font-semibold text-slate-900">
            1. Periodo de registro
          </h2>

          <p className="mb-4 text-sm text-slate-600">
            Seleccione el periodo escolar en
            el que se está realizando el
            registro.
          </p>

          <label className="mb-2 block text-sm font-medium text-slate-700">
            Periodo escolar *
          </label>

          <select
            className="w-full rounded-md border border-slate-300 bg-white p-2.5 text-slate-900 outline-none focus:border-red-700 focus:ring-2 focus:ring-red-100"
            value={form.schoolPeriodId}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                schoolPeriodId:
                  event.target.value,
                students: current.students.map((student) => ({
                  ...student,
                  educationLevelId: '',
                  classroomId: '',
                })),
              }))
            }
            disabled={saving}
          >
            <option value="">
              Seleccione un periodo
            </option>

            {options.schoolPeriods.map(
              (period) => (
                <option
                  key={period.id}
                  value={period.id}
                >
                  {period.year}
                </option>
              ),
            )}
          </select>
        </section>

        {/* =====================================================
            2. PADRE
        ====================================================== */}

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                2. Padre
              </h2>

              <p className="mt-1 text-sm text-slate-600">
                El registro del padre es
                opcional.
              </p>
            </div>

            {!father && (
              <button
                type="button"
                onClick={addFather}
                disabled={saving}
                className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
              >
                Registrar padre
              </button>
            )}
          </div>

          {father ? (
            <AdultCard
              title="Datos del padre"
              adult={father}
              index={getAdultIndex(father)}
              lookup={
                adultLookups[
                  getAdultIndex(father)
                ]
              }
              duplicateDocumentMessage={
                getDuplicateAdultDocumentMessage(
                  getAdultIndex(father),
                )
              }
              onChange={updateAdult}
              onRemove={() =>
                removeAdult(
                  getAdultIndex(father),
                )
              }
              onSetGuardian={setGuardian}
              saving={saving}
              allowRemove
            />
          ) : (
            <EmptySection>
              No se ha registrado un padre.
            </EmptySection>
          )}
        </section>

        {/* =====================================================
            3. MADRE
        ====================================================== */}

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                3. Madre
              </h2>

              <p className="mt-1 text-sm text-slate-600">
                El registro de la madre es
                opcional.
              </p>
            </div>

            {!mother && (
              <button
                type="button"
                onClick={addMother}
                disabled={saving}
                className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
              >
                Registrar madre
              </button>
            )}
          </div>

          {mother ? (
            <AdultCard
              title="Datos de la madre"
              adult={mother}
              index={getAdultIndex(mother)}
              lookup={
                adultLookups[
                  getAdultIndex(mother)
                ]
              }
              duplicateDocumentMessage={
                getDuplicateAdultDocumentMessage(
                  getAdultIndex(mother),
                )
              }
              onChange={updateAdult}
              onRemove={() =>
                removeAdult(
                  getAdultIndex(mother),
                )
              }
              onSetGuardian={setGuardian}
              saving={saving}
              allowRemove
            />
          ) : (
            <EmptySection>
              No se ha registrado una madre.
            </EmptySection>
          )}
        </section>

        {/* =====================================================
            4. OTROS FAMILIARES
        ====================================================== */}

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                4. Otros familiares
              </h2>

              <p className="mt-1 text-sm text-slate-600">
                Registre otros integrantes del
                grupo familiar, si corresponde.
              </p>
            </div>

            <button
              type="button"
              onClick={addOtherAdult}
              disabled={saving}
              className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              + Agregar familiar
            </button>
          </div>

          {otherAdults.length === 0 ? (
            <EmptySection>
              No se han registrado otros
              familiares.
            </EmptySection>
          ) : (
            <div className="space-y-6">
              {otherAdults.map((adult) => {
                const index =
                  getAdultIndex(adult);

                return (
                  <AdultCard
                    key={index}
                    title={`Familiar ${index + 1}`}
                    adult={adult}
                    index={index}
                    lookup={
                      adultLookups[index]
                    }
                    duplicateDocumentMessage={
                      getDuplicateAdultDocumentMessage(
                        index,
                      )
                    }
                    onChange={updateAdult}
                    onRemove={() =>
                      removeAdult(index)
                    }
                    onSetGuardian={
                      setGuardian
                    }
                    saving={saving}
                    allowRemove
                    relationshipTypes={
                      otherRelationshipTypes
                    }
                  />
                );
              })}
            </div>
          )}
        </section>

        {/* =====================================================
            5. APODERADO
        ====================================================== */}

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-2 text-xl font-semibold text-slate-900">
            5. Apoderado
          </h2>

          <p className="mb-5 text-sm text-slate-600">
            Seleccione exactamente un adulto
            responsable del grupo familiar.
          </p>

          {form.adults.length === 0 ? (
            <div className="rounded-md border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-800">
              Primero debe registrar al menos
              un adulto.
            </div>
          ) : (
            <div className="space-y-3">
              {form.adults.map(
                (adult, index) => (
                  <label
                    key={index}
                    className={`flex cursor-pointer items-center gap-3 rounded-md border p-4 transition ${
                      adult.isGuardian
                        ? 'border-red-700 bg-red-50'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="guardian"
                      checked={
                        adult.isGuardian
                      }
                      onChange={() =>
                        setGuardian(index)
                      }
                      disabled={saving}
                    />

                    <div>
                      <p className="font-medium text-slate-900">
                        {buildDisplayName(
                          adult,
                        )}
                      </p>

                      <p className="text-sm text-slate-500">
                        {getRelationshipLabel(
                          options,
                          adult.relationshipType,
                        )}
                        {' · '}
                        {adult.documentNumber ||
                          'Sin documento'}
                      </p>
                    </div>
                  </label>
                ),
              )}
            </div>
          )}

          {guardianCount === 1 && (
            <p className="mt-4 text-sm font-medium text-green-700">
              ✓ Se ha seleccionado un
              apoderado.
            </p>
          )}
        </section>

        {/* =====================================================
            6. ESTUDIANTES
        ====================================================== */}

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                6. Estudiantes
              </h2>

              <p className="mt-1 text-sm text-slate-600">
                Registre los estudiantes que
                pertenecen al grupo familiar.
              </p>
            </div>

            <button
              type="button"
              onClick={addStudent}
              disabled={saving}
              className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              + Agregar estudiante
            </button>
          </div>

          <div className="space-y-6">
            {form.students.map(
              (student, index) => {
                const lookup =
                  studentLookups[index];

                const existingActiveFamilies =
                  lookup?.data?.families.filter(
                    (family) =>
                      family.isActive,
                  ) ?? [];

                return (
                  <div
                    key={index}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-5"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="font-semibold text-slate-900">
                        Estudiante {index + 1}
                      </h3>

                      {form.students.length >
                        1 && (
                        <button
                          type="button"
                          onClick={() =>
                            removeStudent(
                              index,
                            )
                          }
                          disabled={saving}
                          className="text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">
                          Tipo de documento *
                        </label>

                        <select
                          className="w-full rounded-md border border-slate-300 bg-white p-2.5 text-slate-900 disabled:bg-slate-100"
                          value={
                            student.documentType
                          }
                          onChange={(event) =>
                            updateStudent(
                              index,
                              'documentType',
                              event.target.value,
                            )
                          }
                          disabled={saving}
                        >
                          <option value="DNI">
                            DNI
                          </option>

                          <option value="CE">
                            Carné de Extranjería
                          </option>

                          <option value="PASAPORTE">
                            Pasaporte
                          </option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">
                          Número de documento *
                        </label>

                        <input
                          className="w-full rounded-md border border-slate-300 bg-white p-2.5 text-slate-900 disabled:bg-slate-100"
                          value={
                            student.documentNumber
                          }
                          onChange={(event) =>
                            updateStudent(
                              index,
                              'documentNumber',
                              event.target.value,
                            )
                          }
                          disabled={
                            saving ||
                            lookup?.status ===
                              'found'
                          }
                        />
                      </div>

                      {lookup?.status ===
                        'searching' && (
                        <LookupMessage
                          type="info"
                          message="Buscando persona registrada..."
                        />
                      )}

                      {lookup?.status ===
                        'not-found' && (
                        <LookupMessage
                          type="success"
                          message="No existe una persona con este documento. Puede completar los datos manualmente."
                        />
                      )}

                      {lookup?.status ===
                        'found' &&
                        lookup.data?.person && (
                          <div className="md:col-span-2">
                            <LookupMessage
                              type="success"
                              message="Persona existente encontrada. Los datos personales fueron recuperados del sistema."
                            />
                          </div>
                        )}

                      {lookup?.status ===
                        'error' && (
                        <div className="md:col-span-2">
                          <LookupMessage
                            type="warning"
                            message={
                              lookup.message ??
                              'No fue posible consultar el documento.'
                            }
                          />
                        </div>
                      )}

                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">
                          Nombres *
                        </label>

                        <input
                          className={getInputClass(
                            lookup?.status ===
                              'found',
                          )}
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
                          disabled={
                            saving ||
                            lookup?.status ===
                              'found'
                          }
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">
                          Apellido paterno *
                        </label>

                        <input
                          className={getInputClass(
                            lookup?.status ===
                              'found',
                          )}
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
                          disabled={
                            saving ||
                            lookup?.status ===
                              'found'
                          }
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">
                          Apellido materno *
                        </label>

                        <input
                          className={getInputClass(
                            lookup?.status ===
                              'found',
                          )}
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
                          disabled={
                            saving ||
                            lookup?.status ===
                              'found'
                          }
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">
                          Fecha de nacimiento *
                        </label>

                        <input
                          type="date"
                          className={getInputClass(
                            lookup?.status ===
                              'found',
                          )}
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
                          disabled={
                            saving ||
                            lookup?.status ===
                              'found'
                          }
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">
                          Nivel / grado *
                        </label>
                        <select
                          className={getInputClass(false)}
                          value={student.educationLevelId}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              students: current.students.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, educationLevelId: event.target.value, classroomId: '' }
                                  : item,
                              ),
                            }))
                          }
                          disabled={saving || !form.schoolPeriodId}
                        >
                          <option value="">Seleccione un nivel</option>
                          {Array.from(new Map(options?.classrooms
                            .filter((classroom) => classroom.schoolPeriodId === form.schoolPeriodId)
                            .map((classroom) => [classroom.educationLevel.id, classroom.educationLevel]) ?? []).values())
                            .map((level) => (
                              <option key={level.id} value={level.id}>
                                {level.cycle.name} · {level.name}
                              </option>
                            ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">
                          Aula / turno *
                        </label>
                        <select className={getInputClass(false)} value={student.classroomId} onChange={(event) => updateStudent(index, 'classroomId', event.target.value)} disabled={saving || !student.educationLevelId}>
                          <option value="">Seleccione un aula</option>
                          {options?.classrooms.filter((classroom) => classroom.schoolPeriodId === form.schoolPeriodId && classroom.educationLevel.id === student.educationLevelId).map((classroom) => (
                            <option key={classroom.id} value={classroom.id}>{classroom.name} · {classroom.shift.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {existingActiveFamilies.length >
                      0 && (
                      <div className="mt-5 rounded-md border border-red-300 bg-red-50 p-4">
                        <p className="font-medium text-red-800">
                          Este estudiante ya
                          pertenece a una familia
                          activa.
                        </p>

                        <ul className="mt-2 list-disc pl-5 text-sm text-red-700">
                          {existingActiveFamilies.map(
                            (family) => (
                              <li
                                key={
                                  family.familyGroupId
                                }
                              >
                                {family.code ??
                                  family.name}
                                {' · '}
                                {family.name}
                              </li>
                            ),
                          )}
                        </ul>

                        <p className="mt-2 text-sm text-red-700">
                          No puede ser reasignado
                          mediante el registro
                          familiar.
                        </p>
                      </div>
                    )}

                    {lookup?.status ===
                      'found' &&
                      lookup.data?.student ===
                        null && (
                        <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                          La persona ya existe,
                          pero todavía no está
                          registrada como
                          estudiante.
                        </div>
                      )}

                    {lookup?.status ===
                      'found' &&
                      lookup.data?.student &&
                      existingActiveFamilies.length ===
                        0 && (
                        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                          El registro de estudiante
                          ya existe. Se conservará
                          su historial; la operación
                          no debe crear un estudiante
                          duplicado.
                        </div>
                      )}
                  </div>
                );
              },
            )}
          </div>
        </section>

        {/* =====================================================
            7. OBSERVACIONES
        ====================================================== */}

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-2 text-xl font-semibold text-slate-900">
            7. Observaciones
          </h2>

          <p className="mb-4 text-sm text-slate-600">
            Información adicional relevante
            para el registro familiar.
          </p>

          <textarea
            rows={4}
            maxLength={1000}
            className="w-full rounded-md border border-slate-300 bg-white p-2.5 text-slate-900 outline-none focus:border-red-700 focus:ring-2 focus:ring-red-100"
            value={
              form.observations
            }
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                observations:
                  event.target.value,
              }))
            }
            placeholder="Observaciones adicionales..."
            disabled={saving}
          />

          <p className="mt-1 text-right text-xs text-slate-500">
            {form.observations.length}/1000
          </p>
        </section>

        {/* =====================================================
            ERROR
        ====================================================== */}

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700"
          >
            <p className="font-medium">
              No fue posible completar la
              operación
            </p>

            <p className="mt-1">
              {error}
            </p>
          </div>
        )}

        {/* =====================================================
            ACTIONS
        ====================================================== */}

        <div className="flex justify-end gap-3 pb-8">
          <button
            type="button"
            onClick={() =>
              router.push(
                '/dashboard/family-groups',
              )
            }
            disabled={saving}
            className="rounded-md border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-green-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? 'Registrando...'
              : 'Registrar familia'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ============================================================
   COMPONENTE: ADULT CARD
============================================================ */

interface AdultCardProps {
  title: string;
  adult: AdultForm;
  index: number;
  lookup?: LookupState;
  duplicateDocumentMessage?: string | null;

  onChange: (
    index: number,
    field: keyof AdultForm,
    value: string | boolean,
  ) => void;

  onRemove: () => void;

  onSetGuardian: (
    index: number,
  ) => void;

  saving: boolean;

  allowRemove?: boolean;

  relationshipTypes?: {
    code: string;
    name: string;
  }[];
}

function AdultCard({
  title,
  adult,
  index,
  lookup,
  duplicateDocumentMessage,
  onChange,
  onRemove,
  onSetGuardian,
  saving,
  allowRemove = false,
  relationshipTypes,
}: AdultCardProps) {
  const personExists =
    lookup?.status === 'found';

  const families =
    lookup?.data?.families ?? [];

  const isActiveStudent =
    lookup?.status === 'found' &&
    lookup.data?.student?.isActive === true;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">
          {title}
        </h3>

        {allowRemove && (
          <button
            type="button"
            onClick={onRemove}
            disabled={saving}
            className="text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
          >
            Eliminar
          </button>
        )}
      </div>

      {lookup?.status ===
        'searching' && (
        <LookupMessage
          type="info"
          message="Buscando persona registrada..."
        />
      )}

      {lookup?.status ===
        'not-found' && (
        <div className="mb-5">
          <LookupMessage
            type="success"
            message="No existe una persona con este documento. Puede completar los datos manualmente."
          />
        </div>
      )}

      {personExists && (
        <div className="mb-5">
          <LookupMessage
            type="success"
            message="Persona existente encontrada. Sus datos personales fueron recuperados del sistema."
          />
        </div>
      )}

      {isActiveStudent && (
        <div className="mb-5 rounded-md border border-red-300 bg-red-50 p-4">
          <p className="font-medium text-red-800">
            Esta persona ya está registrada como estudiante activo.
          </p>

          <p className="mt-1 text-sm text-red-700">
            No puede registrarse simultáneamente como familiar adulto.
            Debe utilizarse el registro existente del estudiante.
          </p>
        </div>
      )}

      {duplicateDocumentMessage && (
        <div className="mb-5 rounded-md border border-red-300 bg-red-50 p-4">
          <p className="font-medium text-red-800">
            Documento duplicado en el registro.
          </p>

          <p className="mt-1 text-sm text-red-700">
            {duplicateDocumentMessage}
          </p>
        </div>
      )}

      {lookup?.status ===
        'error' && (
        <div className="mb-5">
          <LookupMessage
            type="warning"
            message={
              lookup.message ??
              'No fue posible consultar el documento.'
            }
          />
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* DOCUMENT TYPE */}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Tipo de documento *
          </label>

          <select
            className={getInputClass(
              personExists,
            )}
            value={
              adult.documentType
            }
            onChange={(event) =>
              onChange(
                index,
                'documentType',
                event.target.value,
              )
            }
            disabled={
              saving || personExists
            }
          >
            <option value="DNI">
              DNI
            </option>

            <option value="CE">
              Carné de Extranjería
            </option>

            <option value="PASAPORTE">
              Pasaporte
            </option>
          </select>
        </div>

        {/* DOCUMENT NUMBER */}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Número de documento *
          </label>

          <input
            className={getInputClass(
              personExists,
            )}
            value={
              adult.documentNumber
            }
            onChange={(event) =>
              onChange(
                index,
                'documentNumber',
                event.target.value,
              )
            }
            disabled={
              saving || personExists
            }
          />
        </div>

        {/* FIRST NAME */}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Nombres *
          </label>

          <input
            className={getInputClass(
              personExists,
            )}
            value={
              adult.firstName
            }
            onChange={(event) =>
              onChange(
                index,
                'firstName',
                event.target.value,
              )
            }
            disabled={
              saving || personExists
            }
          />
        </div>

        {/* FATHER LAST NAME */}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Apellido paterno
          </label>

          <input
            className={getInputClass(
              personExists,
            )}
            value={
              adult.lastNameFather
            }
            onChange={(event) =>
              onChange(
                index,
                'lastNameFather',
                event.target.value,
              )
            }
            disabled={
              saving || personExists
            }
          />
        </div>

        {/* MOTHER LAST NAME */}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Apellido materno
          </label>

          <input
            className={getInputClass(
              personExists,
            )}
            value={
              adult.lastNameMother
            }
            onChange={(event) =>
              onChange(
                index,
                'lastNameMother',
                event.target.value,
              )
            }
            disabled={
              saving || personExists
            }
          />
        </div>

        {/* BIRTH DATE */}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Fecha de nacimiento
            {adult.isGuardian
              ? ' *'
              : ''}
          </label>

          <input
            type="date"
            className={getInputClass(
              personExists,
            )}
            value={
              adult.birthDate
            }
            onChange={(event) =>
              onChange(
                index,
                'birthDate',
                event.target.value,
              )
            }
            disabled={
              saving || personExists
            }
          />
        </div>

        {/* RELATIONSHIP */}

        {relationshipTypes && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Parentesco *
            </label>

            <select
              className="w-full rounded-md border border-slate-300 bg-white p-2.5 text-slate-900 disabled:bg-slate-100"
              value={
                adult.relationshipType
              }
              onChange={(event) =>
                onChange(
                  index,
                  'relationshipType',
                  event.target.value,
                )
              }
              disabled={saving}
            >
              {relationshipTypes.map(
                (relationship) => (
                  <option
                    key={
                      relationship.code
                    }
                    value={
                      relationship.code
                    }
                  >
                    {relationship.name}
                  </option>
                ),
              )}
            </select>
          </div>
        )}

        {/* PHONE */}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Teléfono
          </label>

          <input
            type="tel"
            className={getInputClass(
              personExists,
            )}
            value={adult.phone}
            onChange={(event) =>
              onChange(
                index,
                'phone',
                event.target.value,
              )
            }
            disabled={
              saving || personExists
            }
          />
        </div>

        {/* EMAIL */}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Correo electrónico
          </label>

          <input
            type="email"
            className={getInputClass(
              personExists,
            )}
            value={adult.email}
            onChange={(event) =>
              onChange(
                index,
                'email',
                event.target.value,
              )
            }
            disabled={
              saving || personExists
            }
          />
        </div>

        {/* ADDRESS */}

        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Dirección
          </label>

          <input
            className={getInputClass(
              personExists,
            )}
            value={adult.address}
            onChange={(event) =>
              onChange(
                index,
                'address',
                event.target.value,
              )
            }
            disabled={
              saving || personExists
            }
          />
        </div>

        {/* GUARDIAN */}

        <div className="md:col-span-2">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name={`adult-guardian-${index}`}
              checked={
                adult.isGuardian
              }
              onChange={() =>
                onSetGuardian(index)
              }
              disabled={saving}
            />

            <span className="text-sm font-medium text-slate-700">
              Es apoderado
            </span>
          </label>

          <p className="mt-1 text-xs text-slate-500">
            Solo un integrante adulto puede
            ser apoderado del grupo familiar.
          </p>
        </div>
      </div>

      {/* EXISTING FAMILY MEMBERSHIPS */}

      {personExists &&
        families.length > 0 && (
          <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4">
            <p className="font-medium text-slate-900">
              Familias registradas para esta
              persona
            </p>

            <div className="mt-3 space-y-2">
              {families.map(
                (family) => (
                  <div
                    key={
                      family.familyGroupId
                    }
                    className="rounded border border-slate-200 bg-white p-3 text-sm"
                  >
                    <p className="font-medium text-slate-900">
                      {family.code ??
                        family.name}
                    </p>

                    <p className="text-slate-600">
                      {family.name}
                    </p>

                    <p className="mt-1 text-slate-500">
                      Relación:{' '}
                      {family.relationshipType}
                      {' · '}
                      {family.isGuardian
                        ? 'Apoderado'
                        : 'Integrante'}
                      {' · '}
                      {family.isActive
                        ? 'Familia activa'
                        : 'Familia inactiva'}
                    </p>
                  </div>
                ),
              )}
            </div>

            <p className="mt-3 text-xs text-slate-700">
              {lookup.data?.families.some(
                (family) =>
                  family.relationshipType === 'ESTUDIANTE',
              )
                ? 'Esta persona está registrada como estudiante en una de las familias mostradas. Esta relación forma parte de su historial familiar y no impide que en el futuro pueda pertenecer a otra familia con una relación diferente.'
                : 'Una persona adulta puede pertenecer a más de una familia. Esto no impide su registro en otra familia.'}
            </p>
          </div>
        )}

      {personExists &&
        families.length === 0 && (
          <div className="mt-5 rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600">
            La persona existe en el sistema, pero todavía no pertenece a ningún grupo familiar.
          </div>
        )}
    </div>
  );
}

/* ============================================================
   COMPONENTE: EMPTY SECTION
============================================================ */

function EmptySection({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
      {children}
    </div>
  );
}

/* ============================================================
   COMPONENTE: LOOKUP MESSAGE
============================================================ */

function LookupMessage({
  type,
  message,
}: {
  type:
    | 'info'
    | 'success'
    | 'warning';
  message: string;
}) {
  const classes = {
    info:
      'border-slate-200 bg-slate-50 text-slate-700',
    success:
      'border-green-200 bg-green-50 text-green-800',
    warning:
      'border-amber-200 bg-amber-50 text-amber-800',
  };

  return (
    <div
      className={`rounded-md border p-3 text-sm ${classes[type]}`}
    >
      {message}
    </div>
  );
}

/* ============================================================
   HELPERS
============================================================ */

function getInputClass(
  readOnly: boolean,
): string {
  return readOnly
    ? 'w-full rounded-md border border-slate-300 bg-slate-100 p-2.5 text-slate-700 disabled:cursor-not-allowed'
    : 'w-full rounded-md border border-slate-300 bg-white p-2.5 text-slate-900 outline-none focus:border-red-700 focus:ring-2 focus:ring-red-100 disabled:bg-slate-100';
}

function buildDisplayName(
  adult: AdultForm,
): string {
  const parts = [
    adult.firstName.trim(),
    adult.lastNameFather.trim(),
    adult.lastNameMother.trim(),
  ].filter(Boolean);

  return (
    parts.join(' ') ||
    'Integrante sin nombre'
  );
}

function getRelationshipLabel(
  options: FamilyGroupCreateOptions,
  relationshipCode: string,
): string {
  return (
    options.relationshipTypes.find(
      (relationship) =>
        relationship.code ===
        relationshipCode,
    )?.name ??
    relationshipCode
  );
}

/*
 * Al eliminar un elemento de un arreglo,
 * los índices posteriores disminuyen en uno.
 *
 * Reindexamos los estados de lookup para
 * mantenerlos sincronizados con el formulario.
 */

function shiftLookupStates(
  states: Record<number, LookupState>,
  removedIndex: number,
): Record<number, LookupState> {
  const next: Record<
    number,
    LookupState
  > = {};

  Object.entries(states).forEach(
    ([key, value]) => {
      const index = Number(key);

      if (index < removedIndex) {
        next[index] = value;
      }

      if (index > removedIndex) {
        next[index - 1] = value;
      }
    },
  );

  return next;
}

function shiftLookupKeys(
  keys: Record<number, string>,
  removedIndex: number,
): Record<number, string> {
  const next: Record<
    number,
    string
  > = {};

  Object.entries(keys).forEach(
    ([key, value]) => {
      const index = Number(key);

      if (index < removedIndex) {
        next[index] = value;
      }

      if (index > removedIndex) {
        next[index - 1] = value;
      }
    },
  );

  return next;
}
