import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { FAMILY_HEADERS, type ImportFile } from '../imports/import-file.js';
import { FamilyGroupsImportService } from './family-groups-import.service.js';
import type { FamilyGroupsService } from './family-groups.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

const defaults: Record<string, string> = {
  familia_referencia: 'FAM-IMP-1',
  estudiante_tipo_documento: 'DNI',
  estudiante_numero_documento: '80000001',
  estudiante_nombres: 'Ana',
  estudiante_apellido_paterno: 'Pérez',
  estudiante_apellido_materno: 'Soto',
  estudiante_fecha_nacimiento: '2018-01-01',
  padre_tipo_documento: 'DNI',
  padre_numero_documento: '70000001',
  padre_nombres: 'Carlos',
  padre_apellido_paterno: 'Pérez',
  padre_apellido_materno: 'Rojas',
  padre_fecha_nacimiento: '1990-01-01',
  padre_telefono: '999999999',
  padre_correo: 'carlos@example.test',
  madre_tipo_documento: 'DNI',
  madre_numero_documento: '70000002',
  madre_nombres: 'Rosa',
  madre_apellido_paterno: 'Soto',
  madre_apellido_materno: 'Luna',
  madre_fecha_nacimiento: '1991-01-01',
  madre_telefono: '988888888',
  madre_correo: 'rosa@example.test',
  apoderado_tipo_documento: 'DNI',
  apoderado_numero_documento: '70000001',
  apoderado_nombres: 'Carlos',
  apoderado_apellido_paterno: 'Pérez',
  apoderado_apellido_materno: 'Rojas',
  apoderado_fecha_nacimiento: '1990-01-01',
  apoderado_telefono: '999999999',
  apoderado_correo: 'carlos@example.test',
  apoderado_relacion: 'PADRE',
};
const encode = (row: Record<string, string>) => FAMILY_HEADERS.map((header) => `"${(row[header] ?? '').replace(/"/g, '""')}"`).join(',');
function upload(...rows: Record<string, string>[]): ImportFile {
  const buffer = Buffer.from([FAMILY_HEADERS.join(','), ...rows.map(encode)].join('\n'), 'utf8');
  return { originalname: 'familias.csv', mimetype: 'text/csv', size: buffer.length, buffer };
}
const make = (changes: Record<string, string> = {}) => ({ ...defaults, ...changes });
const context = { userId: '11111111-1111-4111-8111-111111111111', ipAddress: null, deviceName: null };

