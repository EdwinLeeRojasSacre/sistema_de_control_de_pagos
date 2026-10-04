import { ConflictException } from '@nestjs/common';
import { vi } from 'vitest';

import { PrismaService } from '../prisma/prisma.service.js';
import { AcademicStructureService } from './academic-structure.service.js';

const context = {
  userId: '11111111-1111-4111-8111-111111111111',
  ipAddress: '127.0.0.1',
  deviceName: 'vitest',
};

const classroom = {
  id: '44444444-4444-4444-8444-444444444444',
  school_period_id: '22222222-2222-4222-8222-222222222222',
  education_level_id: '33333333-3333-4333-8333-333333333333',
  shift_id: '55555555-5555-4555-8555-555555555555',
  name: 'Conejitos',
  capacity: 25,
  is_active: true,
  shifts: {
    id: '55555555-5555-4555-8555-555555555555',
    code: 'MANANA',
    name: 'Mañana',
  },
};

describe('AcademicStructureService', () => {
  let service: AcademicStructureService;
  let prisma: Record<string, Record<string, ReturnType<typeof vi.fn>>> & {
    $transaction: ReturnType<typeof vi.fn>;
  };
  let transaction: Record<string, Record<string, ReturnType<typeof vi.fn>>>;

  beforeEach(() => {
    transaction = {
      school_periods: { findUnique: vi.fn() },
      education_levels: { findFirst: vi.fn() },
      shifts: { findUnique: vi.fn() },
      classrooms: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      audit_logs: { create: vi.fn() },
    };
    prisma = {
      school_periods: { findUnique: vi.fn(), findMany: vi.fn() },
      education_cycles: { findMany: vi.fn() },
      education_levels: { findMany: vi.fn() },
      shifts: { findMany: vi.fn() },
      $transaction: vi.fn((callback: (client: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    };
    service = new AcademicStructureService(prisma as unknown as PrismaService);

    transaction.school_periods.findUnique.mockResolvedValue({
      id: classroom.school_period_id,
      status: 'PLANNED',
    });
    transaction.education_levels.findFirst.mockResolvedValue({
      id: classroom.education_level_id,
    });
    transaction.shifts.findUnique.mockResolvedValue({ id: classroom.shift_id });
    transaction.classrooms.findFirst.mockResolvedValue(null);
    transaction.classrooms.create.mockResolvedValue(classroom);
    transaction.classrooms.update.mockResolvedValue(classroom);
  });

  it('lists the complete structure grouped by cycle for one period', async () => {
    prisma.school_periods.findUnique.mockResolvedValue({
      id: classroom.school_period_id,
      year: 2027,
      status: 'PLANNED',
      is_active: true,
    });
    prisma.education_cycles.findMany.mockResolvedValue([
      {
        id: 'cycle-1',
        code: 'CICLO_I',
        name: 'Ciclo I',
        education_levels: [
          {
            id: classroom.education_level_id,
            name: 'Cuna',
            min_age_months: 16,
            max_age_months: 36,
            classrooms: [classroom],
          },
        ],
      },
    ]);

    await expect(
      service.findByPeriod(classroom.school_period_id),
    ).resolves.toEqual(
      expect.objectContaining({
        cycles: [expect.objectContaining({ code: 'CICLO_I' })],
      }),
    );
  });

  it('creates a classroom and audits the operation', async () => {
    await expect(
      service.createClassroom(
        {
          schoolPeriodId: classroom.school_period_id,
          educationLevelId: classroom.education_level_id,
          shiftId: classroom.shift_id,
          name: '  Conejitos  ',
          capacity: 25,
        },
        context,
      ),
    ).resolves.toEqual(expect.objectContaining({ name: 'Conejitos' }));
    expect(transaction.audit_logs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entity_name: 'classrooms',
        action: 'CREATE',
      }),
    });
  });

  it('allows multiple different classroom names for the same level', async () => {
    transaction.classrooms.create
      .mockResolvedValueOnce(classroom)
      .mockResolvedValueOnce({ ...classroom, id: 'other', name: 'Ositos' });
    const base = {
      schoolPeriodId: classroom.school_period_id,
      educationLevelId: classroom.education_level_id,
      shiftId: classroom.shift_id,
    };
    await service.createClassroom({ ...base, name: 'Conejitos' }, context);
    await service.createClassroom({ ...base, name: 'Ositos' }, context);
    expect(transaction.classrooms.create).toHaveBeenCalledTimes(2);
  });

  it('allows the same classroom combination in another period', async () => {
    transaction.school_periods.findUnique.mockResolvedValue({
      id: '66666666-6666-4666-8666-666666666666',
      status: 'PLANNED',
    });
    await service.createClassroom(
      {
        schoolPeriodId: '66666666-6666-4666-8666-666666666666',
        educationLevelId: classroom.education_level_id,
        shiftId: classroom.shift_id,
        name: classroom.name,
      },
      context,
    );
    expect(transaction.classrooms.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          school_period_id: '66666666-6666-4666-8666-666666666666',
        }),
      }),
    );
  });

  it('allows the same name in a different shift', async () => {
    const afternoon = '77777777-7777-4777-8777-777777777777';
    await service.createClassroom(
      {
        schoolPeriodId: classroom.school_period_id,
        educationLevelId: classroom.education_level_id,
        shiftId: afternoon,
        name: classroom.name,
      },
      context,
    );
    expect(transaction.classrooms.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ shift_id: afternoon }),
      }),
    );
  });

  it('rejects an exact functional duplicate in the same period', async () => {
    transaction.classrooms.findFirst.mockResolvedValue({ id: classroom.id });
    await expect(
      service.createClassroom(
        {
          schoolPeriodId: classroom.school_period_id,
          educationLevelId: classroom.education_level_id,
          shiftId: classroom.shift_id,
          name: classroom.name,
        },
        context,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('enables a disabled classroom with audit', async () => {
    transaction.classrooms.findUnique.mockResolvedValue({
      ...classroom,
      is_active: false,
    });
    await service.enableClassroom(classroom.id, context);
    expect(transaction.audit_logs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'ENABLE' }),
    });
  });

  it('disables an enabled classroom with audit', async () => {
    transaction.classrooms.findUnique.mockResolvedValue(classroom);
    transaction.classrooms.update.mockResolvedValue({
      ...classroom,
      is_active: false,
    });
    await service.disableClassroom(classroom.id, context);
    expect(transaction.audit_logs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'DISABLE' }),
    });
  });

  it.each(['create', 'enable', 'disable'])(
    'rejects %s when the period is closed',
    async (operation) => {
      transaction.school_periods.findUnique.mockResolvedValue({
        id: classroom.school_period_id,
        status: 'CLOSED',
      });
      transaction.classrooms.findUnique.mockResolvedValue(classroom);

      const promise =
        operation === 'create'
          ? service.createClassroom(
              {
                schoolPeriodId: classroom.school_period_id,
                educationLevelId: classroom.education_level_id,
                shiftId: classroom.shift_id,
                name: classroom.name,
              },
              context,
            )
          : operation === 'enable'
            ? service.enableClassroom(classroom.id, context)
            : service.disableClassroom(classroom.id, context);

      await expect(promise).rejects.toBeInstanceOf(ConflictException);
    },
  );

  it('updates classroom data and audits it', async () => {
    transaction.classrooms.findUnique.mockResolvedValue(classroom);
    transaction.classrooms.update.mockResolvedValue({
      ...classroom,
      name: 'Abejitas',
    });
    await service.updateClassroom(classroom.id, { name: 'Abejitas' }, context);
    expect(transaction.audit_logs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'UPDATE' }),
    });
  });
});
