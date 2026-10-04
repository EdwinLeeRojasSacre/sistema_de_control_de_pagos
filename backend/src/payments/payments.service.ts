import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';

import {
  Prisma,
} from '@prisma/client';

import {
  createHash,
  randomUUID,
} from 'node:crypto';

import {
  mkdir,
  unlink,
  writeFile,
} from 'node:fs/promises';

import {
  extname,
  join,
  relative,
  resolve,
} from 'node:path';

import {
  PrismaService,
} from '../prisma/prisma.service.js';

import {
  CreatePaymentDto,
} from './dto/create-payment.dto.js';

import {
  FindPaymentsQueryDto,
} from './dto/find-payments-query.dto.js';

export interface UploadedVoucherFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

interface AuditContext {
  userId: string;
  ipAddress: string | null;
  deviceName: string | null;
}

interface StoredVoucher {
  originalName: string;
  physicalName: string;
  absolutePath: string;
  storedPath: string;
  mimeType: string;
  fileSize: number;
  fileHash: string;
}

interface VoucherAssociationInput {
  includeApafa: boolean;
  studentIds: string[];
}

const ALLOWED_VOUCHER_MIME_TYPES =
  new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
  ]);

const MAX_TRANSACTION_RETRIES = 3;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  private parseVoucherAssociations(
    value: unknown,
    voucherCount: number,
  ): VoucherAssociationInput[] {
    if (
      value === undefined ||
      value === null ||
      value === ''
    ) {
      return Array.from(
        {
          length:
            voucherCount,
        },
        () => ({
          includeApafa:
            false,
          studentIds:
            [],
        }),
      );
    }

    let parsed:
      unknown;

    if (
      typeof value ===
      'string'
    ) {
      try {
        parsed =
          JSON.parse(
            value,
          );
      } catch {
        throw new BadRequestException(
          'Las asociaciones de vouchers no tienen un formato JSON válido',
        );
      }
    } else {
      parsed =
        value;
    }

    if (
      !Array.isArray(
        parsed,
      )
    ) {
      throw new BadRequestException(
        'Las asociaciones de vouchers deben ser un arreglo',
      );
    }

    if (
      parsed.length !==
      voucherCount
    ) {
      throw new BadRequestException(
        'Debe existir una definición de asociación por cada voucher adjunto',
      );
    }

    return parsed.map(
      (
        item,
        index,
      ) => {
        if (
          typeof item !==
            'object' ||
          item === null ||
          Array.isArray(
            item,
          )
        ) {
          throw new BadRequestException(
            `La asociación del voucher ${index + 1} no es válida`,
          );
        }

        const record =
          item as Record<
            string,
            unknown
          >;

        if (
          typeof record
            .includeApafa !==
          'boolean'
        ) {
          throw new BadRequestException(
            `La asociación del voucher ${index + 1} debe indicar includeApafa`,
          );
        }

        if (
          !Array.isArray(
            record.studentIds,
          ) ||
          !record.studentIds
            .every(
              (studentId) =>
                typeof studentId ===
                  'string' &&
                this.isUuid(
                  studentId,
                ),
            )
        ) {
          throw new BadRequestException(
            `Los estudiantes asociados al voucher ${index + 1} no son válidos`,
          );
        }

        const studentIds =
          record.studentIds as
            string[];

        if (
          new Set(
            studentIds,
          ).size !==
          studentIds.length
        ) {
          throw new BadRequestException(
            `El voucher ${index + 1} contiene estudiantes duplicados`,
          );
        }

        return {
          includeApafa:
            record.includeApafa,

          studentIds,
        };
      },
    );
  }

  private isUuid(
    value: string,
  ): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }

  // ============================================================
  // LISTADO
  // ============================================================

  async findAll(
    query:
      FindPaymentsQueryDto,
  ) {
    const page =
      query.page ?? 1;

    const limit =
      query.limit ?? 20;

    const searchTerms =
      query.search
        ?.trim()
        .split(/\s+/)
        .filter(Boolean) ?? [];

    const where:
      Prisma.paymentsWhereInput =
      {
        ...(query.schoolPeriodId
          ? {
              school_period_id:
                query.schoolPeriodId,
            }
          : {}),

        ...(query.familyGroupId
          ? {
              family_group_id:
                query.familyGroupId,
            }
          : {}),

        ...(searchTerms.length > 0
          ? {
              AND: searchTerms.map((term) => ({
                family_groups: {
                  family_members: {
                    some: {
                      persons: {
                        is_active: true,
                        OR: [
                          {
                            first_name: {
                              contains: term,
                              mode: 'insensitive' as const,
                            },
                          },
                          {
                            last_name_father: {
                              contains: term,
                              mode: 'insensitive' as const,
                            },
                          },
                          {
                            last_name_mother: {
                              contains: term,
                              mode: 'insensitive' as const,
                            },
                          },
                          {
                            document_number: {
                              contains: term,
                              mode: 'insensitive' as const,
                            },
                          },
                        ],
                      },
                    },
                  },
                },
              })),
            }
          : {}),
      };

    const [
      payments,
      total,
    ] =
      await Promise.all([
        this.prisma
          .payments
          .findMany({
            where,

            include: {
              school_periods:
                true,

              family_groups: {
                include: {
                  family_members: {
                    where: {
                      is_guardian: true,
                      persons: {
                        is_active: true,
                      },
                    },
                    include: {
                      persons: true,
                    },
                    orderBy: {
                      created_at: 'asc',
                    },
                    take: 1,
                  },
                },
              },

              users: {
                include: {
                  persons:
                    true,
                },
              },

              family_items:
                true,

              student_items: {
                include: {
                  students: {
                    include: {
                      persons:
                        true,
                    },
                  },
                },
              },

              vouchers:
                true,
            },

            orderBy: [
              {
                payment_date:
                  'desc',
              },
              {
                created_at:
                  'desc',
              },
            ],

            skip:
              (page - 1) *
              limit,

            take: limit,
          }),

        this.prisma
          .payments
          .count({
            where,
          }),
      ]);

    return {
      data:
        payments.map(
          (payment) =>
            this.mapPayment(
              payment,
            ),
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

  // ============================================================
  // DETALLE
  // ============================================================

  async findById(
    id: string,
  ) {
    const payment =
      await this.prisma
        .payments
        .findUnique({
          where: {
            id,
          },

          include: {
            school_periods:
              true,

            family_groups: {
              include: {
                family_members: {
                  where: {
                    is_guardian: true,
                    persons: {
                      is_active: true,
                    },
                  },
                  include: {
                    persons: true,
                  },
                  orderBy: {
                    created_at: 'asc',
                  },
                  take: 1,
                },
              },
            },

            users: {
              include: {
                persons:
                  true,
              },
            },

            family_items:
              true,

            student_items: {
              include: {
                students: {
                  include: {
                    persons:
                      true,
                  },
                },
              },
            },

            vouchers:
              true,
          },
        });

    if (!payment) {
      throw new NotFoundException(
        'El pago no existe',
      );
    }

    return this.mapPayment(
      payment,
    );
  }

  // ============================================================
  // ESTADO DE PAGOS DE UNA FAMILIA
  // ============================================================

  async getFamilyPaymentStatus(
    familyGroupId: string,
    schoolPeriodId: string,
  ) {
    const [
      period,
      family,
      apafaItem,
    ] =
      await Promise.all([
        this.prisma
          .school_periods
          .findUnique({
            where: {
              id:
                schoolPeriodId,
            },
          }),

        this.prisma
          .family_groups
          .findUnique({
            where: {
              id:
                familyGroupId,
            },

            include: {
              family_members: {
                where: {
                  relationship_type:
                    'ESTUDIANTE',
                },

                include: {
                  persons: {
                    include: {
                      students: {
                        include: {
                          enrollments: {
                            where: {
                              school_period_id:
                                schoolPeriodId,
                            },

                            include: {
                              classrooms: {
                                include: {
                                  shifts: true,
                                  education_levels: {
                                    include: {
                                      education_cycles: true,
                                    },
                                  },
                                },
                              },
                            },
                          },

                          payment_student_items:
                            {
                              where: {
                                school_period_id:
                                  schoolPeriodId,
                              },

                              include: {
                                payments:
                                  true,
                              },
                            },
                        },
                      },
                    },
                  },
                },

                orderBy: {
                  created_at:
                    'asc',
                },
              },
            },
          }),

        this.prisma
          .payment_family_items
          .findFirst({
            where: {
              school_period_id:
                schoolPeriodId,

              family_group_id:
                familyGroupId,
            },

            include: {
              payments:
                true,
            },
          }),
      ]);

    if (!period) {
      throw new NotFoundException(
        'El período escolar no existe',
      );
    }

    if (!family) {
      throw new NotFoundException(
        'La familia no existe',
      );
    }

    const students =
      family.family_members
        .map(
          (member) => {
            const student =
              member.persons
                .students;

            if (!student) {
              return null;
            }

            const enrollment =
              student
                .enrollments[0] ??
              null;

            const tallerItem =
              student
                .payment_student_items[0] ??
              null;

            return {
              studentId:
                student.id,

              personId:
                member.person_id,

              fullName:
                this.buildFullName({
                  firstName:
                    member
                      .persons
                      .first_name,

                  lastNameFather:
                    member
                      .persons
                      .last_name_father,

                  lastNameMother:
                    member
                      .persons
                      .last_name_mother,
                }),

              enrolledInPeriod:
                enrollment !==
                null,

              enrollment:
                enrollment
                  ? {
                      id:
                        enrollment.id,

                      classroomId:
                        enrollment
                          .classroom_id,

                      status:
                        enrollment.status,

                      classroom: {
                        id: enrollment.classrooms.id,
                        name: enrollment.classrooms.name,
                        shift: {
                          id: enrollment.classrooms.shifts.id,
                          code: enrollment.classrooms.shifts.code,
                          name: enrollment.classrooms.shifts.name,
                        },
                        level: {
                          id: enrollment.classrooms.education_levels.id,
                          name: enrollment.classrooms.education_levels.name,
                          cycle: {
                            id: enrollment.classrooms.education_levels.education_cycles.id,
                            code: enrollment.classrooms.education_levels.education_cycles.code,
                            name: enrollment.classrooms.education_levels.education_cycles.name,
                          },
                        },
                      },
                    }
                  : null,

              taller: {
                status:
                  tallerItem
                    ? 'PAGADO'
                    : 'NO_PAGADO',

                paymentId:
                  tallerItem
                    ?.payment_id ??
                  null,

                paymentDate:
                  tallerItem
                    ?.payments
                    .payment_date
                    .toISOString()
                    .slice(
                      0,
                      10,
                    ) ??
                  null,
              },
            };
          },
        )
        .filter(
          (
            student,
          ): student is NonNullable<
            typeof student
          > =>
            student !==
            null,
        )
        .sort((left, right) => {
          const leftEnrollment = left.enrollment;
          const rightEnrollment = right.enrollment;
          const compare = (first: string, second: string) =>
            first.localeCompare(second, 'es', { sensitivity: 'base' });

          if (leftEnrollment && !rightEnrollment) return -1;
          if (!leftEnrollment && rightEnrollment) return 1;
          if (leftEnrollment && rightEnrollment) {
            const fields: Array<[string, string]> = [
              [leftEnrollment.classroom.level.cycle.name, rightEnrollment.classroom.level.cycle.name],
              [leftEnrollment.classroom.level.name, rightEnrollment.classroom.level.name],
              [leftEnrollment.classroom.name, rightEnrollment.classroom.name],
              [leftEnrollment.classroom.shift.name, rightEnrollment.classroom.shift.name],
            ];
            for (const [first, second] of fields) {
              const result = compare(first, second);
              if (result !== 0) return result;
            }
          }
          return compare(left.fullName, right.fullName);
        });

    return {
      schoolPeriod: {
        id: period.id,
        year:
          period.year,
        status:
          period.status,
        isActive:
          period.is_active,
      },

      family: {
        id:
          family.id,
        code:
          family.code,
        name:
          family.name,
        isActive:
          family.is_active,
      },

      apafa: {
        status:
          apafaItem
            ? 'PAGADO'
            : 'NO_PAGADO',

        paymentId:
          apafaItem
            ?.payment_id ??
          null,

        paymentDate:
          apafaItem
            ?.payments
            .payment_date
            .toISOString()
            .slice(
              0,
              10,
            ) ??
          null,
      },

      students,
    };
  }

  // ============================================================
  // REGISTRO
  // ============================================================

  async create(
    dto:
      CreatePaymentDto,

    voucherFiles:
      UploadedVoucherFile[],

    auditContext:
      AuditContext,
  ) {
    this.validateCreateRequest(
      dto,
      voucherFiles,
    );

    const voucherAssociations =
      this.parseVoucherAssociations(
        dto.voucherAssociations,
        voucherFiles.length,
      );

    this.validateVoucherAssociationCoverage(dto, voucherAssociations);

    const storedVouchers =
      await this.persistVoucherFiles(
        voucherFiles,
      );

    try {
      const paymentId =
        await this.executeSerializable(
          async (
            transaction,
          ) => {
            // ======================================================
            // 1. VALIDAR ALCANCE DEL PAGO
            // ======================================================

            await this
              .validatePaymentScope(
                transaction,
                dto,
              );

            // ======================================================
            // 2. CREAR CABECERA DEL PAGO
            // ======================================================

            const payment =
              await transaction
                .payments
                .create({
                  data: {
                    school_period_id:
                      dto.schoolPeriodId,

                    family_group_id:
                      dto.familyGroupId,

                    registered_by_user_id:
                      auditContext
                        .userId,

                    payment_date:
                      this.parseDateOnly(
                        dto.paymentDate,
                      ),

                    operation_number:
                      this.normalizeOptionalText(
                        dto.operationNumber,
                      ),

                    observations:
                      this.normalizeOptionalText(
                        dto.observations,
                      ),
                  },
                });

            // ======================================================
            // 3. CREAR ITEM APAFA
            // ======================================================

            let familyItem:
              {
                id: string;
              } | null =
              null;

            if (
              dto.includeApafa
            ) {
              familyItem =
                await transaction
                  .payment_family_items
                  .create({
                    data: {
                      payment_id:
                        payment.id,

                      school_period_id:
                        dto.schoolPeriodId,

                      family_group_id:
                        dto.familyGroupId,
                    },

                    select: {
                      id: true,
                    },
                  });
            }

            // ======================================================
            // 4. CREAR ITEMS DE TALLER
            // ======================================================

            /*
            * Necesitamos conservar la relación:
            *
            * studentId -> payment_student_item.id
            *
            * porque cada voucher puede vincularse
            * a uno o varios Talleres.
            */
            const studentItems =
              new Map<
                string,
                string
              >();

            for (
              const studentId
              of dto.studentIds
            ) {
              const studentItem =
                await transaction
                  .payment_student_items
                  .create({
                    data: {
                      payment_id:
                        payment.id,

                      school_period_id:
                        dto.schoolPeriodId,

                      family_group_id:
                        dto.familyGroupId,

                      student_id:
                        studentId,
                    },

                    select: {
                      id: true,

                      student_id:
                        true,
                    },
                  });

              studentItems.set(
                studentItem.student_id,
                studentItem.id,
              );
            }

            // ======================================================
            // 5. CREAR VOUCHERS
            // ======================================================

            for (
              let index = 0;
              index <
              storedVouchers.length;
              index++
            ) {
              const storedVoucher =
                storedVouchers[
                  index
                ];

              const association =
                voucherAssociations[
                  index
                ];

              const voucher =
                await transaction
                  .vouchers
                  .create({
                    data: {
                      payment_id:
                        payment.id,

                      original_name:
                        storedVoucher
                          .originalName,

                      physical_name:
                        storedVoucher
                          .physicalName,

                      file_path:
                        storedVoucher
                          .storedPath,

                      mime_type:
                        storedVoucher
                          .mimeType,

                      file_size:
                        BigInt(
                          storedVoucher
                            .fileSize,
                        ),

                      file_hash:
                        storedVoucher
                          .fileHash,
                    },

                    select: {
                      id: true,
                    },
                  });

              // ====================================================
              // 5.1 VOUCHER -> APAFA
              // ====================================================

              if (
                association
                  .includeApafa
              ) {
                /*
                * validateCreateRequest ya impide
                * asociar APAFA si el pago no incluye APAFA.
                *
                * Esta protección es defensiva.
                */
                if (
                  !familyItem
                ) {
                  throw new BadRequestException(
                    'No se pudo resolver APAFA para asociarlo al voucher',
                  );
                }

                await transaction
                  .voucher_family_items
                  .create({
                    data: {
                      voucher_id:
                        voucher.id,

                      payment_id:
                        payment.id,

                      payment_family_item_id:
                        familyItem.id,
                    },
                  });
              }

              // ====================================================
              // 5.2 VOUCHER -> TALLERES
              // ====================================================

              if (
                association
                  .studentIds
                  .length > 0
              ) {
                const links =
                  association
                    .studentIds
                    .map(
                      (
                        studentId,
                      ) => {
                        const paymentStudentItemId =
                          studentItems
                            .get(
                              studentId,
                            );

                        /*
                        * validateCreateRequest ya valida
                        * que el Taller pertenezca a esta
                        * misma operación.
                        */
                        if (
                          !paymentStudentItemId
                        ) {
                          throw new BadRequestException(
                            'No se pudo resolver el Taller asociado al voucher',
                          );
                        }

                        return {
                          voucher_id:
                            voucher.id,

                          payment_id:
                            payment.id,

                          payment_student_item_id:
                            paymentStudentItemId,
                        };
                      },
                    );

                await transaction
                  .voucher_student_items
                  .createMany({
                    data:
                      links,
                  });
              }

              /*
              * Si el voucher tiene:
              *
              * includeApafa = false
              * studentIds = []
              *
              * queda registrado sin asociaciones.
              *
              * Es una evidencia general válida.
              */
            }

            // ======================================================
            // 6. AUDITORÍA
            // ======================================================

            const auditNewValue:
              Prisma.InputJsonObject =
              {
                schoolPeriodId:
                  dto.schoolPeriodId,

                familyGroupId:
                  dto.familyGroupId,

                paymentDate:
                  dto.paymentDate,

                includeApafa:
                  dto.includeApafa,

                studentIds:
                  [
                    ...dto.studentIds,
                  ],

                operationNumber:
                  this.normalizeOptionalText(
                    dto.operationNumber,
                  ),

                observations:
                  this.normalizeOptionalText(
                    dto.observations,
                  ),

                vouchers:
                  storedVouchers.map(
                    (
                      voucher,
                      index,
                    ) => ({
                      originalName:
                        voucher
                          .originalName,

                      fileHash:
                        voucher
                          .fileHash,

                      association: {
                        includeApafa:
                          voucherAssociations[
                            index
                          ].includeApafa,

                        studentIds:
                          [
                            ...voucherAssociations[
                              index
                            ].studentIds,
                          ],
                      },
                    }),
                  ),
              };

            await transaction
              .audit_logs
              .create({
                data: {
                  user_id:
                    auditContext
                      .userId,

                  entity_name:
                    'payments',

                  entity_id:
                    payment.id,

                  action:
                    'CREATE',

                  new_value:
                    auditNewValue,

                  ip_address:
                    auditContext
                      .ipAddress,

                  device_name:
                    auditContext
                      .deviceName,
                },
              });

            return payment.id;
          },
        );

      // ============================================================
      // 7. DEVOLVER DETALLE DEL PAGO
      // ============================================================

      return this.findById(
        paymentId,
      );
    } catch (error) {
      // ============================================================
      // 8. ROLLBACK DE ARCHIVOS FÍSICOS
      // ============================================================

      /*
      * Los archivos se almacenan antes de abrir
      * la transacción de PostgreSQL.
      *
      * Si cualquier operación dentro de la
      * transacción falla, se eliminan los
      * vouchers físicos almacenados.
      */
      await this
        .deleteStoredVouchers(
          storedVouchers,
        );

      /*
      * Las restricciones únicas de la BD
      * siguen siendo la última defensa contra
      * pagos duplicados concurrentes.
      */
      if (
        error instanceof
          Prisma
            .PrismaClientKnownRequestError &&
        error.code ===
          'P2002'
      ) {
        throw new ConflictException(
          'Uno de los conceptos seleccionados ya figura como PAGADO para el período indicado',
        );
      }

      throw error;
    }
  }

  // ============================================================
  // VALIDACIÓN DEL REQUEST
  // ============================================================

  private validateCreateRequest(
    dto:
      CreatePaymentDto,

    voucherFiles:
      UploadedVoucherFile[],
  ): void {
    if (
      !dto.includeApafa &&
      dto.studentIds
        .length === 0
    ) {
      throw new BadRequestException(
        'Debe seleccionar APAFA o al menos un Taller para registrar el pago',
      );
    }

    const uniqueStudentIds =
      new Set(
        dto.studentIds,
      );

    if (
      uniqueStudentIds
        .size !==
      dto.studentIds.length
    ) {
      throw new BadRequestException(
        'No se puede registrar el Taller del mismo estudiante más de una vez en la operación',
      );
    }

    if (
      voucherFiles.length ===
      0
    ) {
      throw new BadRequestException(
        'Todo pago debe incluir al menos un voucher',
      );
    }

    const voucherAssociations =
      this.parseVoucherAssociations(
        dto.voucherAssociations,
        voucherFiles.length,
      );

    for (
      let index = 0;
      index <
      voucherAssociations.length;
      index++
    ) {
      const association =
        voucherAssociations[
          index
        ];

      if (
        association.includeApafa &&
        !dto.includeApafa
      ) {
        throw new BadRequestException(
          `El voucher ${index + 1} no puede asociarse a APAFA porque APAFA no forma parte de esta operación`,
        );
      }

      for (
        const studentId
        of association.studentIds
      ) {
        if (
          !dto.studentIds.includes(
            studentId,
          )
        ) {
          throw new BadRequestException(
            `El voucher ${index + 1} intenta asociarse a un Taller que no forma parte de esta operación`,
          );
        }
      }
    }

    for (
      const file
      of voucherFiles
    ) {
      if (
        !ALLOWED_VOUCHER_MIME_TYPES.has(
          file.mimetype,
        )
      ) {
        throw new UnsupportedMediaTypeException(
          `El archivo ${file.originalname} no tiene un formato permitido`,
        );
      }
    }

    this.parseDateOnly(
      dto.paymentDate,
    );
  }

  private validateVoucherAssociationCoverage(
    dto: CreatePaymentDto,
    associations: VoucherAssociationInput[],
  ): void {
    let apafaCount = 0;
    const studentCounts = new Map<string, number>();

    for (const association of associations) {
      if (!association.includeApafa && association.studentIds.length === 0) {
        throw new BadRequestException('Todo voucher debe estar asociado al menos a un concepto');
      }
      if (association.includeApafa) apafaCount++;
      for (const studentId of association.studentIds) {
        studentCounts.set(studentId, (studentCounts.get(studentId) ?? 0) + 1);
      }
    }

    if (dto.includeApafa && apafaCount !== 1) {
      throw new BadRequestException('APAFA debe estar asociado exactamente a un voucher');
    }
    if (!dto.includeApafa && apafaCount !== 0) {
      throw new BadRequestException('APAFA no forma parte de esta operación de pago');
    }
    for (const studentId of dto.studentIds) {
      if ((studentCounts.get(studentId) ?? 0) !== 1) {
        throw new BadRequestException(`El Taller del estudiante ${studentId} debe estar asociado exactamente a un voucher`);
      }
    }
    for (const studentId of studentCounts.keys()) {
      if (!dto.studentIds.includes(studentId)) {
        throw new BadRequestException(`El Taller del estudiante ${studentId} no forma parte de esta operación de pago`);
      }
    }
  }

  // ============================================================
  // VALIDACIÓN DE REGLAS DE NEGOCIO
  // ============================================================

  private async validatePaymentScope(
    transaction:
      Prisma.TransactionClient,

    dto:
      CreatePaymentDto,
  ): Promise<void> {
    const [
      period,
      family,
    ] =
      await Promise.all([
        transaction
          .school_periods
          .findUnique({
            where: {
              id:
                dto.schoolPeriodId,
            },
          }),

        transaction
          .family_groups
          .findUnique({
            where: {
              id:
                dto.familyGroupId,
            },
          }),
      ]);

    if (!period) {
      throw new NotFoundException(
        'El período escolar no existe',
      );
    }

    if (!family) {
      throw new NotFoundException(
        'La familia no existe',
      );
    }

    if (
      dto.includeApafa
    ) {
      const existingApafa =
        await transaction
          .payment_family_items
          .findFirst({
            where: {
              school_period_id:
                dto.schoolPeriodId,

              family_group_id:
                dto.familyGroupId,
            },
          });

      if (
        existingApafa
      ) {
        throw new ConflictException(
          'APAFA ya figura como PAGADO para esta familia en el período indicado',
        );
      }
    }

    if (
      dto.studentIds.length ===
      0
    ) {
      return;
    }

    const students =
      await transaction
        .students
        .findMany({
          where: {
            id: {
              in:
                dto.studentIds,
            },
          },

          include: {
            persons: {
              include: {
                family_members: {
                  where: {
                    family_group_id:
                      dto.familyGroupId,

                    relationship_type:
                      'ESTUDIANTE',
                  },
                },
              },
            },

            enrollments: {
              where: {
                school_period_id:
                  dto.schoolPeriodId,
              },
            },

            payment_student_items:
              {
                where: {
                  school_period_id:
                    dto.schoolPeriodId,
                },
              },
          },
        });

    if (
      students.length !==
      dto.studentIds.length
    ) {
      throw new BadRequestException(
        'Uno o más estudiantes seleccionados no existen',
      );
    }

    for (
      const student
      of students
    ) {
      if (
        student
          .persons
          .family_members
          .length === 0
      ) {
        throw new ConflictException(
          'Todos los estudiantes seleccionados deben pertenecer a la familia del pago',
        );
      }

      if (
        student
          .enrollments
          .length === 0
      ) {
        throw new ConflictException(
          'Solo se puede registrar Taller para estudiantes matriculados en el período del pago',
        );
      }

      if (
        student
          .payment_student_items
          .length > 0
      ) {
        throw new ConflictException(
          'El Taller de uno de los estudiantes seleccionados ya figura como PAGADO para este período',
        );
      }
    }
  }

  // ============================================================
  // TRANSACCIÓN / CONCURRENCIA
  // ============================================================

  private async executeSerializable<T>(
    operation: (
      transaction:
        Prisma.TransactionClient,
    ) => Promise<T>,
  ): Promise<T> {
    let lastError:
      unknown;

    for (
      let attempt = 1;
      attempt <=
      MAX_TRANSACTION_RETRIES;
      attempt += 1
    ) {
      try {
        return await this.prisma
          .$transaction(
            operation,
            {
              isolationLevel:
                Prisma
                  .TransactionIsolationLevel
                  .Serializable,
            },
          );
      } catch (error) {
        lastError =
          error;

        const retry =
          error instanceof
            Prisma.PrismaClientKnownRequestError &&
          error.code ===
            'P2034' &&
          attempt <
            MAX_TRANSACTION_RETRIES;

        if (!retry) {
          throw error;
        }
      }
    }

    throw lastError;
  }

  // ============================================================
  // VOUCHERS
  // ============================================================

  private async persistVoucherFiles(
    files:
      UploadedVoucherFile[],
  ): Promise<
    StoredVoucher[]
  > {
    const storageRoot =
      resolve(
        process.env
          .VOUCHER_STORAGE_PATH ??
          join(
            process.cwd(),
            'storage',
            'vouchers',
          ),
      );

    await mkdir(
      storageRoot,
      {
        recursive:
          true,
      },
    );

    const stored:
      StoredVoucher[] = [];

    try {
      for (
        const file
        of files
      ) {
        const extension =
          this.getSafeExtension(
            file,
          );

        const physicalName =
          `${randomUUID()}${extension}`;

        const absolutePath =
          join(
            storageRoot,
            physicalName,
          );

        const fileHash =
          createHash(
            'sha256',
          )
            .update(
              file.buffer,
            )
            .digest(
              'hex',
            );

        await writeFile(
          absolutePath,
          file.buffer,
          {
            flag: 'wx',
          },
        );

        stored.push({
          originalName:
            file.originalname,

          physicalName,

          absolutePath,

          storedPath:
            relative(
              process.cwd(),
              absolutePath,
            ).replaceAll(
              '\\',
              '/',
            ),

          mimeType:
            file.mimetype,

          fileSize:
            file.size,

          fileHash,
        });
      }

      return stored;
    } catch (error) {
      await this
        .deleteStoredVouchers(
          stored,
        );

      throw error;
    }
  }

  private async deleteStoredVouchers(
    vouchers:
      StoredVoucher[],
  ): Promise<void> {
    await Promise.allSettled(
      vouchers.map(
        (voucher) =>
          unlink(
            voucher
              .absolutePath,
          ),
      ),
    );
  }

  private getSafeExtension(
    file:
      UploadedVoucherFile,
  ): string {
    const originalExtension =
      extname(
        file.originalname,
      ).toLowerCase();

    const extensionByMime:
      Record<
        string,
        string
      > = {
      'application/pdf':
        '.pdf',

      'image/jpeg':
        '.jpg',

      'image/png':
        '.png',

      'image/webp':
        '.webp',
    };

    const expectedExtension =
      extensionByMime[
        file.mimetype
      ] ?? '';

    if (
      originalExtension ===
        expectedExtension ||
      (
        file.mimetype ===
          'image/jpeg' &&
        originalExtension ===
          '.jpeg'
      )
    ) {
      return originalExtension;
    }

    return expectedExtension;
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private parseDateOnly(
    value: string,
  ): Date {
    const date =
      new Date(
        `${value}T00:00:00.000Z`,
      );

    if (
      Number.isNaN(
        date.getTime(),
      ) ||
      date
        .toISOString()
        .slice(
          0,
          10,
        ) !== value
    ) {
      throw new BadRequestException(
        'La fecha de pago no es válida',
      );
    }

    return date;
  }

  private normalizeOptionalText(
    value?: string,
  ): string | null {
    if (
      value === undefined
    ) {
      return null;
    }

    const normalized =
      value.trim();

    return normalized ||
      null;
  }

  private buildFullName(
    data: {
        firstName: string;
        lastNameFather: string | null;
        lastNameMother: string | null;
    },
    ): string {
    return [
        data.firstName,
        data.lastNameFather,
        data.lastNameMother,
    ]
        .filter(
        (value): value is string =>
            typeof value === 'string' &&
            value.trim().length > 0,
        )
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

  private mapPayment(
    payment: any,
  ) {
    const guardian =
      payment.family_groups
        .family_members?.[0]
        ?.persons;

    return {
      id:
        payment.id,

      schoolPeriod: {
        id:
          payment
            .school_periods
            .id,

        year:
          payment
            .school_periods
            .year,
      },

      family: {
        id:
          payment
            .family_groups
            .id,

        code:
          payment
            .family_groups
            .code,

        name:
          payment
            .family_groups
            .name,

        guardianName: guardian
          ? this.buildFullName({
              firstName: guardian.first_name,
              lastNameFather: guardian.last_name_father,
              lastNameMother: guardian.last_name_mother,
            })
          : 'Sin apoderado',
      },

      registeredBy: {
        id:
          payment
            .users
            .id,

        username:
          payment
            .users
            .username,

        fullName:
          this.buildFullName({
            firstName:
              payment
                .users
                .persons
                .first_name,

            lastNameFather:
              payment
                .users
                .persons
                .last_name_father,

            lastNameMother:
              payment
                .users
                .persons
                .last_name_mother,
          }),
      },

      paymentDate:
        payment
          .payment_date
          .toISOString()
          .slice(
            0,
            10,
          ),

      operationNumber:
        payment
          .operation_number,

      observations:
        payment
          .observations,

      createdAt:
        payment
          .created_at
          .toISOString(),

      apafa: {
        included:
          payment
            .family_items
            .length > 0,
      },

      talleres:
        payment
          .student_items
          .map(
            (
              item: any,
            ) => ({
              itemId:
                item.id,

              studentId:
                item.student_id,

              studentName:
                this.buildFullName(
                  {
                    firstName:
                      item
                        .students
                        .persons
                        .first_name,

                    lastNameFather:
                      item
                        .students
                        .persons
                        .last_name_father,

                    lastNameMother:
                      item
                        .students
                        .persons
                        .last_name_mother,
                  },
                ),
            }),
          ),

      vouchers:
        payment
          .vouchers
          .map(
            (
              voucher: any,
            ) => ({
              id:
                voucher.id,

              originalName:
                voucher
                  .original_name,

              mimeType:
                voucher
                  .mime_type,

              fileSize:
                voucher
                  .file_size ===
                null
                  ? null
                  : Number(
                      voucher
                        .file_size,
                    ),

              fileHash:
                voucher
                  .file_hash,

              uploadedAt:
                voucher
                  .uploaded_at
                  .toISOString(),
            }),
          ),
    };
  }
}
