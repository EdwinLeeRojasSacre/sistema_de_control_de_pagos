import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service.js';
import { EnrollmentsService } from './enrollments.service.js';

const ids = {
  student: '11111111-1111-4111-8111-111111111111',
  person: '22222222-2222-4222-8222-222222222222',
  period: '33333333-3333-4333-8333-333333333333',
  classroom: '44444444-4444-4444-8444-444444444444',
  newClassroom: '55555555-5555-4555-8555-555555555555',
  enrollment: '66666666-6666-4666-8666-666666666666',
};

const context = { userId: ids.person, ipAddress: '127.0.0.1', deviceName: 'vitest' };
const dto = { studentId: ids.student, schoolPeriodId: ids.period, classroomId: ids.classroom };
const person = {
  id: ids.person,
  document_type: 'DNI',
  document_number: '12345678',
  first_name: 'Ana',
  last_name_father: 'Pérez',
  last_name_mother: 'Rojas',
  birth_date: new Date('2020-01-01'),
  gender: null,
  phone: null,
  email: null,
  address: null,
  is_active: true,
  created_at: new Date(),
  updated_at: new Date(),
};
const student = {
  id: ids.student,
  person_id: ids.person,
  student_code: 'EST-001',
  is_active: true,
  created_at: new Date(),
  updated_at: new Date(),
  persons: person,
};
const period = {
  id: ids.period,
  year: 2027,
  start_date: new Date('2027-03-01'),
  end_date: new Date('2027-12-15'),
  status: 'OPEN',
  is_active: true,
  created_at: new Date(),
  updated_at: new Date(),
};
const level = {
  id: '77777777-7777-4777-8777-777777777777',
  cycle_id: '88888888-8888-4888-8888-888888888888',
  name: '3 años',
  min_age_months: 36,
  max_age_months: 47,
  is_active: true,
  education_cycles: { id: '88888888-8888-4888-8888-888888888888', code: 'INICIAL', name: 'Inicial' },
};
const classroom = {
  id: ids.classroom,
  school_period_id: ids.period,
  education_level_id: level.id,
  shift_id: '99999999-9999-4999-8999-999999999999',
  name: 'Aula A',
  capacity: 20,
  is_active: true,
  shifts: { id: '99999999-9999-4999-8999-999999999999', code: 'MANANA', name: 'Mañana' },
  education_levels: level,
};
const enrollment = {
  id: ids.enrollment,
  student_id: ids.student,
  school_period_id: ids.period,
  classroom_id: ids.classroom,
  enrollment_date: new Date('2026-09-11'),
  status: 'ACTIVE',
  created_at: new Date(),
  students: student,
  school_periods: period,
  classrooms: classroom,
};

