import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { vi } from 'vitest';

import { PrismaService } from '../prisma/prisma.service.js';
import { FamilyGroupsService } from './family-groups.service.js';
import { EnrollmentsService } from '../enrollments/enrollments.service.js';

const auditContext = {
  userId: '11111111-1111-4111-8111-111111111111',
  ipAddress: '127.0.0.1',
  deviceName: 'vitest',
};

const dto = {
  schoolPeriodId: '22222222-2222-4222-8222-222222222222',
  classroomId: '33333333-3333-4333-8333-333333333333',
  documentType: 'DNI',
  documentNumber: '12345678',
  firstName: 'Carlos',
  lastNameFather: 'Pérez',
  lastNameMother: 'Gómez',
  birthDate: '2015-01-15',
};

describe('FamilyGroupsService', () => {
  let service: FamilyGroupsService;
  let transaction: Record<string, Record<string, ReturnType<typeof vi.fn>>>;
  let enrollmentsService: { createInTransaction: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    transaction = {
      family_groups: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      persons: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      students: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      family_members: {
        findMany: vi.fn(),
        create: vi.fn(),
      },
      audit_logs: {
        create: vi.fn(),
      },
    };

    const prisma = {
      $transaction: vi.fn(
        (callback: (client: typeof transaction) => unknown) =>
          callback(transaction),
      ),
    };
    enrollmentsService = {
      createInTransaction: vi.fn().mockResolvedValue({ id: 'enrollment-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FamilyGroupsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: EnrollmentsService,
          useValue: enrollmentsService,
        },
      ],
    }).compile();

    service = module.get<FamilyGroupsService>(FamilyGroupsService);
    vi.spyOn(service as never, 'getFamilyAuditSnapshot' as never)
      .mockResolvedValueOnce({ members: [] })
      .mockResolvedValueOnce({ members: [{ personId: 'person-1' }] });
    vi.spyOn(service as never, 'getFamilyResponse' as never)
      .mockResolvedValue({ id: 'family-1' });

    transaction.family_groups.findUnique.mockResolvedValue({
      id: 'family-1',
      is_active: true,
    });
    transaction.family_members.findMany.mockResolvedValue([]);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates an imported family through the shared transaction without enrolling students', async () => {
    const internal = service as any;
    vi.spyOn(internal, 'validateSchoolPeriod').mockResolvedValue({ year: 2026 });
    vi.spyOn(internal, 'resolveFamilyGroup').mockResolvedValue(null);
    vi.spyOn(internal, 'createOrReuseStudents').mockResolvedValue([{
      student: { id: 'student-1' }, person: { id: 'student-person-1' },
    }]);
    vi.spyOn(internal, 'createOrReuseAdults').mockResolvedValue([{
      person: { id: 'adult-person-1', birth_date: new Date('1990-01-01') },
      relationshipType: 'PADRE', isGuardian: true,
    }]);
    vi.spyOn(internal, 'validateGuardianAge').mockImplementation(() => undefined);
    vi.spyOn(internal, 'generateFamilyCode').mockResolvedValue('FAM-2026-000001');
    vi.spyOn(internal, 'buildFamilyName').mockReturnValue('Familia Pérez');
    vi.spyOn(internal, 'validateStudentFamilyMemberships').mockResolvedValue(undefined);
    vi.spyOn(internal, 'createStudentPersonRelationships').mockResolvedValue(undefined);
    vi.spyOn(internal, 'validateFinalFamilyComposition').mockResolvedValue(undefined);
    vi.spyOn(internal, 'refreshFamilyGroupName').mockResolvedValue(undefined);
    transaction.family_groups.create = vi.fn().mockResolvedValue({ id: 'family-1' });
    transaction.family_members.createMany = vi.fn().mockResolvedValue({ count: 1 });

    await service.createForImport({
      schoolPeriodId: dto.schoolPeriodId,
      students: [{
        documentType: 'DNI', documentNumber: '12345678',
        firstName: 'Ana', lastNameFather: 'Pérez', lastNameMother: 'Soto',
        birthDate: '2018-01-01',
      }],
      adults: [{
        documentType: 'DNI', documentNumber: '70000001',
        firstName: 'Carlos', birthDate: '1990-01-01',
        relationshipType: 'PADRE', isGuardian: true,
      }],
    }, auditContext);

    expect(transaction.family_groups.create).toHaveBeenCalledOnce();
    expect(transaction.family_members.createMany).toHaveBeenCalledTimes(2);
    expect(enrollmentsService.createInTransaction).not.toHaveBeenCalled();
    expect(transaction.audit_logs.create).toHaveBeenCalledOnce();
  });

  it('creates person, student, membership and audit entry for a new child', async () => {
    transaction.persons.findUnique.mockResolvedValue(null);
    transaction.persons.create.mockResolvedValue({
      id: 'person-1',
      is_active: true,
    });
    transaction.students.findUnique.mockResolvedValue(null);
    transaction.students.create.mockResolvedValue({
      id: 'student-1',
      is_active: true,
    });

    await expect(
      service.addStudent('family-1', dto, auditContext),
    ).resolves.toEqual({ id: 'family-1' });

    expect(transaction.persons.create).toHaveBeenCalledOnce();
    expect(transaction.students.create).toHaveBeenCalledWith({
      data: { person_id: 'person-1', is_active: true },
    });
    expect(enrollmentsService.createInTransaction).toHaveBeenCalledWith(
      transaction,
      {
        studentId: 'student-1',
        schoolPeriodId: dto.schoolPeriodId,
        classroomId: dto.classroomId,
      },
      auditContext,
    );
    expect(transaction.family_members.create).toHaveBeenCalledWith({
      data: {
        family_group_id: 'family-1',
        person_id: 'person-1',
        relationship_type: 'ESTUDIANTE',
        is_guardian: false,
      },
    });
    expect(transaction.audit_logs.create).toHaveBeenCalledOnce();
  });

  it('does not write the family audit when enrollment fails in the same transaction', async () => {
    transaction.persons.findUnique.mockResolvedValue(null);
    transaction.persons.create.mockResolvedValue({ id: 'person-1', is_active: true });
    transaction.students.findUnique.mockResolvedValue(null);
    transaction.students.create.mockResolvedValue({ id: 'student-1', is_active: true });
    enrollmentsService.createInTransaction.mockRejectedValue(
      new ConflictException('Matrícula duplicada'),
    );

    await expect(service.addStudent('family-1', dto, auditContext)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(transaction.audit_logs.create).not.toHaveBeenCalled();
  });

  it('reuses an existing active person without a student record', async () => {
    transaction.persons.findUnique.mockResolvedValue({
      id: 'person-1',
      is_active: true,
      first_name: 'Carlos',
      last_name_father: 'Pérez',
      last_name_mother: 'Gómez',
      birth_date: new Date('2015-01-15T00:00:00.000Z'),
    });
    transaction.students.findUnique.mockResolvedValue(null);
    transaction.students.create.mockResolvedValue({
      id: 'student-1',
      is_active: true,
    });

    await service.addStudent('family-1', dto, auditContext);

    expect(transaction.persons.create).not.toHaveBeenCalled();
    expect(transaction.students.create).toHaveBeenCalledOnce();
    expect(transaction.family_members.create).toHaveBeenCalledOnce();
  });

  it('rejects a student already associated with the target family', async () => {
    transaction.persons.findUnique.mockResolvedValue({
      id: 'person-1',
      is_active: true,
      first_name: 'Carlos',
      last_name_father: 'Pérez',
      last_name_mother: 'Gómez',
      birth_date: new Date('2015-01-15T00:00:00.000Z'),
    });
    transaction.students.findUnique.mockResolvedValue({
      id: 'student-1',
      is_active: true,
    });
    transaction.family_members.findMany.mockResolvedValue([
      { family_group_id: 'family-1' },
    ]);

    await expect(
      service.addStudent('family-1', dto, auditContext),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(transaction.family_members.create).not.toHaveBeenCalled();
  });

  it('rejects a student associated with another family without reassigning it', async () => {
    transaction.persons.findUnique.mockResolvedValue({
      id: 'person-1', is_active: true, first_name: 'Carlos',
      last_name_father: 'Pérez', last_name_mother: 'Gómez',
      birth_date: new Date('2015-01-15T00:00:00.000Z'),
    });
    transaction.students.findUnique.mockResolvedValue({ id: 'student-1', is_active: true });
    transaction.family_members.findMany.mockResolvedValue([{ family_group_id: 'other-family' }]);

    await expect(service.addStudent('family-1', dto, auditContext))
      .rejects.toBeInstanceOf(ConflictException);

    expect(transaction.family_members.create).not.toHaveBeenCalled();
    expect(transaction.family_groups.update).not.toHaveBeenCalled();
  });

  it('rejects an inactive existing student without reactivating it', async () => {
    transaction.persons.findUnique.mockResolvedValue({
      id: 'person-1', is_active: true, first_name: 'Carlos',
      last_name_father: 'Pérez', last_name_mother: 'Gómez',
      birth_date: new Date('2015-01-15T00:00:00.000Z'),
    });
    transaction.students.findUnique.mockResolvedValue({ id: 'student-1', is_active: false });

    await expect(service.addStudent('family-1', dto, auditContext))
      .rejects.toBeInstanceOf(ConflictException);

    expect(transaction.students.create).not.toHaveBeenCalled();
    expect(transaction.family_members.create).not.toHaveBeenCalled();
  });

  it('rejects incompatible data for an existing document without overwriting it', async () => {
    transaction.persons.findUnique.mockResolvedValue({
      id: 'person-1', is_active: true, first_name: 'Otro',
      last_name_father: 'Pérez', last_name_mother: 'Gómez',
      birth_date: new Date('2015-01-15T00:00:00.000Z'),
    });

    await expect(service.addStudent('family-1', dto, auditContext))
      .rejects.toBeInstanceOf(ConflictException);

    expect(transaction.persons.update).not.toHaveBeenCalled();
    expect(transaction.students.create).not.toHaveBeenCalled();
  });

  it('reactivates an inactive family only after adding the membership', async () => {
    transaction.family_groups.findUnique.mockResolvedValue({
      id: 'family-1',
      is_active: false,
    });
    transaction.persons.findUnique.mockResolvedValue(null);
    transaction.persons.create.mockResolvedValue({
      id: 'person-1',
      is_active: true,
    });
    transaction.students.findUnique.mockResolvedValue(null);
    transaction.students.create.mockResolvedValue({
      id: 'student-1',
      is_active: true,
    });

    await service.addStudent('family-1', dto, auditContext);

    expect(transaction.family_groups.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ is_active: true }),
      }),
    );
  });
});
