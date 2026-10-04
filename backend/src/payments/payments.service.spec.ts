import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';

import { Prisma } from '@prisma/client';

import {
  mkdtemp,
  readdir,
  rm,
} from 'node:fs/promises';

import {
  join,
} from 'node:path';

import {
  tmpdir,
} from 'node:os';

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  PrismaService,
} from '../prisma/prisma.service.js';

import {
  CreatePaymentDto,
} from './dto/create-payment.dto.js';

import {
  PaymentsService,
  UploadedVoucherFile,
} from './payments.service.js';

const PERIOD_ID =
  '11111111-1111-4111-8111-111111111111';

const FAMILY_ID =
  '22222222-2222-4222-8222-222222222222';

const USER_ID =
  '33333333-3333-4333-8333-333333333333';

const PAYMENT_ID =
  '44444444-4444-4444-8444-444444444444';

const STUDENT_1_ID =
  '55555555-5555-4555-8555-555555555555';

const STUDENT_2_ID =
  '66666666-6666-4666-8666-666666666666';

const PERSON_1_ID =
  '77777777-7777-4777-8777-777777777777';

const PERSON_2_ID =
  '88888888-8888-4888-8888-888888888888';

const auditContext = {
  userId: USER_ID,
  ipAddress: '127.0.0.1',
  deviceName: 'vitest',
};

const period = {
  id: PERIOD_ID,
  year: 2026,
  status: 'OPEN',
  is_active: true,
};

const family = {
  id: FAMILY_ID,
  code: 'FAM-2026-000001',
  name: 'Familia Pérez García',
  is_active: true,
};

const createPdfVoucher = (
  originalname = 'voucher.pdf',
): UploadedVoucherFile => ({
  originalname,
  mimetype: 'application/pdf',
  size: 16,
  buffer: Buffer.from(
    '%PDF-1.4 test',
  ),
});

const createPngVoucher = (
  originalname = 'voucher.png',
): UploadedVoucherFile => ({
  originalname,
  mimetype: 'image/png',
  size: 8,
  buffer: Buffer.from([
    137,
    80,
    78,
    71,
  ]),
});

const createDto = (
  overrides:
    Partial<CreatePaymentDto> = {},
): CreatePaymentDto => {
  const dto = {
    schoolPeriodId: PERIOD_ID, familyGroupId: FAMILY_ID,
    paymentDate: '2026-09-12', includeApafa: true, studentIds: [],
    operationNumber: 'OP-001', observations: 'Pago de prueba', ...overrides,
  } as CreatePaymentDto;
  if (!Object.prototype.hasOwnProperty.call(overrides, 'voucherAssociations')) {
    dto.voucherAssociations = [{ includeApafa: dto.includeApafa, studentIds: dto.studentIds }];
  }
  return dto;
};

const createStudent = (
  studentId: string,
  personId: string,
  options?: {
    belongsToFamily?: boolean;
    enrolled?: boolean;
    tallerPaid?: boolean;
  },
) => {
  const belongsToFamily =
    options?.belongsToFamily ??
    true;

  const enrolled =
    options?.enrolled ??
    true;

  const tallerPaid =
    options?.tallerPaid ??
    false;

  return {
    id: studentId,

    persons: {
      id: personId,

      family_members:
        belongsToFamily
          ? [
              {
                family_group_id:
                  FAMILY_ID,

                relationship_type:
                  'ESTUDIANTE',
              },
            ]
          : [],
    },

    enrollments:
      enrolled
        ? [
            {
              id:
                `enrollment-${studentId}`,

              school_period_id:
                PERIOD_ID,

              classroom_id:
                '99999999-9999-4999-8999-999999999999',

              status:
                'MATRICULADO',
            },
          ]
        : [],

    payment_student_items:
      tallerPaid
        ? [
            {
              id:
                `existing-payment-student-item-${studentId}`,

              payment_id:
                'existing-payment',

              school_period_id:
                PERIOD_ID,

              family_group_id:
                FAMILY_ID,

              student_id:
                studentId,
            },
          ]
        : [],
  };
};

