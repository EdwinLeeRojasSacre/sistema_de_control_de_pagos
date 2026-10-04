import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  Prisma,
  persons,
  students,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service.js';
import { EnrollmentsService } from '../enrollments/enrollments.service.js';
import { AddFamilyStudentDto } from './dto/add-family-student.dto.js';
import { CreateFamilyGroupDto } from './dto/create-family-group.dto.js';
import type { CreateFamilyStudentDto } from './dto/create-family-student.dto.js';
import { FindFamilyGroupsQueryDto } from './dto/find-family-groups-query.dto.js';
import { UpdateFamilyGroupDto } from './dto/update-family-group.dto.js';

interface AdultPersonData {
  person: persons;
  relationshipType: string;
  isGuardian: boolean;
}

interface StudentData {
  student: students;
  person: persons;
  isNewStudent: boolean;
}

interface AuditContext {
  userId: string;
  ipAddress: string | null;
  deviceName: string | null;
}

export type ImportFamilyCreateInput = Omit<CreateFamilyGroupDto, 'students'> & {
  students: Array<Omit<CreateFamilyStudentDto, 'classroomId'>>;
};

interface FamilyReference {
  id: string;
  code: string | null;
  name: string;
  is_active: boolean;
}

const ALLOWED_RELATIONSHIP_TYPES = new Set([
  'PADRE',
  'MADRE',
  'PADRASTRO',
  'MADRASTRA',
  'ABUELO',
  'ABUELA',
  'HERMANO',
  'HERMANA',
  'TIO',
  'TIA',
  'OTRO',
]);