describe('EnrollmentsService', () => {
  let service: EnrollmentsService;
  let transaction: Record<string, Record<string, ReturnType<typeof vi.fn>>>;

  beforeEach(async () => {
    transaction = {
      students: { findUnique: vi.fn().mockResolvedValue(student) },
      family_members: { findFirst: vi.fn().mockResolvedValue({ id: 'member-1' }) },
      school_periods: { findUnique: vi.fn().mockResolvedValue(period) },
      classrooms: { findUnique: vi.fn().mockResolvedValue(classroom) },
      enrollments: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(enrollment),
        update: vi.fn(),
      },
      audit_logs: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: vi.fn((callback: (client: typeof transaction) => unknown) => callback(transaction)),
      enrollments: { findMany: vi.fn(), findUnique: vi.fn() },
      students: { findUnique: vi.fn() },
      school_periods: { findMany: vi.fn() },
      classrooms: { findMany: vi.fn() },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [EnrollmentsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(EnrollmentsService);
  });

  it('is defined', () => expect(service).toBeDefined());

  it('creates a valid enrollment with backend date, ACTIVE status and audit', async () => {
    const result = await service.create(dto, context);
    expect(result.id).toBe(ids.enrollment);
    expect(transaction.enrollments.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ACTIVE', enrollment_date: expect.any(Date) }),
      }),
    );
    expect(transaction.audit_logs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ entity_name: 'enrollments', action: 'CREATE' }),
    });
  });

  it('rejects a missing student', async () => {
    transaction.students.findUnique.mockResolvedValue(null);
    await expect(service.create(dto, context)).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each([
    [{ ...student, is_active: false }, 'inactive student'],
    [{ ...student, persons: { ...person, is_active: false } }, 'inactive person'],
  ])('rejects an %s', async (value) => {
    transaction.students.findUnique.mockResolvedValue(value);
    await expect(service.create(dto, context)).rejects.toBeInstanceOf(ConflictException);
  });

  it('requires active family membership', async () => {
    transaction.family_members.findFirst.mockResolvedValue(null);
    await expect(service.create(dto, context)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a missing school period', async () => {
    transaction.school_periods.findUnique.mockResolvedValue(null);
    await expect(service.create(dto, context)).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each(['PLANNED', 'CLOSED'])('rejects a %s school period', async (status) => {
    transaction.school_periods.findUnique.mockResolvedValue({ ...period, status });
    await expect(service.create(dto, context)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a missing classroom', async () => {
    transaction.classrooms.findUnique.mockResolvedValue(null);
    await expect(service.create(dto, context)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a disabled classroom', async () => {
    transaction.classrooms.findUnique.mockResolvedValue({ ...classroom, is_active: false });
    await expect(service.create(dto, context)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a classroom from another period', async () => {
    transaction.classrooms.findUnique.mockResolvedValue({ ...classroom, school_period_id: 'other' });
    await expect(service.create(dto, context)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects duplicate enrollment for student and period', async () => {
    transaction.enrollments.findUnique.mockResolvedValue({ id: ids.enrollment });
    await expect(service.create(dto, context)).rejects.toBeInstanceOf(ConflictException);
  });

  it('maps a concurrent unique-constraint violation to 409 Conflict', async () => {
    transaction.enrollments.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: '6.16.2',
        meta: { target: ['student_id', 'school_period_id'] },
      }),
    );
    await expect(service.create(dto, context)).rejects.toBeInstanceOf(ConflictException);
  });

  it('changes only the classroom and audits old and new values', async () => {
    transaction.enrollments.findUnique.mockResolvedValue(enrollment);
    transaction.classrooms.findUnique.mockResolvedValue({
      id: ids.newClassroom,
      school_period_id: ids.period,
      is_active: true,
    });
    const updated = {
      ...enrollment,
      classroom_id: ids.newClassroom,
      classrooms: { ...classroom, id: ids.newClassroom, name: 'Aula B' },
    };
    transaction.enrollments.update.mockResolvedValue(updated);
    await service.changeClassroom(ids.enrollment, { classroomId: ids.newClassroom }, context);
    expect(transaction.enrollments.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { classroom_id: ids.newClassroom } }),
    );
    expect(transaction.audit_logs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'CLASSROOM_CHANGE', old_value: expect.any(Object), new_value: expect.any(Object) }),
    });
  });

  it('does not change classroom in a closed period', async () => {
    transaction.enrollments.findUnique.mockResolvedValue({
      ...enrollment,
      school_periods: { ...period, status: 'CLOSED' },
    });
    await expect(
      service.changeClassroom(ids.enrollment, { classroomId: ids.newClassroom }, context),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects an inactive destination classroom', async () => {
    transaction.enrollments.findUnique.mockResolvedValue(enrollment);
    transaction.classrooms.findUnique.mockResolvedValue({
      id: ids.newClassroom,
      school_period_id: ids.period,
      is_active: false,
    });
    await expect(
      service.changeClassroom(ids.enrollment, { classroomId: ids.newClassroom }, context),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a destination classroom from another period', async () => {
    transaction.enrollments.findUnique.mockResolvedValue(enrollment);
    transaction.classrooms.findUnique.mockResolvedValue({
      id: ids.newClassroom,
      school_period_id: 'other',
      is_active: true,
    });
    await expect(
      service.changeClassroom(ids.enrollment, { classroomId: ids.newClassroom }, context),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
