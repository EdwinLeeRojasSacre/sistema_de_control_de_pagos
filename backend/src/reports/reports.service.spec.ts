import {
  NotFoundException,
} from '@nestjs/common';

import {
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
  ReportsService,
} from './reports.service.js';

const PERIOD_ID =
  '11111111-1111-4111-8111-111111111111';

const FAMILY_ID =
  '22222222-2222-4222-8222-222222222222';

const STUDENT_ID =
  '33333333-3333-4333-8333-333333333333';

const PERSON_ID =
  '44444444-4444-4444-8444-444444444444';

const GUARDIAN_ID =
  '55555555-5555-4555-8555-555555555555';

const CLASSROOM_ID =
  '66666666-6666-4666-8666-666666666666';

const LEVEL_ID =
  '77777777-7777-4777-8777-777777777777';

const CYCLE_ID =
  '88888888-8888-4888-8888-888888888888';

const SHIFT_ID =
  '99999999-9999-4999-8999-999999999999';

const PAYMENT_ID =
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const period = {
  id: PERIOD_ID,
  year: 2026,
  start_date:
    new Date(
      '2026-03-01T00:00:00.000Z',
    ),
  end_date:
    new Date(
      '2026-12-15T00:00:00.000Z',
    ),
  status: 'OPEN',
  is_active: true,
  created_at:
    new Date(
      '2026-01-01T00:00:00.000Z',
    ),
  updated_at:
    new Date(
      '2026-01-01T00:00:00.000Z',
    ),
};

const payment = {
  id: PAYMENT_ID,
  school_period_id:
    PERIOD_ID,
  family_group_id:
    FAMILY_ID,
  registered_by_user_id:
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  payment_date:
    new Date(
      '2026-09-12T00:00:00.000Z',
    ),
  operation_number:
    'OP-001',
  observations: null,
  created_at:
    new Date(
      '2026-09-12T15:00:00.000Z',
    ),
};

function createGuardianMember() {
  return {
    id:
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    family_group_id:
      FAMILY_ID,
    person_id:
      GUARDIAN_ID,
    relationship_type:
      'MADRE',
    is_guardian:
      true,
    created_at:
      new Date(),

    persons: {
      id:
        GUARDIAN_ID,
      document_type:
        'DNI',
      document_number:
        '70000001',
      first_name:
        'Ana',
      last_name_father:
        'Ramírez',
      last_name_mother:
        'Torres',
      birth_date: null,
      gender: null,
      phone: null,
      email: null,
      address: null,
      is_active: true,
      created_at:
        new Date(),
      updated_at:
        new Date(),
      students: null,
    },
  };
}