@Injectable()
export class FamilyGroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly enrollmentsService: EnrollmentsService,
  ) {}

  // ============================================================
  // CONSULTAS
  // ============================================================

  async findPersonByDocument(
    documentType: string,
    documentNumber: string,
  ) {
    const normalizedDocumentType =
      documentType.trim().toUpperCase();

    const normalizedDocumentNumber =
      documentNumber.trim();

    const person =
      await this.prisma.persons.findFirst({
        where: {
          document_type:
            normalizedDocumentType,
          document_number:
            normalizedDocumentNumber,
        },
        include: {
          family_members: {
            include: {
              family_groups: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  is_active: true,
                },
              },
            },
            orderBy: {
              created_at: 'asc',
            },
          },
          students: {
            select: {
              id: true,
              is_active: true,
            },
          },
        },
      });

    if (!person) {
      return {
        exists: false,
        person: null,
        families: [],
        student: null,
      };
    }

    return {
      exists: true,

      person: {
        id: person.id,
        documentType: person.document_type,
        documentNumber: person.document_number,
        firstName: person.first_name,
        lastNameFather:
          person.last_name_father,
        lastNameMother:
          person.last_name_mother,
        birthDate: person.birth_date,
        phone: person.phone,
        email: person.email,
        address: person.address,
      },

      families:
        person.family_members.map(
          (member) => ({
            familyGroupId:
              member.family_group_id,
            code:
              member.family_groups.code,
            name:
              member.family_groups.name,
            relationshipType:
              member.relationship_type,
            isGuardian:
              member.is_guardian,
            isActive:
              member.family_groups.is_active,
          }),
        ),

      student: person.students
        ? {
            id: person.students.id,
            isActive:
              person.students.is_active,
          }
        : null,
    };
  }

  async findAll(query: FindFamilyGroupsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const search =
      query.search
        ?.trim()
        .replace(/\s+/g, ' ') ||
      undefined;

    const searchTokens =
      search
        ?.split(' ')
        .map((token) =>
          token.trim(),
        )
        .filter(Boolean) ??
      [];

    const status =
      query.status ?? 'ALL';

    const where:
    Prisma.family_groupsWhereInput =
    {
      ...(status === 'ACTIVE'
        ? {
            is_active: true,
          }
        : status ===
            'INACTIVE'
          ? {
              is_active:
                false,
            }
          : {}),

      ...(searchTokens.length >
      0
        ? {
            AND:
              searchTokens.map(
                (token) => ({
                  OR: [
                    {
                      code: {
                        contains:
                          token,
                        mode:
                          'insensitive',
                      },
                    },

                    {
                      name: {
                        contains:
                          token,
                        mode:
                          'insensitive',
                      },
                    },

                    {
                      family_members:
                        {
                          some: {
                            persons:
                              {
                                OR: [
                                  {
                                    document_number:
                                      {
                                        contains:
                                          token,
                                        mode:
                                          'insensitive',
                                      },
                                  },

                                  {
                                    first_name:
                                      {
                                        contains:
                                          token,
                                        mode:
                                          'insensitive',
                                      },
                                  },

                                  {
                                    last_name_father:
                                      {
                                        contains:
                                          token,
                                        mode:
                                          'insensitive',
                                      },
                                  },

                                  {
                                    last_name_mother:
                                      {
                                        contains:
                                          token,
                                        mode:
                                          'insensitive',
                                      },
                                  },
                                ],
                              },
                          },
                        },
                    },
                  ],
                }),
              ),
          }
        : {}),
    };

    const [groups, total] =
      await Promise.all([
        this.prisma.family_groups.findMany({
          where,

          include: {
            family_members: {
              where: {
                OR: [
                  {
                    relationship_type: 'PADRE',
                  },
                  {
                    relationship_type: 'MADRE',
                  },
                  {
                    is_guardian: true,
                  },
                ],
              },

              include: {
                persons: {
                  select: {
                    id: true,
                    document_type: true,
                    document_number: true,
                    first_name: true,
                    last_name_father: true,
                    last_name_mother: true,
                  },
                },
              },

              orderBy: [
                {
                  is_guardian: 'desc',
                },
                {
                  relationship_type: 'asc',
                },
                {
                  created_at: 'asc',
                },
                {
                  id: 'asc',
                },
              ],
            },

            _count: {
              select: {
                family_members: true,
              },
            },
          },

          orderBy: [
            {
              created_at: 'desc',
            },
            {
              id: 'desc',
            },
          ],

          skip:
            (page - 1) *
            limit,

          take: limit,
        }),

        this.prisma.family_groups.count({
          where,
        }),
      ]);

    return {
      data:
        groups.map(
          (group) => ({
            id: group.id,

            code: group.code,

            name: group.name,

            membersCount:
              group._count
                .family_members,

            isActive:
              group.is_active,

            primaryMembers:
              group.family_members.map(
                (member) => {
                  const relationship =
                    member.relationship_type;

                  const isParent =
                    relationship ===
                      'PADRE' ||
                    relationship ===
                      'MADRE';

                  const relationshipLabel =
                    member.is_guardian &&
                    isParent
                      ? `${relationship} / APODERADO`
                      : member.is_guardian
                        ? 'APODERADO'
                        : relationship;

                  return {
                    personId:
                      member.person_id,

                    fullName:
                      this.buildFullName({
                        firstName:
                          member.persons
                            .first_name,

                        lastNameFather:
                          member.persons
                            .last_name_father,

                        lastNameMother:
                          member.persons
                            .last_name_mother,
                      }),

                    documentType:
                      member.persons
                        .document_type,

                    documentNumber:
                      member.persons
                        .document_number,

                    relationship:
                      relationshipLabel,

                    isGuardian:
                      member.is_guardian,
                  };
                },
              ),
          }),
        ),

      pagination: {
        page,
        limit,
        total,

        totalPages:
          Math.ceil(
            total / limit,
          ),
      },
    };
  }

  async findById(id: string) {
    const group =
      await this.prisma.family_groups.findUnique({
        where: {
          id,
        },
        include: {
          family_members: {
            include: {
              persons: true,
            },
            orderBy: {
              created_at: 'asc',
            },
          },
        },
      });

    if (!group) {
      throw new NotFoundException(
        'El grupo familiar no existe',
      );
    }

    return {
      id: group.id,
      code: group.code,
      name: group.name,

      createdAt:
        group.created_at.toISOString(),

      observations:
        group.observations,

      isActive:
        group.is_active,

      members:
        group.family_members.map(
          (member) => ({
            id: member.id,

            personId:
              member.person_id,

            fullName:
              this.buildFullName({
                firstName:
                  member.persons.first_name,

                lastNameFather:
                  member.persons
                    .last_name_father,

                lastNameMother:
                  member.persons
                    .last_name_mother,
              }),

            documentType:
              member.persons
                .document_type,

            documentNumber:
              member.persons
                .document_number,

            relationship:
              member.relationship_type,

            isGuardian:
              member.is_guardian,
          }),
        ),
    };
  }

  async getCreateOptions() {
    const enrollmentOptions = await this.enrollmentsService.getOptions();
    const schoolPeriods = enrollmentOptions.schoolPeriods.filter(
      (period) => period.status === 'OPEN',
    );

    return {
      schoolPeriods: schoolPeriods.map(
        (period) => ({
          id: period.id,
          year: period.year,
          startDate: period.startDate,
          endDate: period.endDate,
        }),
      ),

      classrooms: enrollmentOptions.classrooms,

      relationshipTypes: [
        {
          code: 'PADRE',
          name: 'Padre',
        },
        {
          code: 'MADRE',
          name: 'Madre',
        },
        {
          code: 'PADRASTRO',
          name: 'Padrastro',
        },
        {
          code: 'MADRASTRA',
          name: 'Madrastra',
        },
        {
          code: 'ABUELO',
          name: 'Abuelo',
        },
        {
          code: 'ABUELA',
          name: 'Abuela',
        },
        {
          code: 'TIO',
          name: 'Tío',
        },
        {
          code: 'TIA',
          name: 'Tía',
        },
        {
          code: 'HERMANO',
          name: 'Hermano',
        },
        {
          code: 'HERMANA',
          name: 'Hermana',
        },
        {
          code: 'OTRO',
          name: 'Otro',
        },
      ],
    };
  }

  // ============================================================
  // CREACIÓN / REGISTRO FAMILIAR
  // ============================================================

  async create(
    dto: CreateFamilyGroupDto,
    auditContext: AuditContext,
  ) {
    return this.createWithEnrollmentMode(dto, auditContext, true);
  }

  async createForImport(
    dto: ImportFamilyCreateInput,
    auditContext: AuditContext,
  ) {
    return this.createWithEnrollmentMode(
      dto as CreateFamilyGroupDto,
      auditContext,
      false,
      true,
    );
  }

  private async createWithEnrollmentMode(
    dto: CreateFamilyGroupDto,
    auditContext: AuditContext,
    enrollStudents: boolean,
    importOnlyNew = false,
  ) {
    this.validateCreateRequest(dto);

    const maxRetries = 3;

    for (
      let attempt = 1;
      attempt <= maxRetries;
      attempt++
    ) {
      try {
        return await this.prisma.$transaction(
          async (transaction) =>
            this.createInTransaction(
              transaction,
              dto,
              auditContext,
              enrollStudents,
              importOnlyNew,
            ),
          {
            isolationLevel:
              Prisma.TransactionIsolationLevel
                .Serializable,
            maxWait: 5000,
            timeout: 15000,
          },
        );
      } catch (error: unknown) {
        if (
          error instanceof
            Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034' &&
          attempt < maxRetries
        ) {
          continue;
        }

        this.handleCreateError(error);
      }
    }

    throw new ConflictException(
      'No se pudo completar la operación debido a concurrencia. Intente nuevamente.',
    );
  }

  async addStudent(
    familyGroupId: string,
    dto: AddFamilyStudentDto,
    auditContext: AuditContext,
  ) {
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (transaction) =>
            this.addStudentInTransaction(
              transaction,
              familyGroupId,
              dto,
              auditContext,
            ),
          {
            isolationLevel:
              Prisma.TransactionIsolationLevel.Serializable,
            maxWait: 5000,
            timeout: 15000,
          },
        );
      } catch (error: unknown) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034' &&
          attempt < maxRetries
        ) {
          continue;
        }

        this.handleCreateError(error);
      }
    }

    throw new ConflictException(
      'No se pudo agregar el estudiante debido a concurrencia. Intente nuevamente.',
    );
  }

  private async addStudentInTransaction(
    transaction: Prisma.TransactionClient,
    familyGroupId: string,
    dto: AddFamilyStudentDto,
    auditContext: AuditContext,
  ) {
    const documentType = dto.documentType.trim().toUpperCase();
    const documentNumber = dto.documentNumber.trim();
    const birthDate = this.parseDateOnly(dto.birthDate);

    const family = await transaction.family_groups.findUnique({
      where: { id: familyGroupId },
      select: { id: true, is_active: true },
    });

    if (!family) {
      throw new NotFoundException('El grupo familiar no existe');
    }

    const oldSnapshot = await this.getFamilyAuditSnapshot(
      transaction,
      familyGroupId,
    );

    let person = await transaction.persons.findUnique({
      where: {
        document_type_document_number: {
          document_type: documentType,
          document_number: documentNumber,
        },
      },
    });

    if (!person) {
      person = await transaction.persons.create({
        data: {
          document_type: documentType,
          document_number: documentNumber,
          first_name: dto.firstName.trim(),
          last_name_father: dto.lastNameFather.trim(),
          last_name_mother: dto.lastNameMother.trim(),
          birth_date: birthDate,
          is_active: true,
        },
      });
    } else {
      if (!person.is_active) {
        throw new ConflictException(
          `El estudiante con documento ${documentNumber} corresponde a una persona inactiva. No se reactivará automáticamente.`,
        );
      }

      if (!this.areStudentPersonalDataCompatible(person, dto, birthDate)) {
        throw new ConflictException(
          `Los datos enviados no coinciden con la persona existente con documento ${documentNumber}. No se sobrescribirán automáticamente.`,
        );
      }

      if (person.birth_date === null) {
        person = await transaction.persons.update({
          where: { id: person.id },
          data: { birth_date: birthDate, updated_at: new Date() },
        });
      }
    }

    let student = await transaction.students.findUnique({
      where: { person_id: person.id },
    });

    if (!student) {
      student = await transaction.students.create({
        data: { person_id: person.id, is_active: true },
      });
    } else if (!student.is_active) {
      throw new ConflictException(
        `El estudiante con documento ${documentNumber} está inactivo. No se reactivará automáticamente.`,
      );
    }

    const memberships = await transaction.family_members.findMany({
      where: { person_id: person.id, relationship_type: 'ESTUDIANTE' },
      select: { family_group_id: true },
    });

    if (memberships.some((membership) => membership.family_group_id === familyGroupId)) {
      throw new ConflictException(
        'El estudiante ya pertenece al grupo familiar indicado.',
      );
    }

    if (memberships.length > 0) {
      throw new ConflictException(
        'El estudiante ya pertenece a otro grupo familiar. No se reasignará automáticamente.',
      );
    }

    await transaction.family_members.create({
      data: {
        family_group_id: familyGroupId,
        person_id: person.id,
        relationship_type: 'ESTUDIANTE',
        is_guardian: false,
      },
    });

    if (!family.is_active) {
      await transaction.family_groups.update({
        where: { id: familyGroupId },
        data: { is_active: true, updated_at: new Date() },
      });
    }

    await this.enrollmentsService.createInTransaction(
      transaction,
      {
        studentId: student.id,
        schoolPeriodId: dto.schoolPeriodId,
        classroomId: dto.classroomId,
      },
      auditContext,
    );

    const newSnapshot = await this.getFamilyAuditSnapshot(
      transaction,
      familyGroupId,
    );

    await transaction.audit_logs.create({
      data: {
        user_id: auditContext.userId,
        entity_name: 'family_groups',
        entity_id: familyGroupId,
        action: 'UPDATE',
        old_value: oldSnapshot,
        new_value: newSnapshot,
        ip_address: auditContext.ipAddress,
        device_name: auditContext.deviceName,
      },
    });

    return this.getFamilyResponse(transaction, familyGroupId);
  }

  private async createInTransaction(
    transaction: Prisma.TransactionClient,
    dto: CreateFamilyGroupDto,
    auditContext: AuditContext,
    enrollStudents = true,
    importOnlyNew = false,
  ) {
    // ----------------------------------------------------------
    // 1. Validar periodo
    // ----------------------------------------------------------

    const schoolPeriod =
      await this.validateSchoolPeriod(
        transaction,
        dto.schoolPeriodId,
      );

    // ----------------------------------------------------------
    // 2. Resolver la familia ANTES de modificar personas
    //
    // Esto es importante para:
    // - reutilizar familias existentes
    // - detectar conflictos
    // - mantener correctamente old_value de auditoría
    // ----------------------------------------------------------

    const existingFamily =
      await this.resolveFamilyGroup(
        transaction,
        dto,
        importOnlyNew,
      );

    if (importOnlyNew && existingFamily) {
      throw new ConflictException(
        'Esta familia ya se encuentra registrada en el Sistema de Control de Pagos. Para modificar sus datos utilice Registro Familiar → Editar.',
      );
    }

    const oldSnapshot = existingFamily
      ? await this.getFamilyAuditSnapshot(
          transaction,
          existingFamily.id,
        )
      : null;

    // ----------------------------------------------------------
    // 3. Crear / reutilizar estudiantes
    // ----------------------------------------------------------

    const students =
      await this.createOrReuseStudents(
        transaction,
        dto.students,
        !importOnlyNew,
      );

    const studentPersonIds =
      students.map(
        (item) => item.person.id,
      );

    // ----------------------------------------------------------
    // 4. Crear / reutilizar adultos
    // ----------------------------------------------------------

    const adultPersons =
      await this.createOrReuseAdults(
        transaction,
        dto.adults,
        !importOnlyNew,
      );

    // ----------------------------------------------------------
    // 5. Validaciones cruzadas
    // ----------------------------------------------------------

    this.validateAdultsAreNotStudents(
      studentPersonIds,
      adultPersons,
    );

    this.validateGuardianAge(
      adultPersons,
    );

    // ----------------------------------------------------------
    // 6. Determinar si existe una familia
    // ----------------------------------------------------------

    let familyGroupId: string;
    let action: 'CREATE' | 'UPDATE';

    if (existingFamily) {
      familyGroupId = existingFamily.id;
      action = 'UPDATE';

      // --------------------------------------------------------
      // Familia inactiva:
      //
      // Solo puede reactivarse si realmente se incorpora
      // un estudiante nuevo a dicha familia.
      //
      // Los estudiantes históricos NO se reactivan.
      // --------------------------------------------------------

      if (!existingFamily.is_active) {
        const existingStudentMemberships =
          await transaction.family_members.findMany({
            where: {
              family_group_id:
                existingFamily.id,
              person_id: {
                in: studentPersonIds,
              },
              relationship_type:
                'ESTUDIANTE',
            },
            select: {
              person_id: true,
            },
          });

        const existingStudentIds =
          new Set(
            existingStudentMemberships.map(
              (membership) =>
                membership.person_id,
            ),
          );

        const hasNewStudent =
          studentPersonIds.some(
            (personId) =>
              !existingStudentIds.has(
                personId,
              ),
          );

        if (!hasNewStudent) {
          throw new ConflictException(
            'La familia está inactiva. Su reactivación debe producirse mediante el registro de un nuevo estudiante.',
          );
        }
      }

      // --------------------------------------------------------
      // Agregar estudiantes que aún no pertenezcan a la familia
      // --------------------------------------------------------

      await this.ensureStudentFamilyMembers(
        transaction,
        familyGroupId,
        students,
      );

      // --------------------------------------------------------
      // Agregar adultos que aún no pertenezcan a la familia
      // --------------------------------------------------------

      for (const adult of adultPersons) {
        await this.ensureAdultFamilyMember(
          transaction,
          familyGroupId,
          adult,
        );
      }

      const familyData: Prisma.family_groupsUpdateInput =
        {
          updated_at: new Date(),
        };

      // La reactivación ocurre solamente como consecuencia
      // de incorporar un nuevo estudiante.
      if (!existingFamily.is_active) {
        familyData.is_active = true;
      }

      if (dto.observations !== undefined) {
        familyData.observations =
          this.normalizeOptionalText(
            dto.observations,
          );
      }

      await transaction.family_groups.update({
        where: {
          id: familyGroupId,
        },
        data: familyData,
      });
    } else {
      // --------------------------------------------------------
      // Crear una nueva familia
      // --------------------------------------------------------

      const familyCode =
        await this.generateFamilyCode(
          transaction,
          schoolPeriod.year,
        );

      const familyName =
        this.buildFamilyName(
          adultPersons,
        );

      const familyGroup =
        await transaction.family_groups.create({
          data: {
            code: familyCode,
            name: familyName,
            observations:
              this.normalizeOptionalText(
                dto.observations,
              ),
            is_active: true,
          },
        });

      familyGroupId = familyGroup.id;
      action = 'CREATE';

      // --------------------------------------------------------
      // Registrar estudiantes como integrantes
      // --------------------------------------------------------

      await transaction.family_members.createMany({
        data: students.map((item) => ({
          family_group_id:
            familyGroupId,
          person_id: item.person.id,
          relationship_type:
            'ESTUDIANTE',
          is_guardian: false,
        })),
      });

      // --------------------------------------------------------
      // Registrar adultos como integrantes
      // --------------------------------------------------------

      await transaction.family_members.createMany({
        data: adultPersons.map((adult) => ({
          family_group_id:
            familyGroupId,
          person_id: adult.person.id,
          relationship_type:
            adult.relationshipType,
          is_guardian:
            adult.isGuardian,
        })),
      });
    }

    // ----------------------------------------------------------
    // 7. Verificar que los estudiantes no estén vinculados
    //    a otra familia
    // ----------------------------------------------------------

    await this.validateStudentFamilyMemberships(
      transaction,
      studentPersonIds,
      familyGroupId,
    );

    // ----------------------------------------------------------
    // 8. Crear relaciones estudiante-persona
    // ----------------------------------------------------------

    await this.createStudentPersonRelationships(
      transaction,
      students,
      adultPersons,
    );

    // ----------------------------------------------------------
    // 9. Validar composición final
    // ----------------------------------------------------------

    await this.validateFinalFamilyComposition(
      transaction,
      familyGroupId,
    );

    if (enrollStudents) {
      for (let index = 0; index < students.length; index += 1) {
        await this.enrollmentsService.createInTransaction(
          transaction,
          {
            studentId: students[index].student.id,
            schoolPeriodId: dto.schoolPeriodId,
            classroomId: dto.students[index].classroomId,
          },
          auditContext,
        );
      }
    }

    // ----------------------------------------------------------
    // 10. Regenerar nombre de familia a partir del apoderado
    // ----------------------------------------------------------

    await this.refreshFamilyGroupName(
      transaction,
      familyGroupId,
    );

    // ----------------------------------------------------------
    // 11. Auditoría
    // ----------------------------------------------------------

    const newSnapshot =
      await this.getFamilyAuditSnapshot(
        transaction,
        familyGroupId,
      );

    if (
      action === 'CREATE' ||
      !this.areAuditSnapshotsEqual(
        oldSnapshot,
        newSnapshot,
      )
    ) {
      await transaction.audit_logs.create({
        data: {
          user_id:
            auditContext.userId,
          entity_name:
            'family_groups',
          entity_id:
            familyGroupId,
          action,
          old_value:
            oldSnapshot ?? undefined,
          new_value:
            newSnapshot,
          ip_address:
            auditContext.ipAddress,
          device_name:
            auditContext.deviceName,
        },
      });
    }

    // ----------------------------------------------------------
    // 12. Respuesta final
    // ----------------------------------------------------------

    return this.getFamilyResponse(
      transaction,
      familyGroupId,
    );
  }


  // ============================================================
  // EDICIÓN EXPLÍCITA DE GRUPO FAMILIAR
  // ============================================================

  async update(
    id: string,
    dto: UpdateFamilyGroupDto,
    auditContext: AuditContext,
  ) {
    this.validateUpdateRequest(dto);

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (transaction) => {
            const family =
              await transaction.family_groups.findUnique({
                where: { id },
                include: {
                  family_members: {
                    include: { persons: true },
                  },
                },
              });

            if (!family) {
              throw new NotFoundException(
                'El grupo familiar no existe',
              );
            }

            const oldSnapshot =
              await this.getFamilyAuditSnapshot(
                transaction,
                id,
              );

            const students =
              family.family_members.filter(
                (member) =>
                  member.relationship_type ===
                  'ESTUDIANTE',
              );

            const adults =
              family.family_members.filter(
                (member) =>
                  member.relationship_type !==
                  'ESTUDIANTE',
              );

            // ------------------------------------------------------
            // Los estudiantes no se agregan, eliminan ni reasignan
            // desde la edición familiar. Eso corresponde a Matrículas.
            // ------------------------------------------------------

            const submittedStudentIds =
              new Set(
                dto.students.map(
                  (item) => item.memberId,
                ),
              );

            if (
              submittedStudentIds.size !==
                students.length ||
              students.some(
                (member) =>
                  !submittedStudentIds.has(
                    member.id,
                  ),
              )
            ) {
              throw new ConflictException(
                'La edición familiar no permite agregar, eliminar ni reasignar estudiantes. Esa operación corresponde al módulo de Matrículas.',
              );
            }

            for (const item of dto.students) {
              const member = students.find(
                (value) =>
                  value.id === item.memberId,
              );

              if (!member) {
                throw new BadRequestException(
                  'El estudiante indicado no pertenece al grupo familiar.',
                );
              }

              await transaction.persons.update({
                where: {
                  id: member.person_id,
                },
                data: {
                  first_name:
                    item.firstName.trim(),
                  last_name_father:
                    item.lastNameFather.trim(),
                  last_name_mother:
                    item.lastNameMother.trim(),
                  birth_date:
                    this.parseDateOnly(
                      item.birthDate,
                    ),
                  updated_at: new Date(),
                },
              });
            }

            // ------------------------------------------------------
            // Los adultos existentes deben permanecer en la familia.
            // Se permite agregar un adulto ya existente en persons.
            // ------------------------------------------------------

            const submittedExistingAdultIds =
              new Set(
                dto.adults
                  .map(
                    (item) => item.memberId,
                  )
                  .filter(
                    (
                      value,
                    ): value is string =>
                      Boolean(value),
                  ),
              );

            if (
              adults.some(
                (member) =>
                  !submittedExistingAdultIds.has(
                    member.id,
                  ),
              )
            ) {
              throw new ConflictException(
                'La edición familiar debe conservar todos los integrantes adultos existentes. Para retirar un integrante se requiere una operación familiar explícita.',
              );
            }

            for (const item of dto.adults) {
              const relationshipType =
                item.relationshipType
                  .trim()
                  .toUpperCase();

              let member = item.memberId
                ? adults.find(
                    (value) =>
                      value.id ===
                      item.memberId,
                  )
                : undefined;

              let personId: string;

              if (
                item.memberId &&
                !member
              ) {
                throw new BadRequestException(
                  'El integrante adulto indicado no pertenece al grupo familiar.',
                );
              }

              if (!member) {
                const person =
                  await transaction.persons.findUnique(
                    {
                      where: {
                        document_type_document_number:
                          {
                            document_type:
                              item.documentType
                                .trim()
                                .toUpperCase(),
                            document_number:
                              item.documentNumber.trim(),
                          },
                      },
                    },
                  );

                if (!person) {
                  throw new BadRequestException(
                    `La persona con documento ${item.documentNumber.trim()} no existe.`,
                  );
                }

                if (!person.is_active) {
                  throw new ConflictException(
                    `La persona con documento ${item.documentNumber.trim()} está inactiva y no puede incorporarse a la familia.`,
                  );
                }

                if (
                  family.family_members.some(
                    (value) =>
                      value.person_id ===
                      person.id,
                  )
                ) {
                  throw new ConflictException(
                    `La persona con documento ${item.documentNumber.trim()} ya pertenece al grupo familiar.`,
                  );
                }

                member =
                  await transaction.family_members.create(
                    {
                      data: {
                        family_group_id: id,
                        person_id: person.id,
                        relationship_type:
                          relationshipType,
                        is_guardian:
                          item.isGuardian,
                      },
                      include: {
                        persons: true,
                      },
                    },
                  );

                personId = person.id;
              } else {
                personId =
                  member.person_id;

                // La identidad documental de una persona existente
                // no se modifica desde la edición familiar.
                const currentDocumentType =
                  member.persons.document_type
                    .trim()
                    .toUpperCase();
                const currentDocumentNumber =
                  member.persons.document_number?.trim() ??
                  '';
                const submittedDocumentType =
                  item.documentType
                    .trim()
                    .toUpperCase();
                const submittedDocumentNumber =
                  item.documentNumber.trim();

                if (
                  currentDocumentType !==
                    submittedDocumentType ||
                  currentDocumentNumber !==
                    submittedDocumentNumber
                ) {
                  throw new ConflictException(
                    'El documento de un integrante existente no puede modificarse desde la edición familiar.',
                  );
                }

                await transaction.family_members.update(
                  {
                    where: {
                      id: member.id,
                    },
                    data: {
                      relationship_type:
                        relationshipType,
                      is_guardian:
                        item.isGuardian,
                    },
                  },
                );
              }

              await transaction.persons.update({
                where: {
                  id: personId,
                },
                data: {
                  first_name:
                    item.firstName.trim(),
                  last_name_father:
                    this.normalizeOptionalText(
                      item.lastNameFather,
                    ),
                  last_name_mother:
                    this.normalizeOptionalText(
                      item.lastNameMother,
                    ),
                  birth_date: item.birthDate
                    ? this.parseDateOnly(
                        item.birthDate,
                      )
                    : null,
                  phone:
                    this.normalizeOptionalText(
                      item.phone,
                    ),
                  email:
                    this.normalizeOptionalText(
                      item.email,
                    )?.toLowerCase() ?? null,
                  address:
                    this.normalizeOptionalText(
                      item.address,
                    ),
                  updated_at: new Date(),
                },
              });
            }

            // ------------------------------------------------------
            // Validar composición final con el estado real de BD.
            // ------------------------------------------------------

            const finalMembers =
              await transaction.family_members.findMany(
                {
                  where: {
                    family_group_id: id,
                  },
                  include: {
                    persons: true,
                  },
                },
              );

            this.validateEditComposition(
              finalMembers,
            );

            await transaction.family_groups.update({
              where: { id },
              data: {
                observations:
                  dto.observations ===
                  undefined
                    ? family.observations
                    : this.normalizeOptionalText(
                        dto.observations,
                      ),
                updated_at: new Date(),
              },
            });

            await this.refreshFamilyGroupName(
              transaction,
              id,
            );

            const newSnapshot =
              await this.getFamilyAuditSnapshot(
                transaction,
                id,
              );

            if (
              !this.areAuditSnapshotsEqual(
                oldSnapshot,
                newSnapshot,
              )
            ) {
              await transaction.audit_logs.create(
                {
                  data: {
                    user_id:
                      auditContext.userId,
                    entity_name:
                      'family_groups',
                    entity_id: id,
                    action: 'UPDATE',
                    old_value:
                      oldSnapshot,
                    new_value:
                      newSnapshot,
                    ip_address:
                      auditContext.ipAddress,
                    device_name:
                      auditContext.deviceName,
                  },
                },
              );
            }

            return this.getFamilyResponse(
              transaction,
              id,
            );
          },
          {
            isolationLevel:
              Prisma.TransactionIsolationLevel
                .Serializable,
            maxWait: 5000,
            timeout: 15000,
          },
        );
      } catch (error: unknown) {
        if (
          error instanceof
            Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034' &&
          attempt < 3
        ) {
          continue;
        }

        this.handleCreateError(error);
      }
    }

    throw new ConflictException(
      'No se pudo completar la edición debido a concurrencia. Intente nuevamente.',
    );
  }

  private validateUpdateRequest(
    dto: UpdateFamilyGroupDto,
  ): void {
    if (!dto.students?.length) {
      throw new BadRequestException(
        'La familia debe conservar al menos un estudiante.',
      );
    }

    if (!dto.adults?.length) {
      throw new BadRequestException(
        'La familia debe conservar al menos un adulto.',
      );
    }

    if (
      dto.adults.filter(
        (item) => item.isGuardian,
      ).length !== 1
    ) {
      throw new BadRequestException(
        'La familia debe tener exactamente un apoderado.',
      );
    }

    if (
      dto.adults.filter(
        (item) =>
          item.relationshipType
            .trim()
            .toUpperCase() === 'PADRE',
      ).length > 1
    ) {
      throw new BadRequestException(
        'La familia no puede tener más de un PADRE.',
      );
    }

    if (
      dto.adults.filter(
        (item) =>
          item.relationshipType
            .trim()
            .toUpperCase() === 'MADRE',
      ).length > 1
    ) {
      throw new BadRequestException(
        'La familia no puede tener más de una MADRE.',
      );
    }

    const adultDocuments =
      new Set<string>();

    for (const adult of dto.adults) {
      const relationshipType =
        adult.relationshipType
          .trim()
          .toUpperCase();
      const documentType =
        adult.documentType.trim();
      const documentNumber =
        adult.documentNumber.trim();

      if (!documentType) {
        throw new BadRequestException(
          'El tipo de documento del adulto es obligatorio.',
        );
      }

      if (!documentNumber) {
        throw new BadRequestException(
          'El número de documento del adulto es obligatorio.',
        );
      }

      if (!ALLOWED_RELATIONSHIP_TYPES.has(relationshipType)) {
        throw new BadRequestException(
          `El parentesco ${relationshipType} no está permitido.`,
        );
      }

      const documentKey =
        this.buildDocumentKey(
          documentType,
          documentNumber,
        );

      if (adultDocuments.has(documentKey)) {
        throw new BadRequestException(
          'No se puede enviar el mismo documento más de una vez en la edición.',
        );
      }

      adultDocuments.add(documentKey);

      if (!adult.firstName.trim()) {
        throw new BadRequestException(
          'El nombre del adulto es obligatorio.',
        );
      }

      if (
        adult.isGuardian &&
        !adult.birthDate
      ) {
        throw new BadRequestException(
          'El apoderado debe tener fecha de nacimiento registrada.',
        );
      }
    }

    const studentMemberIds =
      new Set<string>();

    for (const student of dto.students) {
      if (
        studentMemberIds.has(
          student.memberId,
        )
      ) {
        throw new BadRequestException(
          'No se puede enviar el mismo estudiante más de una vez en la edición.',
        );
      }

      studentMemberIds.add(
        student.memberId,
      );

      if (
        !student.firstName.trim() ||
        !student.lastNameFather.trim() ||
        !student.lastNameMother.trim()
      ) {
        throw new BadRequestException(
          'Los nombres y apellidos del estudiante son obligatorios.',
        );
      }
    }
  }

  private validateEditComposition(
    members: Array<{
      relationship_type: string;
      is_guardian: boolean;
      persons: persons;
    }>,
  ): void {
    const students =
      members.filter(
        (member) =>
          member.relationship_type ===
          'ESTUDIANTE',
      );

    const adults =
      members.filter(
        (member) =>
          member.relationship_type !==
          'ESTUDIANTE',
      );

    if (students.length === 0) {
      throw new ConflictException(
        'La familia debe conservar al menos un estudiante.',
      );
    }

    if (adults.length === 0) {
      throw new ConflictException(
        'La familia debe conservar al menos un adulto.',
      );
    }

    if (
      adults.filter(
        (member) =>
          member.relationship_type ===
          'PADRE',
      ).length > 1
    ) {
      throw new ConflictException(
        'La familia no puede tener más de un PADRE.',
      );
    }

    if (
      adults.filter(
        (member) =>
          member.relationship_type ===
          'MADRE',
      ).length > 1
    ) {
      throw new ConflictException(
        'La familia no puede tener más de una MADRE.',
      );
    }

    const guardians = adults.filter(
      (member) =>
        member.is_guardian &&
        member.persons.is_active,
    );

    if (guardians.length !== 1) {
      throw new ConflictException(
        'La familia debe tener exactamente un apoderado activo.',
      );
    }

    const guardian = guardians[0];

    if (!guardian.persons.birth_date) {
      throw new ConflictException(
        'El apoderado debe tener fecha de nacimiento registrada.',
      );
    }

    if (
      this.calculateAge(
        guardian.persons.birth_date,
      ) < 18
    ) {
      throw new ConflictException(
        'El apoderado debe ser mayor de edad (18 años o más).',
      );
    }
  }

  // ============================================================
  // VALIDACIONES INICIALES
  // ============================================================

  private validateCreateRequest(
    dto: CreateFamilyGroupDto,
  ): void {
    if (
      !dto.students ||
      dto.students.length === 0
    ) {
      throw new BadRequestException(
        'El grupo familiar debe tener al menos un estudiante',
      );
    }

    if (
      !dto.adults ||
      dto.adults.length === 0
    ) {
      throw new BadRequestException(
        'El grupo familiar debe tener al menos un adulto',
      );
    }

    // ----------------------------------------------------------
    // Apoderado
    // ----------------------------------------------------------

    const guardians =
      dto.adults.filter(
        (adult) =>
          adult.isGuardian === true,
      );

    if (guardians.length !== 1) {
      throw new BadRequestException(
        'El grupo familiar debe tener exactamente un adulto marcado como apoderado',
      );
    }

    // ----------------------------------------------------------
    // PADRE
    // ----------------------------------------------------------

    const fatherCount =
      dto.adults.filter(
        (adult) =>
          adult.relationshipType
            .trim()
            .toUpperCase() ===
          'PADRE',
      ).length;

    if (fatherCount > 1) {
      throw new BadRequestException(
        'El grupo familiar no puede tener más de un PADRE',
      );
    }

    // ----------------------------------------------------------
    // MADRE
    // ----------------------------------------------------------

    const motherCount =
      dto.adults.filter(
        (adult) =>
          adult.relationshipType
            .trim()
            .toUpperCase() ===
          'MADRE',
      ).length;

    if (motherCount > 1) {
      throw new BadRequestException(
        'El grupo familiar no puede tener más de una MADRE',
      );
    }

    // ----------------------------------------------------------
    // Validar adultos
    // ----------------------------------------------------------

    const adultDocumentKeys =
      new Set<string>();

    for (
      let index = 0;
      index < dto.adults.length;
      index++
    ) {
      const adult = dto.adults[index];

      const documentType =
        this.normalizeOptionalText(
          adult.documentType,
        );

      const documentNumber =
        this.normalizeOptionalText(
          adult.documentNumber,
        );

      const firstName =
        this.normalizeOptionalText(
          adult.firstName,
        );

      const relationshipType =
        this.normalizeOptionalText(
          adult.relationshipType,
        )?.toUpperCase();

      if (!documentType) {
        throw new BadRequestException(
          `El tipo de documento del adulto ${index + 1} es obligatorio`,
        );
      }

      if (!documentNumber) {
        throw new BadRequestException(
          `El número de documento del adulto ${index + 1} es obligatorio`,
        );
      }

      if (!firstName) {
        throw new BadRequestException(
          `El nombre del adulto ${index + 1} es obligatorio`,
        );
      }

      if (!relationshipType) {
        throw new BadRequestException(
          `El parentesco del adulto ${index + 1} es obligatorio`,
        );
      }

      if (
        !ALLOWED_RELATIONSHIP_TYPES.has(
          relationshipType,
        )
      ) {
        throw new BadRequestException(
          `El parentesco ${relationshipType} no está permitido`,
        );
      }

      const documentKey =
        this.buildDocumentKey(
          documentType,
          documentNumber,
        );

      if (
        adultDocumentKeys.has(
          documentKey,
        )
      ) {
        throw new BadRequestException(
          'No se puede registrar al mismo adulto más de una vez en la misma operación',
        );
      }

      adultDocumentKeys.add(
        documentKey,
      );
    }

    // ----------------------------------------------------------
    // Validar estudiantes
    // ----------------------------------------------------------

    const studentDocumentKeys =
      new Set<string>();

    for (
      let index = 0;
      index < dto.students.length;
      index++
    ) {
      const student =
        dto.students[index];

      const documentType =
        this.normalizeOptionalText(
          student.documentType,
        );

      const documentNumber =
        this.normalizeOptionalText(
          student.documentNumber,
        );

      const firstName =
        this.normalizeOptionalText(
          student.firstName,
        );

      const lastNameFather =
        this.normalizeOptionalText(
          student.lastNameFather,
        );

      const lastNameMother =
        this.normalizeOptionalText(
          student.lastNameMother,
        );

      if (!documentType) {
        throw new BadRequestException(
          `El tipo de documento del estudiante ${index + 1} es obligatorio`,
        );
      }

      if (!documentNumber) {
        throw new BadRequestException(
          `El número de documento del estudiante ${index + 1} es obligatorio`,
        );
      }

      if (!firstName) {
        throw new BadRequestException(
          `El nombre del estudiante ${index + 1} es obligatorio`,
        );
      }

      if (!lastNameFather) {
        throw new BadRequestException(
          `El apellido paterno del estudiante ${index + 1} es obligatorio`,
        );
      }

      if (!lastNameMother) {
        throw new BadRequestException(
          `El apellido materno del estudiante ${index + 1} es obligatorio`,
        );
      }

      const documentKey =
        this.buildDocumentKey(
          documentType,
          documentNumber,
        );

      if (
        studentDocumentKeys.has(
          documentKey,
        )
      ) {
        throw new BadRequestException(
          'No se puede registrar al mismo estudiante más de una vez en la misma operación',
        );
      }

      studentDocumentKeys.add(
        documentKey,
      );
    }
  }

  // ============================================================
  // PERIODO ESCOLAR
  // ============================================================

  private async validateSchoolPeriod(
    transaction: Prisma.TransactionClient,
    schoolPeriodId: string,
  ) {
    const schoolPeriod =
      await transaction.school_periods.findUnique(
        {
          where: {
            id: schoolPeriodId,
          },
        },
      );

    if (!schoolPeriod) {
      throw new NotFoundException(
        'El periodo escolar no existe',
      );
    }

    if (
      !schoolPeriod.is_active ||
        schoolPeriod.status !==
        'OPEN'
    ) {
      throw new BadRequestException(
        'El periodo escolar no está activo',
      );
    }

    return schoolPeriod;
  }

  // ============================================================
  // ESTUDIANTES
  // ============================================================

  private async createOrReuseStudents(
    transaction: Prisma.TransactionClient,
    studentDtos: CreateFamilyGroupDto['students'],
    completeExistingData = true,
  ): Promise<StudentData[]> {
    const result: StudentData[] = [];

    for (const studentDto of studentDtos) {
      const documentType =
        studentDto.documentType
          .trim()
          .toUpperCase();

      const documentNumber =
        studentDto.documentNumber.trim();

      let person =
        await transaction.persons.findUnique(
          {
            where: {
              document_type_document_number: {
                document_type:
                  documentType,
                document_number:
                  documentNumber,
              },
            },
          },
        );

      // --------------------------------------------------------
      // Persona inexistente
      // --------------------------------------------------------

      if (!person) {
        person =
          await transaction.persons.create({
            data: {
              document_type:
                documentType,
              document_number:
                documentNumber,
              first_name:
                studentDto.firstName.trim(),
              last_name_father:
                studentDto.lastNameFather.trim(),
              last_name_mother:
                studentDto.lastNameMother.trim(),
              birth_date:
                this.parseDateOnly(
                  studentDto.birthDate,
                ),
              is_active: true,
            },
          });
      } else {
        // ------------------------------------------------------
        // Persona histórica/inactiva:
        //
        // No se reactiva automáticamente porque puede
        // representar un estudiante histórico.
        // ------------------------------------------------------

        if (!person.is_active) {
          throw new ConflictException(
            `El estudiante con documento ${documentNumber} corresponde a una persona inactiva. No se reactivará automáticamente.`,
          );
        }

        // ------------------------------------------------------
        // No sobrescribir datos existentes.
        //
        // Solo completamos birth_date si estaba ausente.
        // ------------------------------------------------------

        const updateData: Prisma.personsUpdateInput =
          {};

        if (
          completeExistingData &&
          person.birth_date === null
        ) {
          updateData.birth_date =
            this.parseDateOnly(
              studentDto.birthDate,
            );
        }

        if (
          Object.keys(updateData)
            .length > 0
        ) {
          updateData.updated_at =
            new Date();

          person =
            await transaction.persons.update(
              {
                where: {
                  id: person.id,
                },
                data: updateData,
              },
            );
        }
      }

      // --------------------------------------------------------
      // Buscar estudiante asociado a la persona
      // --------------------------------------------------------

      let student =
        await transaction.students.findUnique(
          {
            where: {
              person_id: person.id,
            },
          },
        );

      let isNewStudent = false;

      // --------------------------------------------------------
      // Crear estudiante
      // --------------------------------------------------------

      if (!student) {
        student =
          await transaction.students.create(
            {
              data: {
                person_id:
                  person.id,
                is_active: true,
              },
            },
          );

        isNewStudent = true;
      } else {
        // ------------------------------------------------------
        // Estudiante histórico
        // ------------------------------------------------------

        if (!student.is_active) {
          throw new ConflictException(
            `El estudiante con documento ${documentNumber} está inactivo. No se reactivará automáticamente.`,
          );
        }
      }

      result.push({
        student,
        person,
        isNewStudent,
      });
    }

    return result;
  }

  // ============================================================
  // ADULTOS
  // ============================================================

  private async createOrReuseAdults(
    transaction: Prisma.TransactionClient,
    adults: CreateFamilyGroupDto['adults'],
    completeExistingData = true,
  ): Promise<AdultPersonData[]> {
    const result: AdultPersonData[] = [];

    for (const adult of adults) {
      const documentType =
        adult.documentType
          .trim()
          .toUpperCase();

      const documentNumber =
        adult.documentNumber.trim();

      const relationshipType =
        adult.relationshipType
          .trim()
          .toUpperCase();

      let person =
        await transaction.persons.findUnique(
          {
            where: {
              document_type_document_number: {
                document_type:
                  documentType,
                document_number:
                  documentNumber,
              },
            },
          },
        );

      // --------------------------------------------------------
      // Persona inexistente
      // --------------------------------------------------------

      if (!person) {
        person =
          await transaction.persons.create({
            data: {
              document_type:
                documentType,
              document_number:
                documentNumber,
              first_name:
                adult.firstName.trim(),
              last_name_father:
                this.normalizeOptionalText(
                  adult.lastNameFather,
                ),
              last_name_mother:
                this.normalizeOptionalText(
                  adult.lastNameMother,
                ),
              birth_date:
                adult.birthDate
                  ? this.parseDateOnly(
                      adult.birthDate,
                    )
                  : null,
              phone:
                this.normalizeOptionalText(
                  adult.phone,
                ),
              email:
                this.normalizeOptionalText(
                  adult.email,
                )?.toLowerCase() ??
                null,
              address:
                this.normalizeOptionalText(
                  adult.address,
                ),
              is_active: true,
            },
          });
      } else {
        // ------------------------------------------------------
        // No sobrescribir silenciosamente datos personales.
        // ------------------------------------------------------

        const updateData: Prisma.personsUpdateInput =
          {};

        if (
          completeExistingData &&
          person.birth_date === null &&
          adult.birthDate
        ) {
          updateData.birth_date =
            this.parseDateOnly(
              adult.birthDate,
            );
        }

        // Una persona adulta puede volver a ser utilizada
        // posteriormente.
        if (!person.is_active && completeExistingData) {
          updateData.is_active = true;
        }

        if (!person.is_active && !completeExistingData) {
          throw new ConflictException(
            `La persona adulta con documento ${documentNumber} está inactiva. No se reactivará desde la importación.`,
          );
        }

        if (
          Object.keys(updateData)
            .length > 0
        ) {
          updateData.updated_at =
            new Date();

          person =
            await transaction.persons.update(
              {
                where: {
                  id: person.id,
                },
                data: updateData,
              },
            );
        }
      }

      result.push({
        person,
        relationshipType,
        isGuardian:
          adult.isGuardian,
      });
    }

    return result;
  }

  // ============================================================
  // VALIDACIONES CRUZADAS
  // ============================================================

  private validateAdultsAreNotStudents(
    studentPersonIds: string[],
    adults: AdultPersonData[],
  ): void {
    const studentPersonIdSet =
      new Set(studentPersonIds);

    const invalidAdult =
      adults.find((adult) =>
        studentPersonIdSet.has(
          adult.person.id,
        ),
      );

    if (!invalidAdult) {
      return;
    }

    throw new BadRequestException(
      `La persona con documento ${invalidAdult.person.document_number} no puede registrarse simultáneamente como estudiante y adulto`,
    );
  }

  private validateGuardianAge(
    adults: AdultPersonData[],
  ): void {
    const guardian =
      adults.find(
        (adult) => adult.isGuardian,
      );

    if (!guardian) {
      throw new BadRequestException(
        'El grupo familiar debe tener un apoderado',
      );
    }

    if (!guardian.person.birth_date) {
      throw new BadRequestException(
        'El apoderado debe tener fecha de nacimiento registrada',
      );
    }

    const age =
      this.calculateAge(
        guardian.person.birth_date,
      );

    if (age < 18) {
      throw new ConflictException(
        'El apoderado debe ser mayor de edad (18 años o más)',
      );
    }
  }

  private calculateAge(
    birthDate: Date,
  ): number {
    const today = new Date();

    let age =
      today.getUTCFullYear() -
      birthDate.getUTCFullYear();

    const monthDifference =
      today.getUTCMonth() -
      birthDate.getUTCMonth();

    if (
      monthDifference < 0 ||
      (
        monthDifference === 0 &&
        today.getUTCDate() <
          birthDate.getUTCDate()
      )
    ) {
      age--;
    }

    return age;
  }

  // ============================================================
  // RESOLUCIÓN DE FAMILIA
  // ============================================================

  private async resolveFamilyGroup(
    transaction: Prisma.TransactionClient,
    dto: CreateFamilyGroupDto,
    allowSharedAdultsForNewFamily = false,
  ): Promise<FamilyReference | null> {
    // ----------------------------------------------------------
    // 1. Resolver personas de estudiantes existentes
    // ----------------------------------------------------------

    const studentPersonIds: string[] = [];

    for (const studentDto of dto.students) {
      const person =
        await transaction.persons.findUnique(
          {
            where: {
              document_type_document_number: {
                document_type:
                  studentDto.documentType
                    .trim()
                    .toUpperCase(),
                document_number:
                  studentDto.documentNumber.trim(),
              },
            },
            select: {
              id: true,
            },
          },
        );

      if (person) {
        studentPersonIds.push(
          person.id,
        );
      }
    }

    // ----------------------------------------------------------
    // 2. Obtener familias asociadas a estudiantes
    //
    // Se consideran activas e inactivas.
    //
    // Una familia histórica sigue siendo la misma familia.
    // ----------------------------------------------------------

    const studentFamilyMemberships =
      studentPersonIds.length > 0
        ? await transaction.family_members.findMany(
            {
              where: {
                person_id: {
                  in: studentPersonIds,
                },
                relationship_type:
                  'ESTUDIANTE',
              },
              select: {
                person_id: true,
                family_group_id:
                  true,
                family_groups: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    is_active: true,
                  },
                },
              },
            },
          )
        : [];

    const familyIdsByStudent =
      new Map<
        string,
        Set<string>
      >();

    const families =
      new Map<
        string,
        FamilyReference
      >();

    for (
      const membership of studentFamilyMemberships
    ) {
      let familyIds =
        familyIdsByStudent.get(
          membership.person_id,
        );

      if (!familyIds) {
        familyIds = new Set<string>();

        familyIdsByStudent.set(
          membership.person_id,
          familyIds,
        );
      }

      familyIds.add(
        membership.family_group_id,
      );

      families.set(
        membership.family_group_id,
        membership.family_groups,
      );
    }

    // ----------------------------------------------------------
    // Un estudiante no debe pertenecer a más de una familia.
    // ----------------------------------------------------------

    for (
      const studentPersonId of studentPersonIds
    ) {
      const familyIds =
        familyIdsByStudent.get(
          studentPersonId,
        );

      if (
        familyIds &&
        familyIds.size > 1
      ) {
        throw new ConflictException(
          `El estudiante ${studentPersonId} pertenece a más de un grupo familiar. Se requiere revisar la información antes de continuar.`,
        );
      }
    }

    // ----------------------------------------------------------
    // 3. Determinar familia candidata por estudiantes
    // ----------------------------------------------------------

    const studentFamilyIds =
      new Set<string>();

    for (
      const familyIds of familyIdsByStudent.values()
    ) {
      for (const familyId of familyIds) {
        studentFamilyIds.add(
          familyId,
        );
      }
    }

    if (studentFamilyIds.size > 1) {
      const codes =
        [...studentFamilyIds]
          .map(
            (familyId) =>
              families.get(
                familyId,
              )?.code ??
              familyId,
          )
          .join(', ');

      throw new ConflictException(
        `Los estudiantes seleccionados pertenecen a diferentes grupos familiares: ${codes}. No se realizará una fusión automática.`,
      );
    }

    // ----------------------------------------------------------
    // 4. Resolver personas de adultos existentes
    // ----------------------------------------------------------

    const adultPersonIds: string[] = [];

    for (const adultDto of dto.adults) {
      const person =
        await transaction.persons.findUnique(
          {
            where: {
              document_type_document_number: {
                document_type:
                  adultDto.documentType
                    .trim()
                    .toUpperCase(),
                document_number:
                  adultDto.documentNumber.trim(),
              },
            },
            select: {
              id: true,
            },
          },
        );

      if (person) {
        adultPersonIds.push(
          person.id,
        );
      }
    }

    // ----------------------------------------------------------
    // 5. Obtener familias de adultos
    //
    // Un adulto puede pertenecer a múltiples familias.
    // ----------------------------------------------------------

    const adultFamilyMemberships =
      adultPersonIds.length > 0
        ? await transaction.family_members.findMany(
            {
              where: {
                person_id: {
                  in: adultPersonIds,
                },
              },
              select: {
                person_id: true,
                family_group_id:
                  true,
                family_groups: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    is_active: true,
                  },
                },
              },
            },
          )
        : [];

    const familyIdsByAdult =
      new Map<
        string,
        Set<string>
      >();

    for (
      const membership of adultFamilyMemberships
    ) {
      let familyIds =
        familyIdsByAdult.get(
          membership.person_id,
        );

      if (!familyIds) {
        familyIds = new Set<string>();

        familyIdsByAdult.set(
          membership.person_id,
          familyIds,
        );
      }

      familyIds.add(
        membership.family_group_id,
      );

      families.set(
        membership.family_group_id,
        membership.family_groups,
      );
    }

    // ----------------------------------------------------------
    // 6. Si un estudiante ya determina la familia:
    //
    // Los adultos deben ser compatibles con esa familia.
    //
    // Un adulto puede pertenecer además a otras familias;
    // eso no es problema porque el estudiante determina
    // inequívocamente el contexto.
    // ----------------------------------------------------------

    if (studentFamilyIds.size === 1) {
      const familyId =
        [...studentFamilyIds][0];

      for (
        const [
          personId,
          familyIds,
        ] of familyIdsByAdult.entries()
      ) {
        if (
          familyIds.size > 0 &&
          !familyIds.has(familyId)
        ) {
          throw new ConflictException(
            `La persona ${personId} pertenece a otra familia diferente de la familia determinada por los estudiantes. No se realizará una fusión automática.`,
          );
        }
      }

      return (
        families.get(
          familyId,
        ) ?? null
      );
    }

    // ----------------------------------------------------------
    // 7. No existe familia determinada por estudiantes.
    //
    // Entonces los adultos pueden determinarla.
    // ----------------------------------------------------------

    const adultFamilyIds =
      new Set<string>();

    for (
      const familyIds of familyIdsByAdult.values()
    ) {
      for (const familyId of familyIds) {
        adultFamilyIds.add(
          familyId,
        );
      }
    }

    // ----------------------------------------------------------
    // Si diferentes adultos apuntan a familias diferentes,
    // no debemos escoger arbitrariamente una.
    // ----------------------------------------------------------

    if (adultFamilyIds.size > 1) {
      if (allowSharedAdultsForNewFamily) {
        return null;
      }
      const codes =
        [...adultFamilyIds]
          .map(
            (familyId) =>
              families.get(
                familyId,
              )?.code ??
              familyId,
          )
          .join(', ');

      throw new ConflictException(
        `Los adultos registrados pertenecen a diferentes grupos familiares: ${codes}. No se realizará una fusión automática.`,
      );
    }

    if (adultFamilyIds.size === 1) {
      const familyId =
        [...adultFamilyIds][0];

      return (
        families.get(
          familyId,
        ) ?? null
      );
    }

    // ----------------------------------------------------------
    // No existe ninguna familia previa.
    // Se creará una nueva.
    // ----------------------------------------------------------

    return null;
  }

  // ============================================================
  // FAMILY MEMBERS - ESTUDIANTES
  // ============================================================

  private async ensureStudentFamilyMembers(
    transaction: Prisma.TransactionClient,
    familyGroupId: string,
    students: StudentData[],
  ): Promise<void> {
    const personIds =
      students.map(
        (student) =>
          student.person.id,
      );

    const existing =
      await transaction.family_members.findMany(
        {
          where: {
            family_group_id:
              familyGroupId,
            person_id: {
              in: personIds,
            },
          },
          select: {
            person_id: true,
            relationship_type: true,
            is_guardian: true,
          },
        },
      );

    const existingByPerson =
      new Map(
        existing.map(
          (member) => [
            member.person_id,
            member,
          ],
        ),
      );

    const missing: Array<{
      family_group_id: string;
      person_id: string;
      relationship_type: string;
      is_guardian: boolean;
    }> = [];

    for (const student of students) {
      const current =
        existingByPerson.get(
          student.person.id,
        );

      if (!current) {
        missing.push({
          family_group_id:
            familyGroupId,
          person_id:
            student.person.id,
          relationship_type:
            'ESTUDIANTE',
          is_guardian: false,
        });

        continue;
      }

      if (
        current.relationship_type !==
          'ESTUDIANTE' ||
        current.is_guardian
      ) {
        throw new ConflictException(
          'Un estudiante ya pertenece a esta familia con una relación incompatible. No se modificará automáticamente su relación existente.',
        );
      }
    }

    if (missing.length > 0) {
      await transaction.family_members.createMany(
        {
          data: missing,
        },
      );
    }
  }

  // ============================================================
  // FAMILY MEMBERS - ADULTOS
  // ============================================================

  private async ensureAdultFamilyMember(
    transaction: Prisma.TransactionClient,
    familyGroupId: string,
    adult: AdultPersonData,
  ): Promise<void> {
    const existing =
      await transaction.family_members.findUnique(
        {
          where: {
            family_group_id_person_id: {
              family_group_id:
                familyGroupId,
              person_id:
                adult.person.id,
            },
          },
        },
      );

    if (existing) {
      if (
        existing.relationship_type !==
          adult.relationshipType ||
        existing.is_guardian !==
          adult.isGuardian
      ) {
        throw new ConflictException(
          `La persona con documento ${adult.person.document_number} ya pertenece a la familia con una relación diferente. Para cambiarla se requiere una operación explícita de edición familiar.`,
        );
      }

      return;
    }

    // ----------------------------------------------------------
    // PADRE / MADRE únicos por familia
    // ----------------------------------------------------------

    if (
      adult.relationshipType ===
        'PADRE' ||
      adult.relationshipType ===
        'MADRE'
    ) {
      const count =
        await transaction.family_members.count(
          {
            where: {
              family_group_id:
                familyGroupId,
              relationship_type:
                adult.relationshipType,
            },
          },
        );

      if (count > 0) {
        throw new ConflictException(
          `El grupo familiar ya tiene registrado un ${adult.relationshipType}. No se reemplazará automáticamente.`,
        );
      }
    }

    // ----------------------------------------------------------
    // Un solo apoderado activo
    // ----------------------------------------------------------

    if (adult.isGuardian) {
      const activeGuardianCount =
        await transaction.family_members.count(
          {
            where: {
              family_group_id:
                familyGroupId,
              is_guardian: true,
              persons: {
                is_active: true,
              },
            },
          },
        );

      if (
        activeGuardianCount > 0
      ) {
        throw new ConflictException(
          'El grupo familiar ya tiene un apoderado activo. El cambio de apoderado debe realizarse mediante una operación explícita de edición familiar.',
        );
      }
    }

    await transaction.family_members.create({
      data: {
        family_group_id:
          familyGroupId,
        person_id:
          adult.person.id,
        relationship_type:
          adult.relationshipType,
        is_guardian:
          adult.isGuardian,
      },
    });
  }

  // ============================================================
  // VALIDAR FAMILIA DE ESTUDIANTES
  // ============================================================

  private async validateStudentFamilyMemberships(
    transaction: Prisma.TransactionClient,
    studentPersonIds: string[],
    expectedFamilyGroupId: string,
  ): Promise<void> {
    const memberships =
      await transaction.family_members.findMany(
        {
          where: {
            person_id: {
              in: studentPersonIds,
            },
            relationship_type:
              'ESTUDIANTE',
          },
          select: {
            person_id: true,
            family_group_id:
              true,
            persons: {
              select: {
                first_name: true,
                last_name_father:
                  true,
                last_name_mother:
                  true,
              },
            },
          },
        },
      );

    const invalidMemberships =
      memberships.filter(
        (membership) =>
          membership.family_group_id !==
          expectedFamilyGroupId,
      );

    if (
      invalidMemberships.length === 0
    ) {
      return;
    }

    const names =
      invalidMemberships
        .map((membership) =>
          this.buildFullName({
            firstName:
              membership.persons
                .first_name,
            lastNameFather:
              membership.persons
                .last_name_father,
            lastNameMother:
              membership.persons
                .last_name_mother,
          }),
        )
        .join(', ');

    throw new ConflictException(
      `Los siguientes estudiantes ya pertenecen a otro grupo familiar: ${names}`,
    );
  }

  // ============================================================
  // RELACIONES ESTUDIANTE - ADULTO
  // ============================================================

  private async createStudentPersonRelationships(
    transaction: Prisma.TransactionClient,
    students: StudentData[],
    adults: AdultPersonData[],
  ): Promise<void> {
    const relationships =
      students.flatMap(
        (student) =>
          adults.map((adult) => ({
            student_id:
              student.student.id,
            person_id:
              adult.person.id,
            relationship_type:
              adult.relationshipType,
            is_guardian:
              adult.isGuardian,
          })),
      );

    if (
      relationships.length === 0
    ) {
      return;
    }

    await transaction.student_person_relationships.createMany(
      {
        data: relationships,
        skipDuplicates: true,
      },
    );
  }

  // ============================================================
  // COMPOSICIÓN FINAL
  // ============================================================

  private async validateFinalFamilyComposition(
    transaction: Prisma.TransactionClient,
    familyGroupId: string,
  ): Promise<void> {
    const members =
      await transaction.family_members.findMany(
        {
          where: {
            family_group_id:
              familyGroupId,
          },
          include: {
            persons: true,
          },
        },
      );

    const students =
      members.filter(
        (member) =>
          member.relationship_type ===
          'ESTUDIANTE',
      );

    const adults =
      members.filter(
        (member) =>
          member.relationship_type !==
          'ESTUDIANTE',
      );

    // ----------------------------------------------------------
    // Estudiantes
    // ----------------------------------------------------------

    if (students.length === 0) {
      throw new ConflictException(
        'La familia debe tener al menos un estudiante',
      );
    }

    // ----------------------------------------------------------
    // Adultos
    // ----------------------------------------------------------

    if (adults.length === 0) {
      throw new ConflictException(
        'La familia debe tener al menos un adulto',
      );
    }

    // ----------------------------------------------------------
    // PADRE
    // ----------------------------------------------------------

    const fathers =
      adults.filter(
        (member) =>
          member.relationship_type ===
          'PADRE',
      );

    if (fathers.length > 1) {
      throw new ConflictException(
        'La familia no puede tener más de un PADRE',
      );
    }

    // ----------------------------------------------------------
    // MADRE
    // ----------------------------------------------------------

    const mothers =
      adults.filter(
        (member) =>
          member.relationship_type ===
          'MADRE',
      );

    if (mothers.length > 1) {
      throw new ConflictException(
        'La familia no puede tener más de una MADRE',
      );
    }

    // ----------------------------------------------------------
    // Apoderado activo
    // ----------------------------------------------------------

    const activeGuardians =
      adults.filter(
        (member) =>
          member.is_guardian &&
          member.persons.is_active,
      );

    if (
      activeGuardians.length !== 1
    ) {
      throw new ConflictException(
        'La familia debe tener exactamente un apoderado activo',
      );
    }

    // ----------------------------------------------------------
    // Edad del apoderado
    // ----------------------------------------------------------

    const guardian =
      activeGuardians[0];

    if (
      !guardian.persons.birth_date
    ) {
      throw new ConflictException(
        'El apoderado debe tener fecha de nacimiento registrada',
      );
    }

    if (
      this.calculateAge(
        guardian.persons.birth_date,
      ) < 18
    ) {
      throw new ConflictException(
        'El apoderado debe ser mayor de edad (18 años o más)',
      );
    }
  }

  // ============================================================
  // NOMBRE DE FAMILIA
  // ============================================================

  private async refreshFamilyGroupName(
    transaction: Prisma.TransactionClient,
    familyGroupId: string,
  ): Promise<void> {
    const guardians =
      await transaction.family_members.findMany(
        {
          where: {
            family_group_id:
              familyGroupId,
            is_guardian: true,
            persons: {
              is_active: true,
            },
          },
          include: {
            persons: true,
          },
          orderBy: [
            {
              created_at: 'asc',
            },
            {
              id: 'asc',
            },
          ],
        },
      );

    if (
      guardians.length !== 1
    ) {
      throw new ConflictException(
        'La familia debe tener exactamente un apoderado activo',
      );
    }

    const adults: AdultPersonData[] =
      guardians.map(
        (member) => ({
          person:
            member.persons,
          relationshipType:
            member.relationship_type,
          isGuardian:
            member.is_guardian,
        }),
      );

    const name =
      this.buildFamilyName(
        adults,
      );

    const currentFamily =
      await transaction.family_groups.findUnique(
        {
          where: {
            id: familyGroupId,
          },
          select: {
            name: true,
          },
        },
      );

    if (!currentFamily) {
      throw new NotFoundException(
        'El grupo familiar no existe',
      );
    }

    if (
      currentFamily.name !== name
    ) {
      await transaction.family_groups.update(
        {
          where: {
            id: familyGroupId,
          },
          data: {
            name,
            updated_at:
              new Date(),
          },
        },
      );
    }
  }

  private buildFamilyName(
    adults: AdultPersonData[],
  ): string {
    const guardians =
      adults.filter(
        (adult) =>
          adult.isGuardian,
      );

    const source =
      guardians.length > 0
        ? guardians
        : adults;

    const surnames: string[] = [];

    for (const adult of source) {
      const fatherSurname =
        this.normalizeOptionalText(
          adult.person
            .last_name_father,
        );

      const motherSurname =
        this.normalizeOptionalText(
          adult.person
            .last_name_mother,
        );

      if (
        fatherSurname &&
        !surnames.includes(
          fatherSurname,
        )
      ) {
        surnames.push(
          fatherSurname,
        );
      }

      if (
        motherSurname &&
        !surnames.includes(
          motherSurname,
        )
      ) {
        surnames.push(
          motherSurname,
        );
      }
    }

    if (surnames.length > 0) {
      return `Familia ${surnames.join(' ')}`;
    }

    const firstName =
      this.normalizeOptionalText(
        source[0]?.person
          .first_name,
      );

    return firstName
      ? `Familia ${firstName}`
      : 'Familia sin apellido';
  }

  // ============================================================
  // CÓDIGO DE FAMILIA
  // ============================================================

  private async generateFamilyCode(
    transaction: Prisma.TransactionClient,
    periodYear: number,
  ): Promise<string> {
    await transaction.document_sequences.upsert(
      {
        where: {
          document_type_period_year: {
            document_type:
              'FAMILY_GROUP',
            period_year:
              periodYear,
          },
        },
        update: {},
        create: {
          document_type:
            'FAMILY_GROUP',
          period_year:
            periodYear,
          current_number: 0,
        },
      },
    );

    const sequence =
      await transaction.document_sequences.update(
        {
          where: {
            document_type_period_year: {
              document_type:
                'FAMILY_GROUP',
              period_year:
                periodYear,
            },
          },
          data: {
            current_number: {
              increment: 1,
            },
            updated_at:
              new Date(),
          },
        },
      );

    return [
      'FAM',
      periodYear,
      String(
        sequence.current_number,
      ).padStart(6, '0'),
    ].join('-');
  }

  // ============================================================
  // AUDITORÍA
  // ============================================================

  private async getFamilyAuditSnapshot(
    transaction: Prisma.TransactionClient,
    familyGroupId: string,
  ): Promise<Prisma.InputJsonValue> {
    const group =
      await transaction.family_groups.findUnique(
        {
          where: {
            id: familyGroupId,
          },
          include: {
            family_members: {
              include: {
                persons: true,
              },
              orderBy: [
                {
                  created_at:
                    'asc',
                },
                {
                  id: 'asc',
                },
              ],
            },
          },
        },
      );

    if (!group) {
      throw new NotFoundException(
        'No fue posible obtener el estado del grupo familiar para auditoría',
      );
    }

    return {
      id: group.id,
      code: group.code,
      name: group.name,
      observations:
        group.observations,
      isActive:
        group.is_active,

      members:
        group.family_members.map(
          (member) => ({
            id: member.id,
            personId:
              member.person_id,

            fullName:
              this.buildFullName({
                firstName:
                  member.persons
                    .first_name,
                lastNameFather:
                  member.persons
                    .last_name_father,
                lastNameMother:
                  member.persons
                    .last_name_mother,
              }),

            documentType:
              member.persons
                .document_type,

            documentNumber:
              member.persons
                .document_number,

            relationship:
              member.relationship_type,

            isGuardian:
              member.is_guardian,

            personIsActive:
              member.persons
                .is_active,
          }),
        ),
    };
  }

  private areAuditSnapshotsEqual(
    first:
      | Prisma.InputJsonValue
      | null,
    second:
      Prisma.InputJsonValue,
  ): boolean {
    return (
      JSON.stringify(first) ===
      JSON.stringify(second)
    );
  }

  // ============================================================
  // RESPUESTA
  // ============================================================

  private async getFamilyResponse(
    transaction: Prisma.TransactionClient,
    familyGroupId: string,
  ) {
    const group =
      await transaction.family_groups.findUnique(
        {
          where: {
            id: familyGroupId,
          },
          include: {
            family_members: {
              include: {
                persons: true,
              },
              orderBy: [
                {
                  created_at:
                    'asc',
                },
                {
                  id: 'asc',
                },
              ],
            },
          },
        },
      );

    if (!group) {
      throw new NotFoundException(
        'No fue posible recuperar el grupo familiar',
      );
    }

    return this.mapFamilyGroup(
      group,
    );
  }

  private mapFamilyGroup(group: {
    id: string;
    code: string | null;
    name: string;
    observations: string | null;
    is_active: boolean;

    family_members: Array<{
      id: string;
      person_id: string;
      relationship_type: string;
      is_guardian: boolean;

      persons: {
        first_name: string;
        last_name_father:
          string | null;
        last_name_mother:
          string | null;
        document_type: string;
        document_number:
          string | null;
      };
    }>;
  }) {
    return {
      id: group.id,
      code: group.code,
      name: group.name,
      observations:
        group.observations,
      isActive:
        group.is_active,

      members:
        group.family_members.map(
          (member) => ({
            id: member.id,
            personId:
              member.person_id,

            fullName:
              this.buildFullName({
                firstName:
                  member.persons
                    .first_name,
                lastNameFather:
                  member.persons
                    .last_name_father,
                lastNameMother:
                  member.persons
                    .last_name_mother,
              }),

            documentType:
              member.persons
                .document_type,

            documentNumber:
              member.persons
                .document_number,

            relationship:
              member.relationship_type,

            isGuardian:
              member.is_guardian,
          }),
        ),
    };
  }

  // ============================================================
  // UTILIDADES
  // ============================================================

  private areStudentPersonalDataCompatible(
    person: persons,
    dto: AddFamilyStudentDto,
    birthDate: Date,
  ): boolean {
    const hasSameBirthDate =
      person.birth_date === null ||
      person.birth_date.getTime() === birthDate.getTime();

    return (
      person.first_name.trim() === dto.firstName.trim() &&
      person.last_name_father?.trim() ===
        dto.lastNameFather.trim() &&
      person.last_name_mother?.trim() ===
        dto.lastNameMother.trim() &&
      hasSameBirthDate
    );
  }

  private parseDateOnly(
    value: string,
  ): Date {
    const datePart =
      value.slice(0, 10);

    const [
      year,
      month,
      day,
    ] = datePart
      .split('-')
      .map(Number);

    const date =
      new Date(
        Date.UTC(
          year,
          month - 1,
          day,
        ),
      );

    if (
      Number.isNaN(
        date.getTime(),
      ) ||
      date.getUTCFullYear() !==
        year ||
      date.getUTCMonth() !==
        month - 1 ||
      date.getUTCDate() !==
        day
    ) {
      throw new BadRequestException(
        `La fecha ${value} no es válida`,
      );
    }

    return date;
  }

  private normalizeOptionalText(
    value?:
      | string
      | null,
  ): string | null {
    const normalized =
      value?.trim();

    return normalized
      ? normalized
      : null;
  }

  private buildDocumentKey(
    documentType: string,
    documentNumber: string,
  ): string {
    return [
      documentType
        .trim()
        .toUpperCase(),
      documentNumber.trim(),
    ].join(':');
  }

  private buildFullName(data: {
    firstName: string;
    lastNameFather:
      string | null;
    lastNameMother:
      string | null;
  }): string {
    return [
      data.firstName,
      data.lastNameFather,
      data.lastNameMother,
    ]
      .filter(Boolean)
      .join(' ');
  }

  // ============================================================
  // MANEJO DE ERRORES
  // ============================================================

  private handleCreateError(
    error: unknown,
  ): never {
    if (
      error instanceof
      HttpException
    ) {
      throw error;
    }

    if (
      error instanceof
      Prisma.PrismaClientKnownRequestError
    ) {
      if (
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Existe información duplicada que impide registrar el grupo familiar',
        );
      }

      if (
        error.code === 'P2003'
      ) {
        throw new BadRequestException(
          'Una de las relaciones enviadas no es válida',
        );
      }

      if (
        error.code === 'P2034'
      ) {
        throw new ConflictException(
          'La operación presentó un conflicto de concurrencia. Intente nuevamente',
        );
      }
    }

    throw error;
  }
}