describe('FamilyGroupsImportService', () => {
  let prisma: any;
  let families: any;
  let service: FamilyGroupsImportService;
  beforeEach(() => {
    prisma = {
      school_periods: { findFirst: vi.fn().mockResolvedValue({ id: '22222222-2222-4222-8222-222222222222' }) },
      persons: { findMany: vi.fn().mockResolvedValue([]) },
      family_members: { findMany: vi.fn().mockResolvedValue([]) },
      audit_logs: { create: vi.fn() },
    };
    families = { createForImport: vi.fn().mockResolvedValue({ code: 'FAM-2026-000001' }) };
    service = new FamilyGroupsImportService(prisma as PrismaService, families as FamilyGroupsService);
  });

  it('previews one family without persisting and confirms through the shared family service', async () => {
    const file = upload(make());
    const preview = await service.preview(file);
    expect(preview.rows[0]).toEqual(expect.objectContaining({ estado: 'VALIDO', estudiantes: 1 }));
    expect(families.createForImport).not.toHaveBeenCalled();
    expect(prisma.audit_logs.create).not.toHaveBeenCalled();
    const result = await service.confirm(file, context);
    expect(result.summary.created).toBe(1);
    expect(families.createForImport).toHaveBeenCalledWith(expect.objectContaining({
      students: [expect.objectContaining({ documentNumber: '80000001' })],
      adults: expect.arrayContaining([expect.objectContaining({
        documentNumber: '70000001', relationshipType: 'PADRE', isGuardian: true,
      })]),
    }), context);
    expect(families.createForImport.mock.calls[0][0].students[0]).not.toHaveProperty('classroomId');
    expect(prisma.audit_logs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'IMPORT_FAMILIES' }),
    });
  });

  it('groups siblings into one family and supports mother or third-party guardian', async () => {
    const siblings = upload(
      make(), make({ estudiante_numero_documento: '80000002', estudiante_nombres: 'Luis' }),
    );
    const grouped = await service.preview(siblings);
    expect(grouped.rows).toHaveLength(1);
    expect(grouped.rows[0].estudiantes).toBe(2);
    await service.confirm(siblings, context);
    expect(families.createForImport).toHaveBeenCalledTimes(1);
    expect(families.createForImport.mock.calls[0][0].students).toHaveLength(2);

    const motherGuardian = make({
      apoderado_numero_documento: '70000002', apoderado_nombres: 'Rosa',
      apoderado_apellido_paterno: 'Soto', apoderado_apellido_materno: 'Luna',
      apoderado_fecha_nacimiento: '1991-01-01', apoderado_telefono: '988888888',
      apoderado_correo: 'rosa@example.test', apoderado_relacion: 'MADRE',
    });
    const mother = await service.preview(upload(motherGuardian));
    expect(mother.rows[0].estado).toBe('VALIDO');
    await service.confirm(upload(motherGuardian), context);
    expect(families.createForImport.mock.calls[1][0].adults.filter((adult: { isGuardian: boolean }) => adult.isGuardian)).toHaveLength(1);

    const third = make({
      apoderado_numero_documento: '70000003', apoderado_nombres: 'Elena',
      apoderado_apellido_paterno: 'García', apoderado_apellido_materno: 'Díaz',
      apoderado_fecha_nacimiento: '1980-01-01', apoderado_telefono: '',
      apoderado_correo: '', apoderado_relacion: 'ABUELA',
    });
    await service.confirm(upload(third), context);
    expect(families.createForImport.mock.calls[2][0].adults).toHaveLength(3);
  });

  it('rejects underage guardian, future birth, inconsistent family and student in two groups', async () => {
    const underage = make({ apoderado_fecha_nacimiento: '2015-01-01' });
    expect((await service.preview(upload(underage))).rows[0].detalle).toMatch(/18 años/);
    expect((await service.preview(upload(make({ estudiante_fecha_nacimiento: '2999-01-01' })))).rows[0].detalle).toMatch(/futura/);
    const inconsistent = await service.preview(upload(make(), make({
      estudiante_numero_documento: '80000002',
      apoderado_numero_documento: '70000009',
    })));
    expect(inconsistent.rows[0].estado).toBe('ERROR');
    const across = await service.preview(upload(make(), make({ familia_referencia: 'FAM-IMP-2' })));
    expect(across.rows.map((item) => item.estado)).toEqual(['ERROR', 'ERROR']);
    expect(families.createForImport).not.toHaveBeenCalled();
  });

  it('warns when a compatible person will be reused and rejects active foreign family membership', async () => {
    prisma.persons.findMany.mockResolvedValue([{
      id: 'person-1', document_type: 'DNI', document_number: '80000001',
      first_name: 'Ana', last_name_father: 'Pérez', last_name_mother: 'Soto',
      birth_date: new Date('2018-01-01T00:00:00Z'), is_active: true, students: null,
    }]);
    expect((await service.preview(upload(make()))).rows[0].estado).toBe('ADVERTENCIA');
    prisma.family_members.findMany.mockResolvedValue([{
      person_id: 'person-1', relationship_type: 'ESTUDIANTE',
      family_groups: { id: 'family-1', code: 'FAM-2026-000001', is_active: true },
    }]);
    expect((await service.preview(upload(make()))).rows[0].detalle).toMatch(/FAM-2026-000001.*Registro Familiar/);
  });

  it('imports valid families despite another invalid group and revalidates on confirm', async () => {
    const file = upload(make(), make({
      familia_referencia: 'FAM-IMP-2', estudiante_numero_documento: '80000002',
      apoderado_fecha_nacimiento: '2015-01-01',
    }));
    const result = await service.confirm(file, context);
    expect(result.summary).toEqual(expect.objectContaining({ processed: 2, created: 1, rejected: 1 }));
    expect(families.createForImport).toHaveBeenCalledTimes(1);
    prisma.school_periods.findFirst.mockResolvedValueOnce(null);
    await expect(service.confirm(upload(make()), context)).rejects.toThrow(/período escolar abierto/);
    expect(families.createForImport).toHaveBeenCalledTimes(1);
  });

  it('rejects active or inactive existing families and adult convergence during preview', async () => {
    prisma.persons.findMany.mockResolvedValue([
      { id: 'adult-1', document_type: 'DNI', document_number: '70000001', first_name: 'Carlos', last_name_father: 'Pérez', last_name_mother: 'Rojas', birth_date: new Date('1990-01-01T00:00:00Z'), is_active: true, students: null },
    ]);
    prisma.family_members.findMany.mockResolvedValue([{
      person_id: 'adult-1', relationship_type: 'PADRE',
      family_groups: { id: 'family-1', code: 'FAM-2025-000001', is_active: false },
    }]);
    const result = await service.preview(upload(make()));
    expect(result.rows[0]).toMatchObject({ estado: 'ERROR' });
    expect(result.rows[0].detalle).toMatch(/ya se encuentra registrada.*FAM-2025-000001.*Editar/);
  });

  it('allows reuse of an existing adult when it does not select an existing family', async () => {
    prisma.persons.findMany.mockResolvedValue([
      { id: 'adult-1', document_type: 'DNI', document_number: '70000001', first_name: 'Carlos', last_name_father: 'Pérez', last_name_mother: 'Rojas', birth_date: new Date('1990-01-01T00:00:00Z'), is_active: true, students: null },
    ]);
    const result = await service.preview(upload(make()));
    expect(result.rows[0]).toMatchObject({ estado: 'ADVERTENCIA' });
    expect(result.rows[0].detalle).toMatch(/Se reutilizará la persona/);
  });

  it('revalidates at confirmation and rejects a family created after preview', async () => {
    const file = upload(make());
    await expect(service.preview(file)).resolves.toMatchObject({ rows: [{ estado: 'VALIDO' }] });
    families.createForImport.mockRejectedValueOnce(new ConflictException(
      'Esta familia ya se encuentra registrada en el Sistema de Control de Pagos. Para modificar sus datos utilice Registro Familiar → Editar.',
    ));
    const result = await service.confirm(file, context);
    expect(result.rows[0]).toMatchObject({ estado: 'ERROR' });
    expect(result.rows[0].detalle).toMatch(/Registro Familiar/);
    expect(result.summary.created).toBe(0);
  });
});