const mappedPaymentRecord = (
  options?: {
    includeApafa?: boolean;
    studentIds?: string[];
    vouchers?: number;
  },
) => {
  const includeApafa =
    options?.includeApafa ??
    true;

  const studentIds =
    options?.studentIds ??
    [];

  const voucherCount =
    options?.vouchers ??
    1;

  return {
    id: PAYMENT_ID,

    school_period_id:
      PERIOD_ID,

    family_group_id:
      FAMILY_ID,

    registered_by_user_id:
      USER_ID,

    payment_date:
      new Date(
        '2026-09-12T00:00:00.000Z',
      ),

    operation_number:
      'OP-001',

    observations:
      'Pago de prueba',

    created_at:
      new Date(
        '2026-09-12T12:00:00.000Z',
      ),

    school_periods: {
      id: PERIOD_ID,
      year: 2026,
      status: 'OPEN',
      is_active: true,
    },

    family_groups: {
      id: FAMILY_ID,
      code:
        'FAM-2026-000001',
      name:
        'Familia Pérez García',
      is_active: true,
      family_members: [
        {
          is_guardian: true,
          persons: {
            first_name: 'Diana',
            last_name_father: 'Pérez',
            last_name_mother: 'Mendoza',
            is_active: true,
          },
        },
      ],
    },

    users: {
      id: USER_ID,
      username: 'secretaria',

      persons: {
        first_name: 'María',
        last_name_father:
          'Secretaria',
        last_name_mother:
          null,
      },
    },

    family_items:
      includeApafa
        ? [
            {
              id:
                'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',

              payment_id:
                PAYMENT_ID,

              school_period_id:
                PERIOD_ID,

              family_group_id:
                FAMILY_ID,
            },
          ]
        : [],

    student_items:
      studentIds.map(
        (
          studentId,
          index,
        ) => ({
          id:
            `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb${index}`,

          payment_id:
            PAYMENT_ID,

          school_period_id:
            PERIOD_ID,

          family_group_id:
            FAMILY_ID,

          student_id:
            studentId,

          students: {
            id: studentId,

            persons: {
              first_name:
                index === 0
                  ? 'Ana'
                  : 'Luis',

              last_name_father:
                'Pérez',

              last_name_mother:
                'García',
            },
          },
        }),
      ),

    vouchers:
      Array.from({
        length:
          voucherCount,
      }).map(
        (
          _,
          index,
        ) => ({
          id:
            `cccccccc-cccc-4ccc-8ccc-ccccccccccc${index}`,

          payment_id:
            PAYMENT_ID,

          original_name:
            index === 0
              ? 'voucher.pdf'
              : `voucher-${index + 1}.png`,

          physical_name:
            `stored-${index}`,

          file_path:
            `storage/vouchers/stored-${index}`,

          mime_type:
            index === 0
              ? 'application/pdf'
              : 'image/png',

          file_size:
            BigInt(
              index === 0
                ? 16
                : 8,
            ),

          file_hash:
            `hash-${index}`,

          uploaded_at:
            new Date(
              '2026-09-12T12:00:00.000Z',
            ),
        }),
      ),
  };
};

