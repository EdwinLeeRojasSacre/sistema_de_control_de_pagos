import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { vi } from 'vitest';
import * as bcrypt from 'bcrypt';
import ExcelJS from 'exceljs';
import { readFileSync } from 'node:fs';
import { FAMILY_HEADERS, ENROLLMENT_HEADERS, parseImportFile } from '../src/imports/import-file.js';
import { FamilyGroupsImportService } from '../src/family-groups/family-groups-import.service.js';
import { EnrollmentsImportService } from '../src/enrollments/enrollments-import.service.js';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { getJwtSecret } from './../src/auth/jwt.config.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const jwtService = new JwtService({
    secret: getJwtSecret(),
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  async function authenticateAs(
    role: 'ADMINISTRADOR' | 'SECRETARIA' | 'DIRECCION',
  ) {
    const id = '11111111-1111-4111-8111-111111111111';
    vi.spyOn(prisma.users, 'findUnique').mockResolvedValue({
      id,
      username: role.toLowerCase(),
      is_active: true,
      persons: { is_active: true },
      roles: { code: role, is_active: true },
    } as never);
    return jwtService.signAsync({
      sub: id,
      username: role.toLowerCase(),
      role: 'DIRECCION',
    });
  }

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('/users (GET) rejects a request without JWT', () => {
    return request(app.getHttpServer()).get('/users').expect(401);
  });

  it('/users (GET) rejects an invalid JWT', () => {
    return request(app.getHttpServer())
      .get('/users')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
  });

  it.each(['ADMINISTRADOR', 'SECRETARIA', 'DIRECCION'] as const)(
    '/auth/login authenticates %s by username and by unique normalized email',
    async (role) => {
      const username = role.toLowerCase();
      const email = `${username}@colegio.test`;
      const password = 'Password2026*';
      const user = {
        id: `11111111-1111-4111-8111-${role === 'ADMINISTRADOR' ? '111111111111' : role === 'SECRETARIA' ? '222222222222' : '333333333333'}`,
        username,
        password_hash: await bcrypt.hash(password, 4),
        is_active: true,
        must_change_password: false,
        persons: {
          first_name: role,
          last_name_father: 'Prueba',
          is_active: true,
          email,
        },
        roles: { code: role, is_active: true },
      };

      vi.spyOn(prisma.users, 'findUnique').mockImplementation(async (args: never) => {
        const query = args as { where?: { username?: string } };
        return (query.where?.username === username ? user : null) as never;
      });
      vi.spyOn(prisma.users, 'findMany').mockResolvedValue([user] as never);
      vi.spyOn(prisma.users, 'update').mockResolvedValue(user as never);

      for (const identifier of [username, `  ${email.toUpperCase()}  `]) {
        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send({ username: identifier, password })
          .expect(201);
        expect(response.body).toMatchObject({
          access_token: expect.any(String),
          user: { username, role },
        });
      }
    },
  );

  it('/support/public (GET) is public and exposes only the reduced support contract', async () => {
    vi.spyOn(prisma.users, 'findMany').mockResolvedValue([{
      persons: {
        first_name: 'Administrador', last_name_father: 'Sistema', last_name_mother: null,
        email: 'admin@example.test', phone: '999999999',
      },
    }] as never);
    const response = await request(app.getHttpServer()).get('/support/public').expect(200);
    expect(Object.keys(response.body).sort()).toEqual([
      'administratorEmail', 'administratorName', 'administratorPhone', 'institution', 'version',
    ]);
    expect(response.body).toMatchObject({
      administratorName: 'Administrador Sistema', administratorEmail: 'admin@example.test',
      administratorPhone: '999999999', version: expect.stringMatching(/^Sistema de Control de Pagos v/),
    });
  });

  it('/users/me (GET) resolves the profile from the JWT subject', async () => {
    const id = '11111111-1111-4111-8111-111111111111';
    vi.spyOn(prisma.users, 'findUnique')
      .mockResolvedValueOnce({
        id, username: 'admin', is_active: true, must_change_password: false,
        persons: { is_active: true }, roles: { code: 'ADMINISTRADOR', is_active: true },
      } as never)
      .mockResolvedValueOnce({
        id, person_id: '22222222-2222-4222-8222-222222222222', username: 'admin',
        is_active: true, must_change_password: false, password_changed_at: null,
        last_login: null, created_at: new Date(), updated_at: new Date(),
        persons: {
          id: '22222222-2222-4222-8222-222222222222', first_name: 'Administrador',
          last_name_father: 'Sistema', last_name_mother: null, document_type: 'DNI',
          document_number: '12345678', birth_date: null, gender: null, phone: '999',
          email: 'admin@example.test', address: null, is_active: true,
        },
        roles: { code: 'ADMINISTRADOR', name: 'Administrador' },
      } as never);
    const token = await jwtService.signAsync({ sub: id, username: 'admin', role: 'ADMINISTRADOR' });
    const response = await request(app.getHttpServer()).get('/users/me')
      .set('Authorization', `Bearer ${token}`).expect(200);
    expect(response.body).toMatchObject({ username: 'admin', person: { phone: '999' } });
    expect(response.body).not.toHaveProperty('id');
    expect(response.body.person).not.toHaveProperty('id');
  });

  it('/users (GET) allows SECRETARIA within its restricted scope', async () => {
    vi.spyOn(prisma.users, 'findUnique').mockResolvedValue({
      id: '22222222-2222-4222-8222-222222222222',
      username: 'secretaria',
      is_active: true,
      persons: { is_active: true },
      roles: { code: 'SECRETARIA', is_active: true },
    } as never);
    const token = await jwtService.signAsync({
      sub: '22222222-2222-4222-8222-222222222222',
      username: 'secretaria',
      role: 'ADMINISTRADOR',
    });
    vi.spyOn(prisma.users, 'findMany').mockResolvedValue([]);

    return request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect([]);
  });

  it('/users (GET) allows an active administrator and returns no password hash', async () => {
    vi.spyOn(prisma.users, 'findUnique').mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      username: 'admin',
      is_active: true,
      persons: { is_active: true },
      roles: { code: 'ADMINISTRADOR', is_active: true },
    } as never);
    vi.spyOn(prisma.users, 'findMany').mockResolvedValue([
      {
        id: '11111111-1111-4111-8111-111111111111',
        username: 'admin',
        is_active: true,
        persons: {
          first_name: 'Administrador',
          last_name_father: 'Sistema',
          email: 'admin@sgpe.local',
        },
        roles: { code: 'ADMINISTRADOR', name: 'Administrador' },
      },
    ] as never);
    const token = await jwtService.signAsync({
      sub: '11111111-1111-4111-8111-111111111111',
      username: 'admin',
      role: 'DIRECCION',
    });

    const response = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0]).not.toHaveProperty('password_hash');
  });

  it('/users/:id (PATCH) updates the linked document without changing user/person identity', async () => {
    const actorId = '11111111-1111-4111-8111-111111111111';
    const userId = '22222222-2222-4222-8222-222222222222';
    const personId = '33333333-3333-4333-8333-333333333333';
    const target = {
      id: userId,
      person_id: personId,
      username: 'direccion',
      is_active: true,
      must_change_password: false,
      password_changed_at: null,
      last_login: null,
      created_at: new Date(),
      updated_at: new Date(),
      persons: {
        id: personId,
        document_type: 'DNI',
        document_number: '12345678',
        first_name: 'Directora',
        last_name_father: 'Prueba',
        last_name_mother: null,
        birth_date: null,
        gender: null,
        phone: null,
        email: 'direccion@colegio.test',
        address: null,
        is_active: true,
      },
      roles: { code: 'DIRECCION', name: 'Dirección' },
    };
    const updated = {
      ...target,
      persons: { ...target.persons, document_type: 'CE', document_number: 'CE-90001' },
    };
    vi.spyOn(prisma.users, 'findUnique')
      .mockResolvedValueOnce({
        id: actorId,
        username: 'admin',
        is_active: true,
        persons: { is_active: true },
        roles: { code: 'ADMINISTRADOR', is_active: true },
      } as never)
      .mockResolvedValueOnce(target as never)
      .mockResolvedValueOnce(updated as never);
    vi.spyOn(prisma, '$transaction').mockImplementation(((callback: (client: PrismaService) => Promise<unknown>) => callback(prisma)) as never);
    vi.spyOn(prisma.persons, 'update').mockResolvedValue(updated.persons as never);
    vi.spyOn(prisma.audit_logs, 'create').mockResolvedValue({} as never);
    const token = await jwtService.signAsync({ sub: actorId, username: 'admin', role: 'ADMINISTRADOR' });

    const response = await request(app.getHttpServer())
      .patch(`/users/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ person: { documentType: 'CE', documentNumber: 'CE-90001' } })
      .expect(200);

    expect(response.body).toMatchObject({
      id: userId,
      personId,
      person: { id: personId, documentType: 'CE', documentNumber: 'CE-90001' },
    });
  });

  it.each(['SECRETARIA', 'DIRECCION'] as const)(
    '/users (POST) rejects a second active %s without creating partial data',
    async (role) => {
      const actorId = '11111111-1111-4111-8111-111111111111';
      vi.spyOn(prisma.users, 'findUnique').mockResolvedValue({
        id: actorId,
        username: 'admin',
        is_active: true,
        persons: { is_active: true },
        roles: { code: 'ADMINISTRADOR', is_active: true },
      } as never);
      vi.spyOn(prisma.roles, 'findUnique').mockResolvedValue({
        id: '44444444-4444-4444-8444-444444444444',
        code: role,
        is_active: true,
      } as never);
      vi.spyOn(prisma.users, 'findFirst').mockResolvedValue({ username: `${role.toLowerCase()}-actual` } as never);
      const createPerson = vi.spyOn(prisma.persons, 'create');
      const createUser = vi.spyOn(prisma.users, 'create');
      vi.spyOn(prisma, '$transaction').mockImplementation(((callback: (client: PrismaService) => Promise<unknown>) => callback(prisma)) as never);
      const token = await jwtService.signAsync({ sub: actorId, username: 'admin', role: 'ADMINISTRADOR' });

      const response = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          username: `${role.toLowerCase()}-nueva`,
          role,
          isActive: true,
          personId: '55555555-5555-4555-8555-555555555555',
        })
        .expect(409);

      expect(response.body.message).toContain(`Ya existe una cuenta ${role} activa`);
      expect(createPerson).not.toHaveBeenCalled();
      expect(createUser).not.toHaveBeenCalled();
    },
  );

  it('/school-periods (GET) rejects a request without JWT', () => {
    return request(app.getHttpServer()).get('/school-periods').expect(401);
  });

  it('/school-periods (GET) allows DIRECCION read-only access', async () => {
    const token = await authenticateAs('DIRECCION');
    vi.spyOn(prisma.school_periods, 'findMany').mockResolvedValue([]);

    return request(app.getHttpServer())
      .get('/school-periods')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('/school-periods (GET) allows an active administrator', async () => {
    vi.spyOn(prisma.users, 'findUnique').mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      username: 'admin',
      is_active: true,
      persons: { is_active: true },
      roles: { code: 'ADMINISTRADOR', is_active: true },
    } as never);
    vi.spyOn(prisma.school_periods, 'findMany').mockResolvedValue([]);
    const token = await jwtService.signAsync({
      sub: '11111111-1111-4111-8111-111111111111',
      username: 'admin',
      role: 'DIRECCION',
    });

    return request(app.getHttpServer())
      .get('/school-periods')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect({ data: [], currentOpenPeriod: null, warning: null });
  });

  it('/school-periods (GET) allows SECRETARIA', async () => {
    const token = await authenticateAs('SECRETARIA');
    vi.spyOn(prisma.school_periods, 'findMany').mockResolvedValue([]);
    return request(app.getHttpServer())
      .get('/school-periods')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('/school-periods/:id/open rejects a period beyond the following backend year', async () => {
    const token = await authenticateAs('SECRETARIA');
    vi.spyOn(prisma, '$transaction').mockImplementation(((
      callback: (client: PrismaService) => Promise<unknown>,
    ) => callback(prisma)) as never);
    vi.spyOn(prisma.school_periods, 'findUnique').mockResolvedValue({
      id: '22222222-2222-4222-8222-222222222222',
      year: new Date().getFullYear() + 2,
      start_date: new Date(
        `${new Date().getFullYear() + 2}-03-01T00:00:00.000Z`,
      ),
      end_date: new Date(`${new Date().getFullYear() + 2}-12-15T00:00:00.000Z`),
      status: 'PLANNED',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return request(app.getHttpServer())
      .patch('/school-periods/22222222-2222-4222-8222-222222222222/open')
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
  });

  it.each(['ADMINISTRADOR', 'SECRETARIA'] as const)(
    '/auth/profile (GET) allows %s to read its own profile',
    async (role) => {
      const token = await authenticateAs(role);
      const response = await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(response.body.role).toBe(role);
    },
  );

  it('/enrollments (GET) rejects DIRECCION', async () => {
    const token = await authenticateAs('DIRECCION');
    return request(app.getHttpServer())
      .get('/enrollments')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('/auth/profile (GET) rejects requests without JWT', () => {
    return request(app.getHttpServer()).get('/auth/profile').expect(401);
  });

  it('/academic-structure/options (GET) rejects requests without JWT', () => {
    return request(app.getHttpServer())
      .get('/academic-structure/options')
      .expect(401);
  });

  it('/academic-structure/options (GET) rejects DIRECCION', async () => {
    const token = await authenticateAs('DIRECCION');
    return request(app.getHttpServer())
      .get('/academic-structure/options')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it.each(['ADMINISTRADOR', 'SECRETARIA'] as const)(
    '/academic-structure/options (GET) allows %s',
    async (role) => {
      const token = await authenticateAs(role);
      vi.spyOn(prisma.school_periods, 'findMany').mockResolvedValue([]);
      vi.spyOn(prisma.education_levels, 'findMany').mockResolvedValue([]);
      vi.spyOn(prisma.shifts, 'findMany').mockResolvedValue([]);
      await request(app.getHttpServer())
        .get('/academic-structure/options')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect({ periods: [], levels: [], shifts: [] });
    },
  );

  it('/enrollments (GET) rejects requests without JWT', () => {
    return request(app.getHttpServer()).get('/enrollments').expect(401);
  });

  it.each(['ADMINISTRADOR', 'SECRETARIA'] as const)(
    '/enrollments (GET) allows %s',
    async (role) => {
      const token = await authenticateAs(role);
      vi.spyOn(prisma.enrollments, 'findMany').mockResolvedValue([]);
      return request(app.getHttpServer())
        .get('/enrollments')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect([]);
    },
  );

  it('/enrollments (POST) rejects DIRECCION', async () => {
    const token = await authenticateAs('DIRECCION');
    return request(app.getHttpServer())
      .post('/enrollments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        studentId: '22222222-2222-4222-8222-222222222222',
        schoolPeriodId: '33333333-3333-4333-8333-333333333333',
        classroomId: '44444444-4444-4444-8444-444444444444',
      })
      .expect(403);
  });

  it.each(['preview', 'confirm'] as const)('/enrollments/import/%s rejects DIRECCION', async (action) => {
    const token = await authenticateAs('DIRECCION');
    await request(app.getHttpServer())
      .post(`/enrollments/import/${action}`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('periodo,estudiante_tipo_documento'), 'matriculas.csv')
      .expect(403);
  });

  it.each(['ADMINISTRADOR', 'SECRETARIA'] as const)('/enrollments/import allows %s to reach validation', async (role) => {
    const token = await authenticateAs(role);
    for (const action of ['preview', 'confirm']) {
      await request(app.getHttpServer())
        .post(`/enrollments/import/${action}`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from('periodo,aula\n2026,Ositos'), 'matriculas.csv')
        .expect(400);
    }
  });

  it.each(['preview', 'confirm'] as const)('/family-groups/import/%s rejects DIRECCION', async (action) => {
    const token = await authenticateAs('DIRECCION');
    await request(app.getHttpServer())
      .post(`/family-groups/import/${action}`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('familia_referencia'), 'familias.csv')
      .expect(403);
  });

  it.each(['ADMINISTRADOR', 'SECRETARIA'] as const)('/family-groups/import allows %s to reach validation', async (role) => {
    const token = await authenticateAs(role);
    for (const action of ['preview', 'confirm']) {
      await request(app.getHttpServer())
        .post(`/family-groups/import/${action}`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from('familia_referencia\nFAM-1'), 'familias.csv')
        .expect(400);
    }
  });

  it.each([
    ['family-groups', 'FAMILIAS', FAMILY_HEADERS, ['FAM-01', 'DNI', '12345678', 'Ana'], FamilyGroupsImportService],
    ['enrollments', 'MATRICULAS', ENROLLMENT_HEADERS, ['2026', 'DNI', '12345678', 'Ana'], EnrollmentsImportService],
  ] as const)('%s accepts a real XLSX multipart upload for preview and confirm', async (
    route, sheetName, headers, firstCells, serviceType,
  ) => {
    const token = await authenticateAs('ADMINISTRADOR');
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('INSTRUCCIONES').addRow(['Instructions, not data']);
    const sheet = workbook.addWorksheet(sheetName);
    sheet.addRow([...headers]);
    sheet.addRow([...firstCells]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const service = app.get(serviceType);
    const received: number[] = [];
    const handle = async (file: { originalname: string; mimetype: string; size: number; buffer: Buffer }) => {
      received.push(file.buffer.length);
      const rows = await parseImportFile(file, headers);
      return { rows, summary: { processed: rows.length, valid: rows.length, created: 0, rejected: 0 } };
    };
    vi.spyOn(service, 'preview').mockImplementation(handle as never);
    vi.spyOn(service, 'confirm').mockImplementation(handle as never);

    for (const action of ['preview', 'confirm']) {
      const response = await request(app.getHttpServer())
        .post(`/${route}/import/${action}`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', buffer, { filename: `SGPE_Plantilla_${sheetName}_01_Valida.xlsx`, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        .expect(200);
      expect(response.body.summary.processed).toBe(1);
      expect(response.body.rows[0].values[headers[0]]).toBe(firstCells[0]);
    }
    expect(received).toEqual([buffer.length, buffer.length]);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('rejects an actually empty import file', async () => {
    const token = await authenticateAs('ADMINISTRADOR');
    await request(app.getHttpServer())
      .post('/family-groups/import/preview')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.alloc(0), 'empty.xlsx')
      .expect(400);
  });

  it('accepts valid CSV multipart upload', async () => {
    const token = await authenticateAs('ADMINISTRADOR');
    const service = app.get(EnrollmentsImportService);
    vi.spyOn(service, 'preview').mockImplementation(async (file) => {
      const rows = await parseImportFile(file, ENROLLMENT_HEADERS);
      return { rows, summary: { processed: rows.length, valid: rows.length, created: 0, rejected: 0 } } as never;
    });
    const csv = Buffer.from(`${ENROLLMENT_HEADERS.join(',')}\n2026,DNI,12345678,Ana,Ciclo II,Ositos,Mañana\n`);
    const response = await request(app.getHttpServer())
      .post('/enrollments/import/preview')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', csv, { filename: 'matriculas.csv', contentType: 'text/csv' })
      .expect(200);
    expect(response.body.summary.processed).toBe(1);
  });

  it.each([
    ['family-groups', 'familias-valida.xlsx', FAMILY_HEADERS, FamilyGroupsImportService],
    ['enrollments', 'matriculas-valida.xlsx', ENROLLMENT_HEADERS, EnrollmentsImportService],
  ] as const)('%s reparses the exact binary fixture on preview and confirm', async (route, name, headers, serviceType) => {
    const token = await authenticateAs('ADMINISTRADOR');
    const buffer = readFileSync(new URL(`./fixtures/imports/${name}`, import.meta.url));
    const service = app.get(serviceType);
    const handle = async (file: { originalname: string; mimetype: string; size: number; buffer: Buffer }) => {
      const rows = await parseImportFile(file, headers);
      return { rows, summary: { processed: rows.length, valid: rows.length, created: 0, rejected: 0 } };
    };
    vi.spyOn(service, 'preview').mockImplementation(handle as never);
    vi.spyOn(service, 'confirm').mockImplementation(handle as never);
    for (const action of ['preview', 'confirm']) {
      const response = await request(app.getHttpServer())
        .post(`/${route}/import/${action}`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', buffer, { filename: name, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        .expect(200);
      expect(response.body.summary.processed).toBe(4);
    }
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await app.close();
  });
});
