import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { EnrollmentsImportService } from './enrollments-import.service.js';
import { ENROLLMENT_HEADERS, type ImportFile } from '../imports/import-file.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { EnrollmentsService } from './enrollments.service.js';

const studentId = '11111111-1111-4111-8111-111111111111';
const periodId = '22222222-2222-4222-8222-222222222222';
const classroomId = '33333333-3333-4333-8333-333333333333';
const header = ENROLLMENT_HEADERS.join(',');
const row = '2026,DNI,12345678,Ana Pérez,Ciclo II / 4 años,Ositos,Mañana';
const context = { userId: '44444444-4444-4444-8444-444444444444', ipAddress: null, deviceName: null };
const file = (content: string): ImportFile => {
  const buffer = Buffer.from(content, 'utf8');
  return { originalname: 'matriculas.csv', mimetype: 'text/csv', size: buffer.length, buffer };
};

describe('EnrollmentsImportService', () => {
  let service: EnrollmentsImportService;
  let prisma: any;
  let enrollments: any;
  beforeEach(() => {
    prisma = {
      school_periods: { findMany: vi.fn().mockResolvedValue([{ id: periodId, year: 2026, is_active: true, status: 'OPEN' }]) },
      persons: { findMany: vi.fn().mockResolvedValue([{
        id: '55555555-5555-4555-8555-555555555555',
        document_type: 'DNI', document_number: '12345678',
        first_name: 'Ana', last_name_father: 'Pérez', is_active: true,
        students: { id: studentId, is_active: true, enrollments: [], student_code: 'EST-1' },
      }]) },
      family_members: { findMany: vi.fn().mockResolvedValue([{ person_id: '55555555-5555-4555-8555-555555555555' }]) },
      classrooms: { findMany: vi.fn().mockResolvedValue([{
        id: classroomId, school_period_id: periodId, name: 'Ositos', is_active: true,
        shifts: { name: 'Mañana' },
        education_levels: { name: '4 años', education_cycles: { name: 'Ciclo II' } },
      }]) },
      audit_logs: { create: vi.fn() },
    };
    enrollments = { create: vi.fn().mockResolvedValue({ id: 'new-enrollment', student: { code: 'EST-1' } }) };
    service = new EnrollmentsImportService(prisma as PrismaService, enrollments as EnrollmentsService);
  });

  it('previews without persisting and confirms through the existing EnrollmentService', async () => {
    const upload = file(`${header}\n${row}`);
    const preview = await service.preview(upload);
    expect(preview.rows[0]).toEqual(expect.objectContaining({ estado: 'VALIDO', studentId, classroomId, periodId }));
    expect(enrollments.create).not.toHaveBeenCalled();
    expect(prisma.audit_logs.create).not.toHaveBeenCalled();
    const result = await service.confirm(upload, context);
    expect(enrollments.create).toHaveBeenCalledWith({
      studentId, classroomId, schoolPeriodId: periodId,
    }, context);
    expect(result.summary.created).toBe(1);
    expect(prisma.audit_logs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'IMPORT_ENROLLMENTS' }),
    });
  });

  it('rejects an unknown student or room, wrong shift and a closed period', async () => {
    prisma.persons.findMany.mockResolvedValueOnce([]);
    expect((await service.preview(file(`${header}\n${row}`))).rows[0].detalle).toMatch(/no existe/);
    prisma.classrooms.findMany.mockResolvedValueOnce([]);
    expect((await service.preview(file(`${header}\n${row}`))).rows[0].detalle).toMatch(/aula.*no existe/);
    expect((await service.preview(file(`${header}\n${row.replace('Mañana', 'Tarde')}`))).rows[0].detalle).toMatch(/turno.*no coincide/);
    prisma.school_periods.findMany.mockResolvedValueOnce([{ id: periodId, year: 2026, is_active: true, status: 'CLOSED' }]);
    expect((await service.preview(file(`${header}\n${row}`))).rows[0].detalle).toMatch(/no está abierto/);
  });

  it('detects duplicate rows and existing enrollment', async () => {
    const duplicate = await service.preview(file(`${header}\n${row}\n${row}`));
    expect(duplicate.rows.map((item) => item.estado)).toEqual(['VALIDO', 'ERROR']);
    prisma.persons.findMany.mockResolvedValueOnce([{
      id: '55555555-5555-4555-8555-555555555555',
      document_type: 'DNI', document_number: '12345678', is_active: true,
      students: { id: studentId, is_active: true, enrollments: [{ school_period_id: periodId }] },
    }]);
    expect((await service.preview(file(`${header}\n${row}`))).rows[0].detalle).toBe(
      'El estudiante ya cuenta con matrícula para el período 2026. Para modificarla utilice el módulo Matrículas.',
    );
  });

  it('imports valid rows even when another row is invalid and revalidates on confirm', async () => {
    const upload = file(`${header}\n${row}\n2026,DNI,99999999,Desconocido,Ciclo II / 4 años,Ositos,Mañana`);
    const result = await service.confirm(upload, context);
    expect(result.summary).toEqual({ processed: 2, valid: 1, created: 1, rejected: 1 });
    expect(enrollments.create).toHaveBeenCalledTimes(1);
    prisma.school_periods.findMany.mockResolvedValueOnce([{ id: periodId, year: 2026, is_active: true, status: 'CLOSED' }]);
    const second = await service.confirm(file(`${header}\n${row}`), context);
    expect(second.summary.created).toBe(0);
    expect(enrollments.create).toHaveBeenCalledTimes(1);
  });

  it('rejects confirmation when enrollment is created after a valid preview', async () => {
    const upload = file(`${header}\n${row}`);
    await expect(service.preview(upload)).resolves.toMatchObject({ rows: [{ estado: 'VALIDO' }] });
    enrollments.create.mockRejectedValueOnce(new ConflictException(
      'El estudiante ya está matriculado en este período',
    ));
    const result = await service.confirm(upload, context);
    expect(result.rows[0]).toMatchObject({ estado: 'ERROR', detalle: 'El estudiante ya está matriculado en este período' });
    expect(result.summary.created).toBe(0);
  });
});