describe(
  'PaymentsService',
  () => {
    let service:
      PaymentsService;

    let storagePath:
      string;

    let prisma: {
      payments: {
        findMany:
          ReturnType<
            typeof vi.fn
          >;

        count:
          ReturnType<
            typeof vi.fn
          >;

        findUnique:
          ReturnType<
            typeof vi.fn
          >;
      };

      school_periods: {
        findUnique:
          ReturnType<
            typeof vi.fn
          >;
      };

      family_groups: {
        findUnique:
          ReturnType<
            typeof vi.fn
          >;
      };

      payment_family_items: {
        findFirst:
          ReturnType<
            typeof vi.fn
          >;
      };

      $transaction:
        ReturnType<
          typeof vi.fn
        >;
    };

    let transaction: {
      school_periods: {
        findUnique:
          ReturnType<
            typeof vi.fn
          >;
      };

      family_groups: {
        findUnique:
          ReturnType<
            typeof vi.fn
          >;
      };

      payment_family_items: {
        findFirst:
          ReturnType<
            typeof vi.fn
          >;

        create:
          ReturnType<
            typeof vi.fn
          >;
      };

      students: {
        findMany:
          ReturnType<
            typeof vi.fn
          >;
      };

      payments: {
        create:
          ReturnType<
            typeof vi.fn
          >;
      };

      payment_student_items: {
        create:
          ReturnType<
            typeof vi.fn
          >;
      };

      vouchers: {
        create:
          ReturnType<
            typeof vi.fn
          >;
      };

      voucher_family_items: {
        create:
          ReturnType<
            typeof vi.fn
          >;
      };

      voucher_student_items: {
        createMany:
          ReturnType<
            typeof vi.fn
          >;
      };

      audit_logs: {
        create:
          ReturnType<
            typeof vi.fn
          >;
      };
    };

    beforeEach(
      async () => {
        storagePath =
          await mkdtemp(
            join(
              tmpdir(),
              'sgpe-payments-',
            ),
          );

        process.env
          .VOUCHER_STORAGE_PATH =
          storagePath;

        transaction = {
          school_periods: {
            findUnique:
              vi.fn()
                .mockResolvedValue(
                  period,
                ),
          },

          family_groups: {
            findUnique:
              vi.fn()
                .mockResolvedValue(
                  family,
                ),
          },

          payment_family_items:
            {
              findFirst:
                vi.fn()
                  .mockResolvedValue(
                    null,
                  ),

              create:
                vi.fn()
                  .mockResolvedValue(
                    {
                      id:
                        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                    },
                  ),
            },

          students: {
            findMany:
              vi.fn()
                .mockResolvedValue(
                  [],
                ),
          },

          payments: {
            create:
              vi.fn()
                .mockResolvedValue(
                  {
                    id:
                      PAYMENT_ID,
                  },
                ),
          },

          payment_student_items:
            {
              create:
                vi.fn(
                  async (
                    args: {
                      data: {
                        student_id:
                          string;
                      };
                    },
                  ) => ({
                    id:
                      `payment-student-item-${args.data.student_id}`,

                    student_id:
                      args.data.student_id,
                  }),
                ),
            },

          vouchers: {
            create:
              vi.fn()
                .mockResolvedValue({
                  id:
                    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
                }),
          },

          voucher_family_items: {
            create:
              vi.fn()
                .mockResolvedValue({
                  id:
                    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
                }),
          },

          voucher_student_items: {
            createMany:
              vi.fn()
                .mockResolvedValue({
                  count: 0,
                }),
          },

          audit_logs: {
            create:
              vi.fn()
                .mockResolvedValue(
                  {
                    id:
                      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
                  },
                ),
          },
        };

        prisma = {
          payments: {
            findMany:
              vi.fn(),

            count:
              vi.fn(),

            findUnique:
              vi.fn(),
          },

          school_periods: {
            findUnique:
              vi.fn(),
          },

          family_groups: {
            findUnique:
              vi.fn(),
          },

          payment_family_items:
            {
              findFirst:
                vi.fn(),
            },

          $transaction:
            vi.fn(
              async (
                callback:
                  (
                    tx:
                      typeof transaction,
                  ) =>
                    Promise<unknown>,
                _options?:
                  unknown,
              ) =>
                callback(
                  transaction,
                ),
            ),
        };

        service =
          new PaymentsService(
            prisma as unknown as
              PrismaService,
          );
      },
    );

    afterEach(
      async () => {
        delete process.env
          .VOUCHER_STORAGE_PATH;

        await rm(
          storagePath,
          {
            recursive: true,
            force: true,
          },
        );

        vi.restoreAllMocks();
      },
    );

    it(
      'should be defined',
      () => {
        expect(
          service,
        ).toBeDefined();
      },
    );

    it('filtra pagos por cualquier integrante activo antes de paginar', async () => {
      prisma.payments.findMany.mockResolvedValue([]);
      prisma.payments.count.mockResolvedValue(0);

      await service.findAll({
        search: '  María   PÉREZ  ',
        page: 2,
        limit: 10,
      });

      const findArgs = prisma.payments.findMany.mock.calls[0][0];
      const countArgs = prisma.payments.count.mock.calls[0][0];

      expect(findArgs.skip).toBe(10);
      expect(findArgs.take).toBe(10);
      expect(findArgs.where).toEqual(countArgs.where);
      expect(findArgs.where.AND).toHaveLength(2);
      expect(findArgs.where.AND[0]).toEqual({
        family_groups: {
          family_members: {
            some: {
              persons: {
                is_active: true,
                OR: [
                  { first_name: { contains: 'María', mode: 'insensitive' } },
                  { last_name_father: { contains: 'María', mode: 'insensitive' } },
                  { last_name_mother: { contains: 'María', mode: 'insensitive' } },
                  { document_number: { contains: 'María', mode: 'insensitive' } },
                ],
              },
            },
          },
        },
      });
      expect(findArgs.where.AND[1].family_groups.family_members.some.persons.OR)
        .toContainEqual({
          document_number: { contains: 'PÉREZ', mode: 'insensitive' },
        });
    });

    it('devuelve el apoderado activo real y un fallback seguro', async () => {
      const withGuardian = mappedPaymentRecord();
      const withoutGuardian = mappedPaymentRecord();
      withoutGuardian.family_groups.family_members = [];

      prisma.payments.findMany.mockResolvedValue([
        withGuardian,
        withoutGuardian,
      ]);
      prisma.payments.count.mockResolvedValue(2);

      const result = await service.findAll({});

      expect(result.data[0].family.guardianName).toBe('Diana Pérez Mendoza');
      expect(result.data[1].family.guardianName).toBe('Sin apoderado');
    });

    it('ordena matriculados por ciclo, nivel, aula, turno y nombre en español', async () => {
      const member = (
        studentId: string,
        firstName: string,
        cycle: string,
        level: string,
        classroom: string,
        shift: string,
      ) => ({
        person_id: `person-${studentId}`,
        persons: {
          first_name: firstName,
          last_name_father: 'Prueba',
          last_name_mother: null,
          students: {
            id: studentId,
            enrollments: [{
              id: `enrollment-${studentId}`,
              classroom_id: `classroom-${studentId}`,
              status: 'MATRICULADO',
              classrooms: {
                id: `classroom-${studentId}`,
                name: classroom,
                shifts: { id: `shift-${studentId}`, code: shift, name: shift },
                education_levels: {
                  id: `level-${studentId}`,
                  name: level,
                  education_cycles: { id: `cycle-${studentId}`, code: cycle, name: cycle },
                },
              },
            }],
            payment_student_items: [],
          },
        },
      });

      prisma.school_periods.findUnique.mockResolvedValue(period);
      prisma.payment_family_items.findFirst.mockResolvedValue(null);
      prisma.family_groups.findUnique.mockResolvedValue({
        ...family,
        family_members: [
          member('student-4', 'Pedro', 'Ciclo II', '4 años', 'Conejitos', 'Mañana'),
          member('student-2', 'Juan', 'Ciclo II', '3 años', 'Abejitas', 'Mañana'),
          member('student-3', 'María', 'Ciclo II', '3 años', 'Abejitas', 'Tarde'),
          member('student-1', 'Ána', 'Ciclo II', '3 años', 'Abejitas', 'Mañana'),
        ],
      });

      const result = await service.getFamilyPaymentStatus(FAMILY_ID, PERIOD_ID);
      expect(result.students.map((student) => student.studentId)).toEqual([
        'student-1', 'student-2', 'student-3', 'student-4',
      ]);
      expect(result.students[0]?.enrollment?.classroom).toMatchObject({
        name: 'Abejitas', shift: { name: 'Mañana' },
        level: { name: '3 años', cycle: { name: 'Ciclo II' } },
      });
    });

    it(
      'rechaza una operación sin APAFA ni Taller',
      async () => {
        const dto =
          createDto({
            includeApafa:
              false,

            studentIds: [],
          });

        await expect(
          service.create(
            dto,
            [
              createPdfVoucher(),
            ],
            auditContext,
          ),
        ).rejects.toThrow(
          BadRequestException,
        );

        expect(
          prisma.$transaction,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'rechaza un pago sin voucher',
      async () => {
        const dto =
          createDto();

        await expect(
          service.create(
            dto,
            [],
            auditContext,
          ),
        ).rejects.toThrow(
          'Todo pago debe incluir al menos un voucher',
        );

        expect(
          prisma.$transaction,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'rechaza el mismo estudiante repetido dentro de la operación',
      async () => {
        const dto =
          createDto({
            includeApafa:
              false,

            studentIds: [
              STUDENT_1_ID,
              STUDENT_1_ID,
            ],
          });

        await expect(
          service.create(
            dto,
            [
              createPdfVoucher(),
            ],
            auditContext,
          ),
        ).rejects.toThrow(
          'No se puede registrar el Taller del mismo estudiante más de una vez en la operación',
        );

        expect(
          prisma.$transaction,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'rechaza formatos de voucher no permitidos',
      async () => {
        const invalidFile:
          UploadedVoucherFile =
          {
            originalname:
              'voucher.exe',

            mimetype:
              'application/octet-stream',

            size: 10,

            buffer:
              Buffer.from(
                'invalid',
              ),
          };

        await expect(
          service.create(
            createDto(),
            [
              invalidFile,
            ],
            auditContext,
          ),
        ).rejects.toThrow(
          UnsupportedMediaTypeException,
        );

        expect(
          prisma.$transaction,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'rechaza una fecha de pago inválida',
      async () => {
        const dto =
          createDto({
            paymentDate:
              '2026-02-30',
          });

        await expect(
          service.create(
            dto,
            [
              createPdfVoucher(),
            ],
            auditContext,
          ),
        ).rejects.toThrow(
          'La fecha de pago no es válida',
        );

        expect(
          prisma.$transaction,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'rechaza asociaciones cuyo número no coincide con los vouchers',
      async () => {
        const dto =
          createDto({
            voucherAssociations: [],
          });

        await expect(
          service.create(
            dto,
            [
              createPdfVoucher(),
            ],
            auditContext,
          ),
        ).rejects.toThrow(
          'Debe existir una definición de asociación por cada voucher adjunto',
        );

        expect(
          prisma.$transaction,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'rechaza asociar un voucher a un concepto fuera de la operación',
      async () => {
        const dto =
          createDto({
            includeApafa:
              false,

            studentIds: [
              STUDENT_1_ID,
            ],

            voucherAssociations: [
              {
                includeApafa:
                  true,
                studentIds: [],
              },
            ],
          });

        await expect(
          service.create(
            dto,
            [
              createPdfVoucher(),
            ],
            auditContext,
          ),
        ).rejects.toThrow(
          'no puede asociarse a APAFA',
        );

        expect(
          prisma.$transaction,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'rechaza el pago cuando el período escolar no existe y elimina el voucher almacenado',
      async () => {
        transaction
          .school_periods
          .findUnique
          .mockResolvedValue(
            null,
          );

        await expect(
          service.create(
            createDto(),
            [
              createPdfVoucher(),
            ],
            auditContext,
          ),
        ).rejects.toThrow(
          NotFoundException,
        );

        expect(
          transaction
            .payments
            .create,
        ).not.toHaveBeenCalled();

        expect(
          await readdir(
            storagePath,
          ),
        ).toHaveLength(
          0,
        );
      },
    );

    it(
      'rechaza el pago cuando la familia no existe',
      async () => {
        transaction
          .family_groups
          .findUnique
          .mockResolvedValue(
            null,
          );

        await expect(
          service.create(
            createDto(),
            [
              createPdfVoucher(),
            ],
            auditContext,
          ),
        ).rejects.toThrow(
          'La familia no existe',
        );

        expect(
          transaction
            .payments
            .create,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'rechaza APAFA cuando ya figura como PAGADO para la familia y período',
      async () => {
        transaction
          .payment_family_items
          .findFirst
          .mockResolvedValue({
            id:
              'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',

            payment_id:
              'existing-payment',

            school_period_id:
              PERIOD_ID,

            family_group_id:
              FAMILY_ID,
          });

        await expect(
          service.create(
            createDto({
              includeApafa:
                true,

              studentIds: [],
            }),
            [
              createPdfVoucher(),
            ],
            auditContext,
          ),
        ).rejects.toThrow(
          'APAFA ya figura como PAGADO para esta familia en el período indicado',
        );

        expect(
          transaction
            .payments
            .create,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'rechaza Taller cuando uno de los estudiantes seleccionados no existe',
      async () => {
        transaction
          .students
          .findMany
          .mockResolvedValue(
            [],
          );

        await expect(
          service.create(
            createDto({
              includeApafa:
                false,

              studentIds: [
                STUDENT_1_ID,
              ],
            }),
            [
              createPdfVoucher(),
            ],
            auditContext,
          ),
        ).rejects.toThrow(
          'Uno o más estudiantes seleccionados no existen',
        );

        expect(
          transaction
            .payments
            .create,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'rechaza Taller si el estudiante no pertenece a la familia del pago',
      async () => {
        transaction
          .students
          .findMany
          .mockResolvedValue([
            createStudent(
              STUDENT_1_ID,
              PERSON_1_ID,
              {
                belongsToFamily:
                  false,
              },
            ),
          ]);

        await expect(
          service.create(
            createDto({
              includeApafa:
                false,

              studentIds: [
                STUDENT_1_ID,
              ],
            }),
            [
              createPdfVoucher(),
            ],
            auditContext,
          ),
        ).rejects.toThrow(
          'Todos los estudiantes seleccionados deben pertenecer a la familia del pago',
        );

        expect(
          transaction
            .payments
            .create,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'rechaza Taller si el estudiante no está matriculado en el período',
      async () => {
        transaction
          .students
          .findMany
          .mockResolvedValue([
            createStudent(
              STUDENT_1_ID,
              PERSON_1_ID,
              {
                enrolled:
                  false,
              },
            ),
          ]);

        await expect(
          service.create(
            createDto({
              includeApafa:
                false,

              studentIds: [
                STUDENT_1_ID,
              ],
            }),
            [
              createPdfVoucher(),
            ],
            auditContext,
          ),
        ).rejects.toThrow(
          'Solo se puede registrar Taller para estudiantes matriculados en el período del pago',
        );

        expect(
          transaction
            .payments
            .create,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'rechaza Taller si ya figura como PAGADO para el estudiante y período',
      async () => {
        transaction
          .students
          .findMany
          .mockResolvedValue([
            createStudent(
              STUDENT_1_ID,
              PERSON_1_ID,
              {
                tallerPaid:
                  true,
              },
            ),
          ]);

        await expect(
          service.create(
            createDto({
              includeApafa:
                false,

              studentIds: [
                STUDENT_1_ID,
              ],
            }),
            [
              createPdfVoucher(),
            ],
            auditContext,
          ),
        ).rejects.toThrow(
          'El Taller de uno de los estudiantes seleccionados ya figura como PAGADO para este período',
        );

        expect(
          transaction
            .payments
            .create,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'registra correctamente un pago solo de APAFA',
      async () => {
        prisma
          .payments
          .findUnique
          .mockResolvedValue(
            mappedPaymentRecord({
              includeApafa:
                true,

              studentIds: [],
            }),
          );

        const result =
          await service.create(
            createDto({
              includeApafa:
                true,

              studentIds: [],
            }),
            [
              createPdfVoucher(),
            ],
            auditContext,
          );

        expect(
          transaction
            .payments
            .create,
        ).toHaveBeenCalledWith({
          data: {
            school_period_id:
              PERIOD_ID,

            family_group_id:
              FAMILY_ID,

            registered_by_user_id:
              USER_ID,

            payment_date:
              new Date(
                '2026-09-12T00:00:00.000Z',
              ),

            operation_number:
              'OP-001',

            observations:
              'Pago de prueba',
          },
        });

        expect(
          transaction
            .payment_family_items
            .create,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          transaction
            .payment_student_items
            .create,
        ).not.toHaveBeenCalled();

        expect(
          transaction
            .vouchers
            .create,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          transaction
            .audit_logs
            .create,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          result.apafa.included,
        ).toBe(
          true,
        );

        expect(
          result.talleres,
        ).toHaveLength(
          0,
        );
      },
    );

    it(
      'registra correctamente Taller para un estudiante',
      async () => {
        transaction
          .students
          .findMany
          .mockResolvedValue([
            createStudent(
              STUDENT_1_ID,
              PERSON_1_ID,
            ),
          ]);

        prisma
          .payments
          .findUnique
          .mockResolvedValue(
            mappedPaymentRecord({
              includeApafa:
                false,

              studentIds: [
                STUDENT_1_ID,
              ],
            }),
          );

        const result =
          await service.create(
            createDto({
              includeApafa:
                false,

              studentIds: [
                STUDENT_1_ID,
              ],
            }),
            [
              createPdfVoucher(),
            ],
            auditContext,
          );

        expect(
          transaction
            .payment_family_items
            .create,
        ).not.toHaveBeenCalled();

        expect(
          transaction
            .payment_student_items
            .create,
        ).toHaveBeenCalledWith({
          data: {
            payment_id:
              PAYMENT_ID,

            school_period_id:
              PERIOD_ID,

            family_group_id:
              FAMILY_ID,

            student_id:
              STUDENT_1_ID,
          },

          select: {
            id: true,
            student_id: true,
          },
        });

        expect(
          result.apafa.included,
        ).toBe(
          false,
        );

        expect(
          result.talleres,
        ).toHaveLength(
          1,
        );

        expect(
          result
            .talleres[0]
            .studentId,
        ).toBe(
          STUDENT_1_ID,
        );
      },
    );

    it(
      'registra en una sola operación APAFA y Taller para múltiples hermanos',
      async () => {
        transaction
          .students
          .findMany
          .mockResolvedValue([
            createStudent(
              STUDENT_1_ID,
              PERSON_1_ID,
            ),

            createStudent(
              STUDENT_2_ID,
              PERSON_2_ID,
            ),
          ]);

        prisma
          .payments
          .findUnique
          .mockResolvedValue(
            mappedPaymentRecord({
              includeApafa:
                true,

              studentIds: [
                STUDENT_1_ID,
                STUDENT_2_ID,
              ],
              vouchers: 2,
            }),
          );

        const result =
          await service.create(
            createDto({
              includeApafa:
                true,

              studentIds: [
                STUDENT_1_ID,
                STUDENT_2_ID,
              ],
              voucherAssociations: [
                { includeApafa: true, studentIds: [STUDENT_1_ID] },
                { includeApafa: false, studentIds: [STUDENT_2_ID] },
              ],
            }),
            [
              createPdfVoucher(),
              createPngVoucher(
                'voucher-2.png',
              ),
            ],
            auditContext,
          );

        expect(
          transaction
            .payment_family_items
            .create,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          transaction
            .payment_student_items
            .create,
        ).toHaveBeenCalledTimes(
          2,
        );

        expect(
          transaction
            .payment_student_items
            .create,
        ).toHaveBeenNthCalledWith(
          1,
          {
            data: {
              payment_id:
                PAYMENT_ID,

              school_period_id:
                PERIOD_ID,

              family_group_id:
                FAMILY_ID,

              student_id:
                STUDENT_1_ID,
            },

            select: {
              id: true,
              student_id: true,
            },
          },
        );

        expect(
          transaction
            .payment_student_items
            .create,
        ).toHaveBeenNthCalledWith(
          2,
          {
            data: {
              payment_id:
                PAYMENT_ID,

              school_period_id:
                PERIOD_ID,

              family_group_id:
                FAMILY_ID,

              student_id:
                STUDENT_2_ID,
            },

            select: {
              id: true,
              student_id: true,
            },
          },
        );

        expect(
          transaction
            .vouchers
            .create,
        ).toHaveBeenCalledTimes(
          2,
        );

        expect(
          transaction
            .vouchers
            .create.mock.calls[0][0]
            .data.payment_id,
        ).toBe(
          PAYMENT_ID,
        );

        expect(
          transaction
            .vouchers
            .create.mock.calls[1][0]
            .data.payment_id,
        ).toBe(
          PAYMENT_ID,
        );

        expect(
          result.apafa.included,
        ).toBe(
          true,
        );

        expect(
          result.talleres,
        ).toHaveLength(
          2,
        );

        expect(
          result.vouchers,
        ).toHaveLength(
          2,
        );
      },
    );

    it(
      'registra auditoría con usuario, IP, dispositivo y conceptos cubiertos',
      async () => {
        transaction
          .students
          .findMany
          .mockResolvedValue([
            createStudent(
              STUDENT_1_ID,
              PERSON_1_ID,
            ),
          ]);

        prisma
          .payments
          .findUnique
          .mockResolvedValue(
            mappedPaymentRecord({
              includeApafa:
                true,

              studentIds: [
                STUDENT_1_ID,
              ],
            }),
          );

        await service.create(
          createDto({
            includeApafa:
              true,

            studentIds: [
              STUDENT_1_ID,
            ],

            voucherAssociations: [
              {
                includeApafa:
                  true,

                studentIds: [
                  STUDENT_1_ID,
                ],
              },
            ],
          }),
          [
            createPdfVoucher(),
          ],
          auditContext,
        );

        expect(
          transaction
            .audit_logs
            .create,
        ).toHaveBeenCalledWith({
          data:
            expect.objectContaining({
              user_id:
                USER_ID,

              entity_name:
                'payments',

              entity_id:
                PAYMENT_ID,

              action:
                'CREATE',

              ip_address:
                '127.0.0.1',

              device_name:
                'vitest',

              new_value:
                expect.objectContaining({
                  schoolPeriodId:
                    PERIOD_ID,

                  familyGroupId:
                    FAMILY_ID,

                  includeApafa:
                    true,

                  studentIds: [
                    STUDENT_1_ID,
                  ],

                  paymentDate:
                    '2026-09-12',

                  vouchers: [
                    expect.objectContaining({
                      originalName:
                        'voucher.pdf',

                      association: {
                        includeApafa:
                          true,

                        studentIds: [
                          STUDENT_1_ID,
                        ],
                      },
                    }),
                  ],
                }),
            }),
        });
      },
    );

    it(
      'crea vínculos específicos entre voucher, APAFA y Taller',
      async () => {
        transaction
          .students
          .findMany
          .mockResolvedValue([
            createStudent(
              STUDENT_1_ID,
              PERSON_1_ID,
            ),
          ]);

        prisma
          .payments
          .findUnique
          .mockResolvedValue(
            mappedPaymentRecord({
              includeApafa:
                true,

              studentIds: [
                STUDENT_1_ID,
              ],
            }),
          );

        await service.create(
          createDto({
            includeApafa:
              true,

            studentIds: [
              STUDENT_1_ID,
            ],

            voucherAssociations: [
              {
                includeApafa:
                  true,

                studentIds: [
                  STUDENT_1_ID,
                ],
              },
            ],
          }),
          [
            createPdfVoucher(),
          ],
          auditContext,
        );

        expect(
          transaction
            .voucher_family_items
            .create,
        ).toHaveBeenCalledWith({
          data: {
            voucher_id:
              'cccccccc-cccc-4ccc-8ccc-cccccccccccc',

            payment_id:
              PAYMENT_ID,

            payment_family_item_id:
              'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          },
        });

        expect(
          transaction
            .voucher_student_items
            .createMany,
        ).toHaveBeenCalledWith({
          data: [
            {
              voucher_id:
                'cccccccc-cccc-4ccc-8ccc-cccccccccccc',

              payment_id:
                PAYMENT_ID,

              payment_student_item_id:
                `payment-student-item-${STUDENT_1_ID}`,
            },
          ],
        });
      },
    );

    it(
      'rechaza un voucher general sin vínculos específicos',
      async () => {
        prisma
          .payments
          .findUnique
          .mockResolvedValue(
            mappedPaymentRecord(),
          );

        await expect(service.create(
          createDto({
            voucherAssociations: [
              {
                includeApafa:
                  false,
                studentIds: [],
              },
            ],
          }),
          [
            createPdfVoucher(),
          ],
          auditContext,
        )).rejects.toThrow('Todo voucher debe estar asociado al menos a un concepto');

        expect(
          transaction
            .voucher_family_items
            .create,
        ).not.toHaveBeenCalled();

        expect(
          transaction
            .voucher_student_items
            .createMany,
        ).not.toHaveBeenCalled();
      },
    );

    it.each([
      {
        name: 'APAFA repetida en dos vouchers',
        dto: createDto({ includeApafa: true, voucherAssociations: [
          { includeApafa: true, studentIds: [] },
          { includeApafa: true, studentIds: [] },
        ] }),
        files: [createPdfVoucher(), createPdfVoucher('voucher-2.pdf')],
      },
      {
        name: 'Taller repetido en dos vouchers',
        dto: createDto({ studentIds: [STUDENT_1_ID], voucherAssociations: [
          { includeApafa: false, studentIds: [STUDENT_1_ID] },
          { includeApafa: false, studentIds: [STUDENT_1_ID] },
        ] }),
        files: [createPdfVoucher(), createPdfVoucher('voucher-2.pdf')],
      },
      {
        name: 'APAFA seleccionada sin voucher asociado',
        dto: createDto({ includeApafa: true, studentIds: [STUDENT_1_ID], voucherAssociations: [
          { includeApafa: false, studentIds: [STUDENT_1_ID] },
        ] }),
        files: [createPdfVoucher()],
      },
      {
        name: 'Taller seleccionado sin voucher asociado',
        dto: createDto({ includeApafa: true, studentIds: [STUDENT_1_ID], voucherAssociations: [
          { includeApafa: true, studentIds: [] },
        ] }),
        files: [createPdfVoucher()],
      },
    ])('rechaza $name sin persistir ni auditar', async ({ dto, files }) => {
      await expect(service.create(dto, files, auditContext)).rejects.toBeInstanceOf(BadRequestException);
      expect(transaction.payments.create).not.toHaveBeenCalled();
      expect(transaction.audit_logs.create).not.toHaveBeenCalled();
    });

    it(
      'usa aislamiento SERIALIZABLE en el registro del pago',
      async () => {
        prisma
          .payments
          .findUnique
          .mockResolvedValue(
            mappedPaymentRecord(),
          );

        await service.create(
          createDto(),
          [
            createPdfVoucher(),
          ],
          auditContext,
        );

        expect(
          prisma.$transaction,
        ).toHaveBeenCalledWith(
          expect.any(
            Function,
          ),
          {
            isolationLevel:
              Prisma
                .TransactionIsolationLevel
                .Serializable,
          },
        );
      },
    );

    it(
      'reintenta la transacción cuando Prisma devuelve P2034',
      async () => {
        let attempts =
          0;

        prisma.$transaction =
          vi.fn(
            async (
              callback:
                (
                  tx:
                    typeof transaction,
                ) =>
                  Promise<unknown>,
            ) => {
              attempts +=
                1;

              if (
                attempts <
                3
              ) {
                throw new Prisma
                  .PrismaClientKnownRequestError(
                  'Write conflict',
                  {
                    code:
                      'P2034',

                    clientVersion:
                      '6.16.2',
                  },
                );
              }

              return callback(
                transaction,
              );
            },
          );

        service =
          new PaymentsService(
            prisma as unknown as
              PrismaService,
          );

        prisma
          .payments
          .findUnique
          .mockResolvedValue(
            mappedPaymentRecord(),
          );

        await service.create(
          createDto(),
          [
            createPdfVoucher(),
          ],
          auditContext,
        );

        expect(
          prisma.$transaction,
        ).toHaveBeenCalledTimes(
          3,
        );

        expect(
          transaction
            .payments
            .create,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );

    it(
      'convierte una violación P2002 en conflicto funcional',
      async () => {
        prisma.$transaction =
          vi.fn()
            .mockRejectedValue(
              new Prisma
                .PrismaClientKnownRequestError(
                'Unique constraint failed',
                {
                  code:
                    'P2002',

                  clientVersion:
                    '6.16.2',

                  meta: {
                    target: [
                      'school_period_id',
                      'family_group_id',
                    ],
                  },
                },
              ),
            );

        service =
          new PaymentsService(
            prisma as unknown as
              PrismaService,
          );

        await expect(
          service.create(
            createDto(),
            [
              createPdfVoucher(),
            ],
            auditContext,
          ),
        ).rejects.toThrow(
          'Uno de los conceptos seleccionados ya figura como PAGADO para el período indicado',
        );

        expect(
          await readdir(
            storagePath,
          ),
        ).toHaveLength(
          0,
        );
      },
    );

    it(
      'elimina los vouchers físicos cuando falla la operación transaccional',
      async () => {
        transaction
          .vouchers
          .create
          .mockRejectedValue(
            new Error(
              'Database error',
            ),
          );

        await expect(
          service.create(
            createDto(),
            [
              createPdfVoucher(),
            ],
            auditContext,
          ),
        ).rejects.toThrow(
          'Database error',
        );

        expect(
          transaction
            .audit_logs
            .create,
        ).not.toHaveBeenCalled();

        expect(
          await readdir(
            storagePath,
          ),
        ).toHaveLength(
          0,
        );
      },
    );
  },
);