function createStudentMember() {
  return {
    id:
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    family_group_id:
      FAMILY_ID,
    person_id:
      PERSON_ID,
    relationship_type:
      'ESTUDIANTE',
    is_guardian:
      false,
    created_at:
      new Date(),

    persons: {
      id:
        PERSON_ID,
      document_type:
        'DNI',
      document_number:
        '80000001',
      first_name:
        'Luis',
      last_name_father:
        'Castro',
      last_name_mother:
        'Ramírez',
      birth_date: null,
      gender: null,
      phone: null,
      email: null,
      address: null,
      is_active: true,
      created_at:
        new Date(),
      updated_at:
        new Date(),

      students: {
        id:
          STUDENT_ID,
        person_id:
          PERSON_ID,
        student_code:
          null,
        is_active:
          true,
        created_at:
          new Date(),
        updated_at:
          new Date(),

        enrollments: [
          {
            id:
              'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          },
        ],
      },
    },
  };
}

function createApafaFamily(
  paid: boolean,
) {
  return {
    id:
      FAMILY_ID,
    code:
      'FAM-2026-000001',
    name:
      'Familia Castro Ramírez',
    observations:
      null,
    is_active:
      true,
    created_at:
      new Date(),
    updated_at:
      new Date(),

    family_members: [
      createGuardianMember(),
      createStudentMember(),
    ],

    payment_family_items:
      paid
        ? [
            {
              id:
                'ffffffff-ffff-4fff-8fff-ffffffffffff',
              payment_id:
                PAYMENT_ID,
              school_period_id:
                PERIOD_ID,
              family_group_id:
                FAMILY_ID,
              created_at:
                new Date(),
              payments:
                payment,
            },
          ]
        : [],
  };
}

function createTallerEnrollment(
  paid: boolean,
) {
  return {
    id:
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    student_id:
      STUDENT_ID,
    school_period_id:
      PERIOD_ID,
    classroom_id:
      CLASSROOM_ID,
    enrollment_date:
      new Date(
        '2026-03-01T00:00:00.000Z',
      ),
    status:
      'ACTIVE',
    created_at:
      new Date(),

    classrooms: {
      id:
        CLASSROOM_ID,
      school_period_id:
        PERIOD_ID,
      education_level_id:
        LEVEL_ID,
      shift_id:
        SHIFT_ID,
      name:
        'Aula A',
      capacity:
        20,
      is_active:
        true,

      education_levels: {
        id:
          LEVEL_ID,
        cycle_id:
          CYCLE_ID,
        name:
          '4 años',
        min_age_months:
          null,
        max_age_months:
          null,
        is_active:
          true,

        education_cycles: {
          id:
            CYCLE_ID,
          code:
            'CICLO_II',
          name:
            'Ciclo II',
        },
      },

      shifts: {
        id:
          SHIFT_ID,
        code:
          'M',
        name:
          'Mañana',
      },
    },

    students: {
      id:
        STUDENT_ID,
      person_id:
        PERSON_ID,
      student_code:
        null,
      is_active:
        true,
      created_at:
        new Date(),
      updated_at:
        new Date(),

      persons: {
        id:
          PERSON_ID,
        document_type:
          'DNI',
        document_number:
          '80000001',
        first_name:
          'Luis',
        last_name_father:
          'Castro',
        last_name_mother:
          'Ramírez',
        birth_date:
          null,
        gender:
          null,
        phone:
          null,
        email:
          null,
        address:
          null,
        is_active:
          true,
        created_at:
          new Date(),
        updated_at:
          new Date(),

        family_members: [
          {
            id:
              'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
            family_group_id:
              FAMILY_ID,
            person_id:
              PERSON_ID,
            relationship_type:
              'ESTUDIANTE',
            is_guardian:
              false,
            created_at:
              new Date(),

            family_groups: {
              id:
                FAMILY_ID,
              code:
                'FAM-2026-000001',
              name:
                'Familia Castro Ramírez',
              observations:
                null,
              is_active:
                true,
              created_at:
                new Date(),
              updated_at:
                new Date(),

              family_members: [
                createGuardianMember(),
              ],
            },
          },
        ],
      },

      payment_student_items:
        paid
          ? [
              {
                id:
                  '12121212-1212-4121-8121-121212121212',
                payment_id:
                  PAYMENT_ID,
                school_period_id:
                  PERIOD_ID,
                family_group_id:
                  FAMILY_ID,
                student_id:
                  STUDENT_ID,
                created_at:
                  new Date(),
                payments:
                  payment,
              },
            ]
          : [],
    },
  };
}

function createPaymentsEnrollment(options: {
  enrollmentId: string;
  studentId: string;
  personId: string;
  firstName: string;
  apafaPaid: boolean;
  tallerPaid: boolean;
}) {
  const enrollment = createTallerEnrollment(options.tallerPaid) as any;
  enrollment.id = options.enrollmentId;
  enrollment.student_id = options.studentId;
  enrollment.students.id = options.studentId;
  enrollment.students.person_id = options.personId;
  enrollment.students.persons.id = options.personId;
  enrollment.students.persons.first_name = options.firstName;
  enrollment.students.persons.document_number = options.studentId.slice(0, 8);
  enrollment.students.persons.family_members[0].person_id = options.personId;
  const family = enrollment.students.persons.family_members[0].family_groups;
  family.payment_family_items = options.apafaPaid
    ? [{ payments: payment }]
    : [];
  return enrollment;
}

describe(
  'ReportsService',
  () => {
    let service:
      ReportsService;

    let prisma: {
      school_periods: {
        findUnique:
          ReturnType<
            typeof vi.fn
          >;
      };

      enrollments: {
        findMany:
          ReturnType<
            typeof vi.fn
          >;

        count:
          ReturnType<
            typeof vi.fn
          >;
      };

      family_groups: {
        findMany:
          ReturnType<
            typeof vi.fn
          >;

        count:
          ReturnType<
            typeof vi.fn
          >;
      };

      payment_family_items: {
        count:
          ReturnType<
            typeof vi.fn
          >;
      };

      payment_student_items: {
        count:
          ReturnType<
            typeof vi.fn
          >;
      };
    };

    beforeEach(() => {
      prisma = {
        school_periods: {
          findUnique:
            vi.fn(),
        },

        enrollments: {
          findMany:
            vi.fn(),
          count:
            vi.fn(),
        },

        family_groups: {
          findMany:
            vi.fn(),
          count:
            vi.fn(),
        },

        payment_family_items:
          {
            count:
              vi.fn(),
          },

        payment_student_items:
          {
            count:
              vi.fn(),
          },
      };

      service =
        new ReportsService(
          prisma as unknown as
            PrismaService,
        );
    });

    it(
      'is defined',
      () => {
        expect(
          service,
        ).toBeDefined();
      },
    );

    it(
      'rejects a nonexistent school period',
      async () => {
        prisma
          .school_periods
          .findUnique
          .mockResolvedValue(
            null,
          );

        await expect(
          service.getSummary({
            schoolPeriodId:
              PERIOD_ID,
          }),
        ).rejects.toBeInstanceOf(
          NotFoundException,
        );
      },
    );

    it(
      'returns summary using only families and students enrolled in the period',
      async () => {
        prisma
          .school_periods
          .findUnique
          .mockResolvedValue(
            period,
          );

        prisma
          .enrollments
          .findMany
          .mockResolvedValue([
            createPaymentsEnrollment({ enrollmentId: '10101010-1010-4010-8010-101010101010', studentId: STUDENT_ID, personId: PERSON_ID, firstName: 'Ana', apafaPaid: true, tallerPaid: true }),
            createPaymentsEnrollment({ enrollmentId: '11111111-1111-4111-8111-111111111111', studentId: '13131313-1313-4131-8131-131313131313', personId: '14141414-1414-4141-8141-141414141414', firstName: 'Luis', apafaPaid: true, tallerPaid: false }),
          ]);

        const result =
          await service.getSummary({
            schoolPeriodId:
              PERIOD_ID,
          });

        expect(
          result.schoolPeriod,
        ).toEqual({
          id:
            PERIOD_ID,
          year:
            2026,
          status:
            'OPEN',
          isActive:
            true,
        });

        expect(
          result.apafa,
        ).toEqual({
          totalFamilies:
            1,
          paid:
            1,
          unpaid:
            0,
          paidPercentage:
            100,
        });

        expect(
          result.taller,
        ).toEqual({
          totalStudents:
            2,
          paid:
            1,
          unpaid:
            1,
          paidPercentage:
            50,
        });
      },
    );

    it(
      'returns zero percentages when there are no enrollments',
      async () => {
        prisma
          .school_periods
          .findUnique
          .mockResolvedValue(
            period,
          );

        prisma
          .enrollments
          .findMany
          .mockResolvedValue(
            [],
          );

        const result =
          await service.getSummary({
            schoolPeriodId:
              PERIOD_ID,
          });

        expect(
          result.apafa,
        ).toEqual({
          totalFamilies:
            0,
          paid:
            0,
          unpaid:
            0,
          paidPercentage:
            0,
        });

        expect(
          result.taller,
        ).toEqual({
          totalStudents:
            0,
          paid:
            0,
          unpaid:
            0,
          paidPercentage:
            0,
        });

        expect(
          prisma
            .payment_family_items
            .count,
        ).not.toHaveBeenCalled();

        expect(
          prisma
            .payment_student_items
            .count,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'maps a paid APAFA family with guardian and payment traceability',
      async () => {
        prisma
          .school_periods
          .findUnique
          .mockResolvedValue(
            period,
          );

        prisma
          .family_groups
          .findMany
          .mockResolvedValue([
            createApafaFamily(true),
          ]);

        prisma
          .family_groups
          .count
          .mockResolvedValue(
            1,
          );

        const result =
          await service
            .getApafaReport({
              schoolPeriodId:
                PERIOD_ID,
              page:
                1,
              limit:
                20,
            });

        expect(
          result.data,
        ).toHaveLength(
          1,
        );

        expect(
          result.data[0],
        ).toEqual(
          expect.objectContaining({
            familyId:
              FAMILY_ID,

            familyCode:
              'FAM-2026-000001',

            familyName:
              'Familia Castro Ramírez',

            studentsCount:
              1,

            status:
              'PAGADO',

            guardian:
              expect.objectContaining({
                personId:
                  GUARDIAN_ID,

                fullName:
                  'Ana Ramírez Torres',

                documentNumber:
                  '70000001',
              }),

            payment:
              expect.objectContaining({
                paymentId:
                  PAYMENT_ID,

                paymentDate:
                  '2026-09-12',

                operationNumber:
                  'OP-001',
              }),
          }),
        );

        expect(
          result.pagination,
        ).toEqual({
          page:
            1,
          limit:
            20,
          total:
            1,
          totalPages:
            1,
        });
      },
    );

    it(
      'maps unpaid APAFA without payment information',
      async () => {
        prisma
          .school_periods
          .findUnique
          .mockResolvedValue(
            period,
          );

        prisma
          .family_groups
          .findMany
          .mockResolvedValue([
            createApafaFamily(
              false,
            ),
          ]);

        prisma
          .family_groups
          .count
          .mockResolvedValue(
            1,
          );

        const result =
          await service
            .getApafaReport({
              schoolPeriodId:
                PERIOD_ID,
            });

        expect(
          result.data[0]
            .status,
        ).toBe(
          'NO_PAGADO',
        );

        expect(
          result.data[0]
            .payment,
        ).toBeNull();
      },
    );

    it(
      'applies PAGADO status to APAFA query',
      async () => {
        prisma
          .school_periods
          .findUnique
          .mockResolvedValue(
            period,
          );

        prisma
          .family_groups
          .findMany
          .mockResolvedValue(
            [],
          );

        prisma
          .family_groups
          .count
          .mockResolvedValue(
            0,
          );

        await service
          .getApafaReport({
            schoolPeriodId:
              PERIOD_ID,
            status:
              'PAGADO',
          });

        expect(
          prisma
            .family_groups
            .findMany,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            where:
              expect.objectContaining({
                AND:
                  expect.arrayContaining([
                    expect.objectContaining({
                      payment_family_items:
                        {
                          some: {
                            school_period_id:
                              PERIOD_ID,
                          },
                        },
                    }),
                  ]),
              }),
          }),
        );
      },
    );

    it(
      'applies NO_PAGADO status to APAFA query',
      async () => {
        prisma
          .school_periods
          .findUnique
          .mockResolvedValue(
            period,
          );

        prisma
          .family_groups
          .findMany
          .mockResolvedValue(
            [],
          );

        prisma
          .family_groups
          .count
          .mockResolvedValue(
            0,
          );

        await service
          .getApafaReport({
            schoolPeriodId:
              PERIOD_ID,
            status:
              'NO_PAGADO',
          });

        expect(
          prisma
            .family_groups
            .findMany,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            where:
              expect.objectContaining({
                AND:
                  expect.arrayContaining([
                    expect.objectContaining({
                      payment_family_items:
                        {
                          none: {
                            school_period_id:
                              PERIOD_ID,
                          },
                        },
                    }),
                  ]),
              }),
          }),
        );
      },
    );

    it(
      'maps Taller academic structure, family, guardian and payment',
      async () => {
        prisma
          .school_periods
          .findUnique
          .mockResolvedValue(
            period,
          );

        prisma
          .enrollments
          .findMany
          .mockResolvedValue([
            createTallerEnrollment(
              true,
            ),
          ]);

        prisma
          .enrollments
          .count
          .mockResolvedValue(
            1,
          );

        const result =
          await service
            .getTallerReport({
              schoolPeriodId:
                PERIOD_ID,
              page:
                1,
              limit:
                20,
            });

        expect(
          result.data,
        ).toHaveLength(
          1,
        );

        expect(
          result.data[0],
        ).toEqual(
          expect.objectContaining({
            studentId:
              STUDENT_ID,

            enrollmentStatus:
              'ACTIVE',

            student:
              expect.objectContaining({
                fullName:
                  'Luis Castro Ramírez',

                documentNumber:
                  '80000001',
              }),

            family: {
              id:
                FAMILY_ID,
              code:
                'FAM-2026-000001',
              name:
                'Familia Castro Ramírez',
            },

            guardian:
              expect.objectContaining({
                fullName:
                  'Ana Ramírez Torres',
              }),

            academic: {
              cycleId:
                CYCLE_ID,
              cycleCode:
                'CICLO_II',
              cycleName:
                'Ciclo II',
              educationLevelId:
                LEVEL_ID,
              educationLevelName:
                '4 años',
              classroomId:
                CLASSROOM_ID,
              classroomName:
                'Aula A',
              shiftId:
                SHIFT_ID,
              shiftCode:
                'M',
              shiftName:
                'Mañana',
            },

            status:
              'PAGADO',

            payment:
              expect.objectContaining({
                paymentId:
                  PAYMENT_ID,
                paymentDate:
                  '2026-09-12',
                operationNumber:
                  'OP-001',
              }),
          }),
        );
      },
    );

    it(
      'maps unpaid Taller without payment data',
      async () => {
        prisma
          .school_periods
          .findUnique
          .mockResolvedValue(
            period,
          );

        prisma
          .enrollments
          .findMany
          .mockResolvedValue([
            createTallerEnrollment(
              false,
            ),
          ]);

        prisma
          .enrollments
          .count
          .mockResolvedValue(
            1,
          );

        const result =
          await service
            .getTallerReport({
              schoolPeriodId:
                PERIOD_ID,
            });

        expect(
          result.data[0]
            .status,
        ).toBe(
          'NO_PAGADO',
        );

        expect(
          result.data[0]
            .payment,
        ).toBeNull();
      },
    );

    it(
      'passes academic filters to Taller query',
      async () => {
        prisma
          .school_periods
          .findUnique
          .mockResolvedValue(
            period,
          );

        prisma
          .enrollments
          .findMany
          .mockResolvedValue(
            [],
          );

        prisma
          .enrollments
          .count
          .mockResolvedValue(
            0,
          );

        await service
          .getTallerReport({
            schoolPeriodId:
              PERIOD_ID,

            educationLevelId:
              LEVEL_ID,

            classroomId:
              CLASSROOM_ID,

            shiftId:
              SHIFT_ID,
          });

        expect(
          prisma
            .enrollments
            .findMany,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            where:
              expect.objectContaining({
                AND:
                  expect.arrayContaining([
                    {
                      school_period_id:
                        PERIOD_ID,
                    },

                    {
                      classrooms:
                        {
                          education_level_id:
                            LEVEL_ID,
                        },
                    },

                    {
                      classroom_id:
                        CLASSROOM_ID,
                    },

                    {
                      classrooms:
                        {
                          shift_id:
                            SHIFT_ID,
                        },
                    },
                  ]),
              }),
          }),
        );
      },
    );

    it(
      'applies Taller payment status filter',
      async () => {
        prisma
          .school_periods
          .findUnique
          .mockResolvedValue(
            period,
          );

        prisma
          .enrollments
          .findMany
          .mockResolvedValue(
            [],
          );

        prisma
          .enrollments
          .count
          .mockResolvedValue(
            0,
          );

        await service
          .getTallerReport({
            schoolPeriodId:
              PERIOD_ID,

            status:
              'NO_PAGADO',
          });

        expect(
          prisma
            .enrollments
            .findMany,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            where:
              expect.objectContaining({
                AND:
                  expect.arrayContaining([
                    expect.objectContaining({
                      students:
                        {
                          payment_student_items:
                            {
                              none: {
                                school_period_id:
                                  PERIOD_ID,
                              },
                            },
                        },
                    }),
                  ]),
              }),
          }),
        );
      },
    );

    it('builds the consolidated report with family-level APAFA statistics, student-level Taller statistics and stable order', async () => {
      prisma.school_periods.findUnique.mockResolvedValue(period);
      prisma.enrollments.findMany.mockResolvedValue([
        createPaymentsEnrollment({
          enrollmentId: '10101010-1010-4010-8010-101010101010',
          studentId: '20202020-2020-4020-8020-202020202020',
          personId: '30303030-3030-4030-8030-303030303030',
          firstName: 'Zoe', apafaPaid: true, tallerPaid: false,
        }),
        createPaymentsEnrollment({
          enrollmentId: '40404040-4040-4040-8040-404040404040',
          studentId: '50505050-5050-4050-8050-505050505050',
          personId: '60606060-6060-4060-8060-606060606060',
          firstName: 'Ana', apafaPaid: true, tallerPaid: true,
        }),
      ]);

      const result = await service.getPaymentsReport({ schoolPeriodId: PERIOD_ID, page: 1, limit: 20 });

      expect(result.data.map((row) => row.student.fullName)).toEqual([
        expect.stringContaining('Ana'), expect.stringContaining('Zoe'),
      ]);
      expect(result.statistics).toEqual({
        visibleFamilies: 1, visibleStudents: 2,
        apafaPaid: 1, apafaUnpaid: 0,
        tallerPaid: 1, tallerUnpaid: 1,
      });
      expect(result.pagination).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1 });
    });

    it('applies consolidated payment statuses and forwards academic filters to Prisma', async () => {
      prisma.school_periods.findUnique.mockResolvedValue(period);
      prisma.enrollments.findMany.mockResolvedValue([
        createPaymentsEnrollment({
          enrollmentId: '70707070-7070-4070-8070-707070707070',
          studentId: STUDENT_ID, personId: PERSON_ID,
          firstName: 'Luis', apafaPaid: false, tallerPaid: true,
        }),
      ]);

      const result = await service.getPaymentsReport({
        schoolPeriodId: PERIOD_ID, cycleId: CYCLE_ID,
        educationLevelId: LEVEL_ID, classroomId: CLASSROOM_ID,
        shiftId: SHIFT_ID, apafaStatus: 'PAGADO', tallerStatus: 'PAGADO',
      });

      expect(result.data).toHaveLength(0);
      expect(prisma.enrollments.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          school_period_id: PERIOD_ID, classroom_id: CLASSROOM_ID,
          classrooms: expect.objectContaining({
            education_level_id: LEVEL_ID, shift_id: SHIFT_ID,
            education_levels: { cycle_id: CYCLE_ID },
          }),
        }),
      }));
    });

    it.each([
      ['APAFA', 'PAGADO', true, false, 1],
      ['APAFA', 'NO_PAGADO', true, false, 0],
      ['TALLER', 'PAGADO', false, true, 1],
      ['TALLER', 'NO_PAGADO', false, true, 0],
    ] as const)('filters payment type %s with status %s', async (paymentType, status, apafaPaid, tallerPaid, expected) => {
      prisma.school_periods.findUnique.mockResolvedValue(period);
      prisma.enrollments.findMany.mockResolvedValue([createPaymentsEnrollment({
        enrollmentId: '78787878-7878-4787-8787-787878787878', studentId: STUDENT_ID,
        personId: PERSON_ID, firstName: 'Eva', apafaPaid, tallerPaid,
      })]);
      const result = await service.getPaymentsReport({ schoolPeriodId: PERIOD_ID, paymentType, status });
      expect(result.data).toHaveLength(expected);
    });

    it('ranks classrooms without duplicating a paid APAFA family shared by siblings', async () => {
      prisma.school_periods.findUnique.mockResolvedValue(period);
      prisma.enrollments.findMany.mockResolvedValue([
        createPaymentsEnrollment({ enrollmentId: '89898989-8989-4898-8898-898989898989', studentId: STUDENT_ID, personId: PERSON_ID, firstName: 'Ana', apafaPaid: false, tallerPaid: false }),
        createPaymentsEnrollment({ enrollmentId: '90909090-9090-4090-8090-909090909090', studentId: '91919191-9191-4191-8191-919191919191', personId: '92929292-9292-4292-8292-929292929292', firstName: 'Luz', apafaPaid: false, tallerPaid: false }),
      ]);
      const result = await service.getSummary({ schoolPeriodId: PERIOD_ID });
      expect(result.apafa).toMatchObject({ totalFamilies: 1, unpaid: 1 });
      expect(result.taller).toMatchObject({ totalStudents: 2, unpaid: 2 });
      expect(result.classrooms[0]).toMatchObject({ apafaUnpaid: 1, tallerUnpaid: 2 });
    });

    it('generates valid consolidated XLSX and PDF files', async () => {
      prisma.school_periods.findUnique.mockResolvedValue(period);
      prisma.enrollments.findMany.mockResolvedValue([
        createPaymentsEnrollment({
          enrollmentId: '80808080-8080-4080-8080-808080808080',
          studentId: STUDENT_ID, personId: PERSON_ID,
          firstName: 'Luis', apafaPaid: true, tallerPaid: true,
        }),
      ]);

      const xlsx = await service.exportPaymentsXlsx({ schoolPeriodId: PERIOD_ID });
      const pdf = await service.exportPaymentsPdf({ schoolPeriodId: PERIOD_ID });
      expect(Buffer.isBuffer(xlsx.buffer)).toBe(true);
      expect(xlsx.filename).toBe('reporte-pagos-2026.xlsx');
      expect(pdf.buffer.subarray(0, 4).toString()).toBe('%PDF');
      expect(pdf.filename).toBe('reporte-pagos-2026.pdf');
      const pageObjects = pdf.buffer.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? [];
      expect(pageObjects).toHaveLength(1);
      const mediaBox = pdf.buffer.toString('latin1').match(/\/MediaBox\s*\[0 0 ([\d.]+) ([\d.]+)\]/);
      expect(mediaBox).not.toBeNull();
      expect(Number(mediaBox?.[1])).toBeGreaterThan(Number(mediaBox?.[2]));
    });

    it('fits the current 12-student dataset on one readable landscape page', async () => {
      prisma.school_periods.findUnique.mockResolvedValue(period);
      prisma.enrollments.findMany.mockResolvedValue(Array.from({ length: 12 }, (_, index) => {
        const suffix = String(index + 1).padStart(12, '0');
        return createPaymentsEnrollment({
          enrollmentId: `10000000-0000-4000-8000-${suffix}`,
          studentId: `20000000-0000-4000-8000-${suffix}`,
          personId: `30000000-0000-4000-8000-${suffix}`,
          firstName: `Estudiante ${index + 1}`,
          apafaPaid: index % 2 === 0,
          tallerPaid: index % 3 === 0,
        });
      }));

      const pdf = await service.exportPaymentsPdf({ schoolPeriodId: PERIOD_ID, paymentType: 'ALL' });
      const pageObjects = pdf.buffer.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? [];
      expect(pageObjects).toHaveLength(1);
    });

    it('projects the seven essential Pagos PDF columns and real business payment dates', async () => {
      prisma.school_periods.findUnique.mockResolvedValue(period);
      prisma.enrollments.findMany.mockResolvedValue([
        createPaymentsEnrollment({
          enrollmentId: 'abababab-abab-4bab-8bab-abababababab',
          studentId: STUDENT_ID, personId: PERSON_ID,
          firstName: 'Luis', apafaPaid: true, tallerPaid: false,
        }),
      ]);
      const pdf = vi.spyOn(service as any, 'createPaymentsPdf').mockResolvedValue(Buffer.from('%PDF'));
      await service.exportPaymentsPdf({
        schoolPeriodId: PERIOD_ID, classroomId: CLASSROOM_ID,
        paymentType: 'TALLER', status: 'NO_PAGADO',
      });
      const [year, filters, columns, rows, statistics, type] = pdf.mock.calls[0] as any[];
      expect(year).toBe(2026);
      expect(filters).toEqual(expect.arrayContaining(['Aula: Aula A', 'Tipo de pago: TALLER', 'Estado de pago: No pagado']));
      expect(columns.map((column: { key: string }) => column.key)).toEqual([
        'number', 'student', 'cycleLevel', 'shift', 'classroom', 'taller',
      ]);
      expect(rows[0]).toEqual(expect.objectContaining({
        student: expect.stringContaining('Luis'), cycleLevel: 'Ciclo II / 4 años',
        shift: 'Mañana', classroom: 'Aula A', taller: { status: 'DEBE', date: '-' },
      }));
      expect(statistics.apafaPaid).toBe(1);
      expect(type).toBe('TALLER');
    });

    it.each([
      ['ALL', ['number', 'student', 'cycleLevel', 'shift', 'classroom', 'apafa', 'taller']],
      ['APAFA', ['number', 'student', 'cycleLevel', 'shift', 'classroom', 'apafa']],
      ['TALLER', ['number', 'student', 'cycleLevel', 'shift', 'classroom', 'taller']],
    ] as const)('projects dynamic consolidated PDF columns for %s without Familia', async (paymentType, expectedKeys) => {
      prisma.school_periods.findUnique.mockResolvedValue(period);
      prisma.enrollments.findMany.mockResolvedValue([createPaymentsEnrollment({
        enrollmentId: 'abababab-abab-4bab-8bab-abababababab',
        studentId: STUDENT_ID, personId: PERSON_ID, firstName: 'Luis', apafaPaid: true, tallerPaid: false,
      })]);
      const pdf = vi.spyOn(service as any, 'createPaymentsPdf').mockResolvedValue(Buffer.from('%PDF'));
      await service.exportPaymentsPdf({ schoolPeriodId: PERIOD_ID, paymentType });
      const columns = pdf.mock.calls[0][2] as Array<{ key: string }>;
      const rows = pdf.mock.calls[0][3] as Array<Record<string, unknown>>;
      expect(columns.map((column) => column.key)).toEqual(expectedKeys);
      expect(columns.map((column) => column.key)).not.toContain('family');
      expect(rows[0]).toMatchObject({
        apafa: { status: 'PAGO', date: '12/09/2026' },
        taller: { status: 'DEBE', date: '-' },
      });
    });

    it('repeats family-level APAFA status for siblings in the PDF without changing obligations', async () => {
      prisma.school_periods.findUnique.mockResolvedValue(period);
      prisma.family_groups.findMany.mockResolvedValue([{ id: FAMILY_ID }]);
      prisma.enrollments.findMany.mockResolvedValue([
        createPaymentsEnrollment({
          enrollmentId: 'bcbcbcbc-bcbc-4cbc-8cbc-bcbcbcbcbcbc',
          studentId: STUDENT_ID, personId: PERSON_ID,
          firstName: 'Luis', apafaPaid: true, tallerPaid: false,
        }),
        createPaymentsEnrollment({
          enrollmentId: 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd',
          studentId: 'edededed-eded-4ded-8ded-edededededed',
          personId: 'fefefefe-fefe-4efe-8efe-fefefefefefe',
          firstName: 'Ana', apafaPaid: true, tallerPaid: false,
        }),
      ]);
      const pdf = vi.spyOn(service as any, 'createSimpleReportPdf').mockResolvedValue(Buffer.from('%PDF'));
      await service.exportApafaPdf({ schoolPeriodId: PERIOD_ID, status: 'PAGADO' });
      const [title, , filters, columns, rows] = pdf.mock.calls[0] as any[];
      expect(title).toBe('REPORTE DE PAGOS APAFA');
      expect(filters).toContain('APAFA: PAGADO');
      expect(columns.map((column: { key: string }) => column.key)).toEqual([
        'student', 'classroom', 'shift', 'status', 'date',
      ]);
      expect(rows).toHaveLength(2);
      expect(rows.map((row: { date: string }) => row.date)).toEqual(['12/09/2026', '12/09/2026']);
      expect(prisma.family_groups.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ AND: expect.any(Array) }),
      }));
    });

    it('projects Taller PDF by student with a dash for unpaid dates and existing academic filters', async () => {
      prisma.school_periods.findUnique.mockResolvedValue(period);
      prisma.enrollments.findMany.mockResolvedValue([createTallerEnrollment(false)]);
      const pdf = vi.spyOn(service as any, 'createSimpleReportPdf').mockResolvedValue(Buffer.from('%PDF'));
      await service.exportTallerPdf({
        schoolPeriodId: PERIOD_ID, educationLevelId: LEVEL_ID,
        classroomId: CLASSROOM_ID, shiftId: SHIFT_ID, status: 'NO_PAGADO',
      });
      const [title, , filters, columns, rows] = pdf.mock.calls[0] as any[];
      expect(title).toBe('REPORTE DE PAGOS TALLER');
      expect(filters).toEqual(expect.arrayContaining(['Aula: Aula A', 'Taller: NO_PAGADO']));
      expect(columns.map((column: { key: string }) => column.key)).toEqual([
        'student', 'classroom', 'shift', 'status', 'date',
      ]);
      expect(rows[0]).toEqual(expect.objectContaining({
        classroom: 'Aula A', status: 'NO_PAGADO', date: '-',
      }));
      expect(prisma.enrollments.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ AND: expect.any(Array) }),
      }));
    });

    it(
      'generates a valid APAFA XLSX buffer',
      async () => {
        prisma
          .school_periods
          .findUnique
          .mockResolvedValue(
            period,
          );

        prisma
          .family_groups
          .findMany
          .mockResolvedValue([
            createApafaFamily(
              true,
            ),
          ]);

        const result =
          await service
            .exportApafaXlsx({
              schoolPeriodId:
                PERIOD_ID,
            });

        expect(
          Buffer.isBuffer(
            result.buffer,
          ),
        ).toBe(true);

        expect(
          result.buffer.length,
        ).toBeGreaterThan(
          0,
        );

        expect(
          result.contentType,
        ).toBe(
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );

        expect(
          result.filename,
        ).toBe(
          'reporte-apafa-2026.xlsx',
        );
      },
    );

    it(
      'generates a valid Taller XLSX buffer',
      async () => {
        prisma
          .school_periods
          .findUnique
          .mockResolvedValue(
            period,
          );

        prisma
          .enrollments
          .findMany
          .mockResolvedValue([
            createTallerEnrollment(
              true,
            ),
          ]);

        const result =
          await service
            .exportTallerXlsx({
              schoolPeriodId:
                PERIOD_ID,
            });

        expect(
          Buffer.isBuffer(
            result.buffer,
          ),
        ).toBe(true);

        expect(
          result.buffer.length,
        ).toBeGreaterThan(
          0,
        );

        expect(
          result.filename,
        ).toBe(
          'reporte-taller-2026.xlsx',
        );
      },
    );

    it(
      'generates a valid APAFA PDF buffer',
      async () => {
        prisma
          .school_periods
          .findUnique
          .mockResolvedValue(
            period,
          );

        prisma
          .family_groups
          .findMany
          .mockResolvedValue([
            { id: FAMILY_ID },
          ]);
        prisma.enrollments.findMany.mockResolvedValue([
          createPaymentsEnrollment({
            enrollmentId: '90909090-9090-4090-8090-909090909090',
            studentId: STUDENT_ID, personId: PERSON_ID,
            firstName: 'Luis', apafaPaid: true, tallerPaid: false,
          }),
        ]);

        const result =
          await service
            .exportApafaPdf({
              schoolPeriodId:
                PERIOD_ID,
            });

        expect(
          Buffer.isBuffer(
            result.buffer,
          ),
        ).toBe(true);

        expect(
          result.buffer
            .subarray(
              0,
              4,
            )
            .toString(),
        ).toBe(
          '%PDF',
        );

        expect(
          result.filename,
        ).toBe(
          'reporte-apafa-2026.pdf',
        );
      },
    );

    it('keeps payment PDF section titles and table on the same horizontal anchor', () => {
      const contentLeft = 38;
      const layout = (service as any).getPaymentsPdfHorizontalLayout(contentLeft);

      expect(layout).toEqual({
        criteriaTitleX: contentLeft,
        summaryTitleX: contentLeft,
        studentsTitleX: contentLeft,
        tableX: contentLeft,
      });
      expect(new Set(Object.values(layout))).toEqual(new Set([contentLeft]));
    });

    it(
      'generates a valid Taller PDF buffer',
      async () => {
        prisma
          .school_periods
          .findUnique
          .mockResolvedValue(
            period,
          );

        prisma
          .enrollments
          .findMany
          .mockResolvedValue([
            createTallerEnrollment(
              true,
            ),
          ]);

        const result =
          await service
            .exportTallerPdf({
              schoolPeriodId:
                PERIOD_ID,
            });

        expect(
          Buffer.isBuffer(
            result.buffer,
          ),
        ).toBe(true);

        expect(
          result.buffer
            .subarray(
              0,
              4,
            )
            .toString(),
        ).toBe(
          '%PDF',
        );

        expect(
          result.filename,
        ).toBe(
          'reporte-taller-2026.pdf',
        );
      },
    );
  },
);
