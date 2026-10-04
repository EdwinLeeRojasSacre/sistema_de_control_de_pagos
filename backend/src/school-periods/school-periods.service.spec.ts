import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { vi } from 'vitest';

import { PrismaService } from '../prisma/prisma.service.js';
import { SchoolPeriodsService } from './school-periods.service.js';

const auditContext = {
  userId: '11111111-1111-4111-8111-111111111111',
  ipAddress: '127.0.0.1',
  deviceName: 'vitest',
};

const period = {
  id: '22222222-2222-4222-8222-222222222222',
  year: 2027,
  start_date: new Date('2027-03-01T00:00:00.000Z'),
  end_date: new Date('2027-12-15T00:00:00.000Z'),
  status: 'PLANNED',
  is_active: true,
  created_at: new Date('2026-09-11T10:00:00.000Z'),
  updated_at: new Date('2026-09-11T10:00:00.000Z'),
};

const noReferences = {
  enrollments: 0,
  payments: 0,
};

describe('SchoolPeriodsService', () => {
  let service: SchoolPeriodsService;

  let prisma: {
    school_periods: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };

  let transaction: {
    school_periods: {
      findUnique: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    audit_logs: {
      create: ReturnType<typeof vi.fn>;
    };
    classrooms: {
      count: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      createMany: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    transaction = {
      school_periods: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      audit_logs: {
        create: vi.fn(),
      },
      classrooms: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
        createMany: vi.fn(),
      },
    };

    prisma = {
      school_periods: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
      $transaction: vi.fn((callback: (client: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    };

    service = new SchoolPeriodsService(prisma as unknown as PrismaService);

    vi.spyOn(
      service as unknown as {
        getNow: () => Date;
      },
      'getNow',
    ).mockReturnValue(new Date('2027-06-01T12:00:00.000Z'));
  });

  it('lists periods ordered by descending year', async () => {
    prisma.school_periods.findMany.mockResolvedValue([period]);

    await expect(service.findAll()).resolves.toEqual(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            year: 2027,
            status: 'PLANNED',
          }),
        ],
      }),
    );

    expect(prisma.school_periods.findMany).toHaveBeenCalledWith({
      orderBy: {
        year: 'desc',
      },
    });
  });

  it('returns period detail and whether it has historical references', async () => {
    prisma.school_periods.findUnique.mockResolvedValue({
      ...period,
      _count: {
        ...noReferences,
        enrollments: 1,
      },
    });

    await expect(service.findById(period.id)).resolves.toEqual(
      expect.objectContaining({
        id: period.id,
        hasReferences: true,
      }),
    );
  });

  it('returns 404 when detail does not exist', async () => {
    prisma.school_periods.findUnique.mockResolvedValue(null);

    await expect(service.findById(period.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('creates a valid planned and enabled period with audit', async () => {
    transaction.school_periods.findUnique.mockResolvedValue(null);

    transaction.school_periods.create.mockResolvedValue(period);

    await expect(
      service.create(
        {
          year: 2027,
          startDate: '2027-03-01',
          endDate: '2027-12-15',
        },
        auditContext,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'PLANNED',
        isActive: true,
      }),
    );

    expect(transaction.school_periods.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: 'PLANNED',
        is_active: true,
      }),
    });

    expect(transaction.audit_logs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'CREATE',
      }),
    });
  });

  it.each([
    ['2027-03-01', '2027-03-01'],
    ['2027-04-01', '2027-03-01'],
    ['2026-12-31', '2027-12-15'],
  ])('rejects invalid date rules (%s, %s)', async (startDate, endDate) => {
    await expect(
      service.create(
        {
          year: 2027,
          startDate,
          endDate,
        },
        auditContext,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a duplicate year', async () => {
    transaction.school_periods.findUnique.mockResolvedValue({
      id: 'other',
    });

    await expect(
      service.create(
        {
          year: 2027,
          startDate: '2027-03-01',
          endDate: '2027-12-15',
        },
        auditContext,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('opens a planned enabled period and audits it', async () => {
    transaction.school_periods.findUnique.mockResolvedValue(period);

    transaction.school_periods.findFirst.mockResolvedValue(null);

    transaction.school_periods.update.mockResolvedValue({
      ...period,
      status: 'OPEN',
    });

    await expect(service.open(period.id, auditContext)).resolves.toEqual(
      expect.objectContaining({
        status: 'OPEN',
      }),
    );

    expect(transaction.audit_logs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'OPEN',
      }),
    });
  });

  it('allows the current and following year to remain open simultaneously', async () => {
    const followingPeriod = {
      ...period,
      year: 2028,
      start_date: new Date('2028-03-01T00:00:00.000Z'),
      end_date: new Date('2028-12-15T00:00:00.000Z'),
    };
    transaction.school_periods.findUnique.mockResolvedValue(followingPeriod);
    transaction.classrooms.count.mockResolvedValue(1);
    transaction.school_periods.update.mockResolvedValue({
      ...followingPeriod,
      status: 'OPEN',
    });

    await expect(service.open(period.id, auditContext)).resolves.toEqual(
      expect.objectContaining({ year: 2028, status: 'OPEN' }),
    );
  });

  it('inherits active classrooms from the immediately previous period when opening', async () => {
    const sourcePeriod = {
      id: '33333333-3333-4333-8333-333333333333',
      year: 2026,
    };
    const sourceClassrooms = [
      ['Abejitas', 'level-3', 'morning', 20],
      ['Abejitas', 'level-3', 'afternoon', 20],
      ['Ositos', 'level-3', 'morning', 20],
      ['Ositos', 'level-3', 'afternoon', 20],
      ['Maripositas', 'level-4', 'morning', 22],
      ['Maripositas', 'level-4', 'afternoon', 22],
      ['Arcoíris', 'level-4', 'morning', 22],
      ['Arcoíris', 'level-4', 'afternoon', 22],
      ['Conejitos', 'level-5', 'morning', 24],
      ['Conejitos', 'level-5', 'afternoon', 24],
      ['Estrellitas', 'level-5', 'morning', 24],
      ['Estrellitas', 'level-5', 'afternoon', 24],
    ].map(([name, educationLevelId, shiftId, capacity]) => ({
      name: String(name),
      education_level_id: String(educationLevelId),
      shift_id: String(shiftId),
      capacity: Number(capacity),
    }));
    transaction.school_periods.findUnique
      .mockResolvedValueOnce(period)
      .mockResolvedValueOnce(sourcePeriod);
    transaction.school_periods.findFirst.mockResolvedValue(null);
    transaction.classrooms.count.mockResolvedValue(0);
    transaction.classrooms.findMany.mockResolvedValue(sourceClassrooms);
    transaction.classrooms.createMany.mockResolvedValue({ count: 12 });
    transaction.school_periods.update.mockResolvedValue({
      ...period,
      status: 'OPEN',
    });

    await service.open(period.id, auditContext);

    expect(transaction.classrooms.findMany).toHaveBeenCalledWith({
      where: { school_period_id: sourcePeriod.id, is_active: true },
      select: {
        education_level_id: true,
        shift_id: true,
        name: true,
        capacity: true,
      },
    });
    expect(transaction.classrooms.createMany).toHaveBeenCalledWith({
      data: sourceClassrooms.map((classroom) => ({
        school_period_id: period.id,
        education_level_id: classroom.education_level_id,
        shift_id: classroom.shift_id,
        name: classroom.name,
        capacity: classroom.capacity,
        is_active: true,
      })),
    });
    const inheritedRows =
      transaction.classrooms.createMany.mock.calls[0][0].data;
    expect(inheritedRows).toHaveLength(12);
    expect(
      inheritedRows.every((row: Record<string, unknown>) => !('id' in row)),
    ).toBe(true);
    expect(transaction.school_periods.update).toHaveBeenCalledTimes(1);
    expect(transaction.school_periods.update.mock.calls[0][0].where).toEqual({
      id: period.id,
    });
    expect(transaction.audit_logs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'OPEN',
        new_value: expect.objectContaining({
          academicInheritance: expect.objectContaining({
            sourceSchoolPeriodId: sourcePeriod.id,
            inheritedClassrooms: 12,
            reason: 'INHERITED',
          }),
        }),
      }),
    });
  });

  it('does not duplicate classrooms when the target period is already configured', async () => {
    transaction.school_periods.findUnique.mockResolvedValue(period);
    transaction.school_periods.findFirst.mockResolvedValue(null);
    transaction.classrooms.count.mockResolvedValue(1);
    transaction.school_periods.update.mockResolvedValue({
      ...period,
      status: 'OPEN',
    });

    await service.open(period.id, auditContext);

    expect(transaction.classrooms.findMany).not.toHaveBeenCalled();
    expect(transaction.classrooms.createMany).not.toHaveBeenCalled();
  });

  it('opens without inventing classrooms when the immediately previous period does not exist', async () => {
    transaction.school_periods.findUnique
      .mockResolvedValueOnce(period)
      .mockResolvedValueOnce(null);
    transaction.school_periods.findFirst.mockResolvedValue(null);
    transaction.classrooms.count.mockResolvedValue(0);
    transaction.school_periods.update.mockResolvedValue({
      ...period,
      status: 'OPEN',
    });

    await expect(service.open(period.id, auditContext)).resolves.toEqual(
      expect.objectContaining({ status: 'OPEN' }),
    );
    expect(transaction.classrooms.createMany).not.toHaveBeenCalled();
    expect(transaction.audit_logs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        new_value: expect.objectContaining({
          academicInheritance: expect.objectContaining({
            inheritedClassrooms: 0,
            reason: 'PREVIOUS_PERIOD_NOT_FOUND',
          }),
        }),
      }),
    });
  });

  it('opens without classrooms when the previous period has no active academic offer', async () => {
    transaction.school_periods.findUnique
      .mockResolvedValueOnce(period)
      .mockResolvedValueOnce({
        id: '33333333-3333-4333-8333-333333333333',
        year: 2026,
      });
    transaction.school_periods.findFirst.mockResolvedValue(null);
    transaction.classrooms.findMany.mockResolvedValue([]);
    transaction.school_periods.update.mockResolvedValue({
      ...period,
      status: 'OPEN',
    });

    await expect(service.open(period.id, auditContext)).resolves.toEqual(
      expect.objectContaining({ status: 'OPEN' }),
    );
    expect(transaction.classrooms.createMany).not.toHaveBeenCalled();
    expect(transaction.audit_logs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        new_value: expect.objectContaining({
          academicInheritance: expect.objectContaining({
            inheritedClassrooms: 0,
            reason: 'PREVIOUS_PERIOD_WITHOUT_ACTIVE_CLASSROOMS',
          }),
        }),
      }),
    });
  });

  it('does not duplicate inherited classrooms on two competing open requests', async () => {
    let livePeriod = period;
    let queue = Promise.resolve();
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof transaction) => Promise<unknown>) => {
        const operation = queue.then(() => callback(transaction));
        queue = operation.then(
          () => undefined,
          () => undefined,
        );
        return operation;
      },
    );
    transaction.school_periods.findUnique.mockImplementation(
      ({ where }: { where: { id?: string } }) =>
        Promise.resolve(
          where.id
            ? livePeriod
            : { id: '33333333-3333-4333-8333-333333333333', year: 2026 },
        ),
    );
    transaction.school_periods.findFirst.mockResolvedValue(null);
    transaction.classrooms.count.mockResolvedValue(0);
    transaction.classrooms.findMany.mockResolvedValue([
      {
        education_level_id: 'level-3',
        shift_id: 'morning',
        name: 'Ositos',
        capacity: 20,
      },
    ]);
    transaction.classrooms.createMany.mockResolvedValue({ count: 1 });
    transaction.school_periods.update.mockImplementation(() => {
      livePeriod = { ...period, status: 'OPEN' };
      return Promise.resolve(livePeriod);
    });

    const results = await Promise.allSettled([
      service.open(period.id, auditContext),
      service.open(period.id, auditContext),
    ]);

    expect(results.map((result) => result.status)).toEqual([
      'fulfilled',
      'rejected',
    ]);
    expect(transaction.classrooms.createMany).toHaveBeenCalledTimes(1);
    expect(transaction.audit_logs.create).toHaveBeenCalledTimes(1);
  });

  it('does not open or audit the period when classroom inheritance fails', async () => {
    transaction.school_periods.findUnique
      .mockResolvedValueOnce(period)
      .mockResolvedValueOnce({
        id: '33333333-3333-4333-8333-333333333333',
        year: 2026,
      });
    transaction.school_periods.findFirst.mockResolvedValue(null);
    transaction.classrooms.count.mockResolvedValue(0);
    transaction.classrooms.findMany.mockResolvedValue([
      {
        education_level_id: 'level-3',
        shift_id: 'morning',
        name: 'Ositos',
        capacity: 20,
      },
    ]);
    transaction.classrooms.createMany.mockRejectedValue(
      new Error('database failure'),
    );

    await expect(service.open(period.id, auditContext)).rejects.toThrow(
      'database failure',
    );
    expect(transaction.school_periods.update).not.toHaveBeenCalled();
    expect(transaction.audit_logs.create).not.toHaveBeenCalled();
  });

  it('rejects opening a disabled period', async () => {
    transaction.school_periods.findUnique.mockResolvedValue({
      ...period,
      is_active: false,
    });

    await expect(service.open(period.id, auditContext)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('closes an open period and audits it', async () => {
    vi.mocked(
      (service as unknown as { getNow: () => Date }).getNow,
    ).mockReturnValue(new Date('2027-12-01T12:00:00.000Z'));

    transaction.school_periods.findUnique.mockResolvedValue({
      ...period,
      status: 'OPEN',
    });

    transaction.school_periods.update.mockResolvedValue({
      ...period,
      status: 'CLOSED',
    });

    await expect(service.close(period.id, auditContext)).resolves.toEqual(
      expect.objectContaining({
        status: 'CLOSED',
      }),
    );

    expect(transaction.audit_logs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'CLOSE',
      }),
    });
  });

  it('rejects closing a period that is not open', async () => {
    transaction.school_periods.findUnique.mockResolvedValue(period);

    await expect(service.close(period.id, auditContext)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rejects closing the current period before December without mutating it', async () => {
    transaction.school_periods.findUnique.mockResolvedValue({
      ...period,
      status: 'OPEN',
    });

    await expect(service.close(period.id, auditContext)).rejects.toThrow(
      'solo puede cerrarse en diciembre',
    );

    expect(transaction.school_periods.update).not.toHaveBeenCalled();
    expect(transaction.audit_logs.create).not.toHaveBeenCalled();
  });

  it('rejects closing a future open period', async () => {
    transaction.school_periods.findUnique.mockResolvedValue({
      ...period,
      year: 2028,
      status: 'OPEN',
    });

    await expect(service.close(period.id, auditContext)).rejects.toThrow(
      'No se puede cerrar un período escolar futuro',
    );

    expect(transaction.school_periods.update).not.toHaveBeenCalled();
    expect(transaction.audit_logs.create).not.toHaveBeenCalled();
  });

  it('allows closing a past open period outside December', async () => {
    transaction.school_periods.findUnique.mockResolvedValue({
      ...period,
      year: 2026,
      status: 'OPEN',
    });
    transaction.school_periods.update.mockResolvedValue({
      ...period,
      year: 2026,
      status: 'CLOSED',
    });

    await expect(service.close(period.id, auditContext)).resolves.toEqual(
      expect.objectContaining({
        year: 2026,
        status: 'CLOSED',
      }),
    );
  });

  it('updates valid dates and creates an audit entry', async () => {
    transaction.school_periods.findUnique.mockResolvedValue({
      ...period,
      _count: noReferences,
    });

    transaction.school_periods.update.mockResolvedValue({
      ...period,
      end_date: new Date('2027-12-20T00:00:00.000Z'),
    });

    await service.update(
      period.id,
      {
        endDate: '2027-12-20',
      },
      auditContext,
    );

    expect(transaction.audit_logs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'UPDATE',
      }),
    });
  });

  it('blocks changing year when related history exists', async () => {
    transaction.school_periods.findUnique.mockResolvedValue({
      ...period,
      _count: {
        ...noReferences,
        payments: 1,
      },
    });

    await expect(
      service.update(
        period.id,
        {
          year: 2028,
          startDate: '2028-03-01',
          endDate: '2028-12-15',
        },
        auditContext,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('validates the combined dates when updating', async () => {
    transaction.school_periods.findUnique.mockResolvedValue({
      ...period,
      _count: noReferences,
    });

    await expect(
      service.update(
        period.id,
        {
          endDate: '2027-02-01',
        },
        auditContext,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('enables and disables only planned periods with audit', async () => {
    transaction.school_periods.findUnique
      .mockResolvedValueOnce({
        ...period,
        is_active: false,
      })
      .mockResolvedValueOnce(period);

    transaction.school_periods.update
      .mockResolvedValueOnce(period)
      .mockResolvedValueOnce({
        ...period,
        is_active: false,
      });

    await service.enable(period.id, auditContext);

    await service.disable(period.id, auditContext);

    expect(transaction.audit_logs.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        action: 'ENABLE',
      }),
    });

    expect(transaction.audit_logs.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        action: 'DISABLE',
      }),
    });
  });

  it('retries a serialization conflict before creating', async () => {
    const serializationError = new Prisma.PrismaClientKnownRequestError(
      'Serialization conflict',
      {
        code: 'P2034',
        clientVersion: '6.16.2',
      },
    );

    prisma.$transaction
      .mockRejectedValueOnce(serializationError)
      .mockImplementationOnce(
        (callback: (client: typeof transaction) => unknown) =>
          callback(transaction),
      );

    transaction.school_periods.findUnique.mockResolvedValue(null);

    transaction.school_periods.create.mockResolvedValue(period);

    await service.create(
      {
        year: 2027,
        startDate: '2027-03-01',
        endDate: '2027-12-15',
      },
      auditContext,
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it.each([2026, 2029])(
    'rejects opening a period outside the current or following backend year (%s)',
    async (year) => {
      transaction.school_periods.findUnique.mockResolvedValue({
        ...period,
        year,
      });

      await expect(
        service.open(period.id, auditContext),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(transaction.school_periods.update).not.toHaveBeenCalled();
    },
  );

  it('does not reopen a closed period', async () => {
    transaction.school_periods.findUnique.mockResolvedValue({
      ...period,
      status: 'CLOSED',
    });

    await expect(service.open(period.id, auditContext)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('returns a near-end warning from the backend clock', async () => {
    prisma.school_periods.findMany.mockResolvedValue([
      {
        ...period,
        status: 'OPEN',
        end_date: new Date('2027-06-21T00:00:00.000Z'),
      },
    ]);

    await expect(service.findAll()).resolves.toEqual(
      expect.objectContaining({
        warning: expect.objectContaining({
          type: 'NEAR_END',
          daysRemaining: 20,
        }),
      }),
    );
  });

  it('returns a critical warning when an open period is overdue', async () => {
    prisma.school_periods.findMany.mockResolvedValue([
      {
        ...period,
        status: 'OPEN',
        end_date: new Date('2027-05-31T00:00:00.000Z'),
      },
    ]);

    await expect(service.findAll()).resolves.toEqual(
      expect.objectContaining({
        warning: expect.objectContaining({
          type: 'OVERDUE',
          daysRemaining: -1,
        }),
      }),
    );
  });

  it('does not return a warning when the end date is more than 30 days away', async () => {
    prisma.school_periods.findMany.mockResolvedValue([
      {
        ...period,
        status: 'OPEN',
        end_date: new Date('2027-08-01T00:00:00.000Z'),
      },
    ]);

    await expect(service.findAll()).resolves.toEqual(
      expect.objectContaining({
        warning: null,
      }),
    );
  });
});
