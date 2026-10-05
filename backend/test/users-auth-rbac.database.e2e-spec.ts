import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { assertE2eDatabaseName } from './e2e-database.guard.js';

describe.sequential('Users + Auth + RBAC against isolated E2E database', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const runId = randomUUID().slice(0, 8);
  const prefix = `e2e_${runId}`;
  const password = 'RegressionA1!';
  const testUserIds: string[] = [];
  const testPersonIds: string[] = [];
  let adminToken = '';
  let secretaryToken = '';
  let directionToken = '';
  let adminId = '';
  let adminPersonId = '';
  let secretaryId = '';
  let secretaryPersonId = '';
  let directionId = '';
  let directionPersonId = '';
  let previousDirectionId = '';
  let previousDirectionPersonId = '';
  let roleActivitySnapshot: Array<{
    id: string;
    name: string;
    is_active: boolean;
  }> = [];
  let existingPersonSnapshot: Array<{ id: string; is_active: boolean }> = [];
  let existingUserSnapshot: Array<{
    id: string;
    username: string;
    password_hash: string;
    must_change_password: boolean;
    password_changed_at: Date | null;
    is_active: boolean;
    role_id: string;
    person_id: string;
  }> = [];

  const authorization = (token: string) => ({
    Authorization: `Bearer ${token}`,
  });
  const person = (suffix: string) => ({
    documentType: 'E2E',
    documentNumber: `${runId}-${suffix.slice(0, 11)}`,
    firstName: `Test ${suffix}`,
    lastNameFather: 'Regression',
    lastNameMother: 'SGPE',
    birthDate: '1990-01-01',
    gender: 'F',
    phone: '999999999',
    email: `${prefix}.${suffix}@example.test`,
    address: 'E2E only',
  });

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    const [database] = await prisma.$queryRaw<
      Array<{ current_database: string }>
    >`SELECT current_database()`;
    assertE2eDatabaseName(database?.current_database ?? '');
    roleActivitySnapshot = await prisma.roles.findMany({
      where: { code: { in: ['ADMINISTRADOR', 'SECRETARIA', 'DIRECCION'] } },
      select: { id: true, name: true, is_active: true },
    });
    existingUserSnapshot = await prisma.users.findMany({
      // Otros E2E se ejecutan en paralelo y crean/eliminan sus propias cuentas.
      // No son cuentas preexistentes estables que este test deba comparar.
      where: { username: { not: { startsWith: 'e2e_' } } },
      select: {
        id: true,
        username: true,
        password_hash: true,
        must_change_password: true,
        password_changed_at: true,
        is_active: true,
        role_id: true,
        person_id: true,
      },
    });
    existingPersonSnapshot = await prisma.persons.findMany({
      where: { id: { in: existingUserSnapshot.map((user) => user.person_id) } },
      select: { id: true, is_active: true },
    });

    const activeDirection = await prisma.users.findFirst({
      where: {
        is_active: true,
        must_change_password: false,
        persons: { is_active: true },
        roles: { code: 'DIRECCION', is_active: true },
      },
      select: { id: true, username: true },
    });
    if (!activeDirection)
      throw new Error(
        'La regresión requiere una DIRECCION activa sin cambio de contraseña pendiente',
      );
    directionToken = await app.get(JwtService).signAsync({
      sub: activeDirection.id,
      username: activeDirection.username,
      role: 'DIRECCION',
    });

    const activeSecretary = await prisma.users.findFirst({
      where: {
        is_active: true,
        must_change_password: false,
        persons: { is_active: true },
        roles: { code: 'SECRETARIA', is_active: true },
      },
      select: { id: true, username: true },
    });
    if (!activeSecretary)
      throw new Error(
        'La regresión requiere una SECRETARIA activa sin cambio de contraseña pendiente',
      );
    secretaryToken = await app.get(JwtService).signAsync({
      sub: activeSecretary.id,
      username: activeSecretary.username,
      role: 'SECRETARIA',
    });

    const adminRole = await prisma.roles.findUniqueOrThrow({
      where: { code: 'ADMINISTRADOR' },
    });
    const adminPerson = await prisma.persons.create({
      data: {
        document_type: 'E2E',
        document_number: `${runId}-admin`,
        first_name: 'Admin E2E',
      },
    });
    adminPersonId = adminPerson.id;
    testPersonIds.push(adminPerson.id);
    const admin = await prisma.users.create({
      data: {
        person_id: adminPerson.id,
        role_id: adminRole.id,
        username: `${prefix}_admin`,
        password_hash: await bcrypt.hash(password, 10),
        must_change_password: false,
      },
    });
    adminId = admin.id;
    testUserIds.push(admin.id);
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: admin.username, password })
      .expect(201);
    adminToken = login.body.access_token as string;
  });

  afterAll(async () => {
    if (!prisma) {
      await app?.close();
      return;
    }
    try {
      await prisma.persons.updateMany({
        where: { id: { in: testPersonIds } },
        data: { is_active: true },
      });
      await prisma.users.updateMany({
        where: { id: { in: testUserIds } },
        data: { is_active: true },
      });
      await prisma.audit_logs.deleteMany({
        where: {
          OR: [
            { user_id: { in: testUserIds } },
            { entity_id: { in: testUserIds } },
          ],
        },
      });
      await prisma.users.deleteMany({ where: { id: { in: testUserIds } } });
      await prisma.persons.deleteMany({ where: { id: { in: testPersonIds } } });
      const [remainingUsers, remainingPersons] = await Promise.all([
        prisma.users.count({ where: { id: { in: testUserIds } } }),
        prisma.persons.count({ where: { id: { in: testPersonIds } } }),
      ]);
      expect(remainingUsers).toBe(0);
      expect(remainingPersons).toBe(0);
      const existingUsersAfter = await prisma.users.findMany({
        where: { id: { in: existingUserSnapshot.map((user) => user.id) } },
        select: {
          id: true,
          username: true,
          password_hash: true,
          must_change_password: true,
          password_changed_at: true,
          is_active: true,
          role_id: true,
          person_id: true,
        },
      });
      const afterById = new Map(
        existingUsersAfter.map((user) => [user.id, user]),
      );
      const preexistingAccountsUnchanged = existingUserSnapshot.every(
        (before) => {
          const after = afterById.get(before.id);
          return (
            Boolean(after) &&
            after!.username === before.username &&
            after!.password_hash === before.password_hash &&
            after!.must_change_password === before.must_change_password &&
            after!.password_changed_at?.getTime() ===
              before.password_changed_at?.getTime() &&
            after!.is_active === before.is_active &&
            after!.role_id === before.role_id &&
            after!.person_id === before.person_id
          );
        },
      );
      expect(
        preexistingAccountsUnchanged,
        'Los tests no deben modificar cuentas preexistentes',
      ).toBe(true);
      const [personsAfter, rolesAfter] = await Promise.all([
        prisma.persons.findMany({
          where: {
            id: { in: existingPersonSnapshot.map((person) => person.id) },
          },
          select: { id: true, is_active: true },
        }),
        prisma.roles.findMany({
          where: { id: { in: roleActivitySnapshot.map((role) => role.id) } },
          select: { id: true, name: true, is_active: true },
        }),
      ]);
      expect(personsAfter.sort((a, b) => a.id.localeCompare(b.id))).toEqual(
        [...existingPersonSnapshot].sort((a, b) => a.id.localeCompare(b.id)),
      );
      expect(rolesAfter.sort((a, b) => a.id.localeCompare(b.id))).toEqual(
        [...roleActivitySnapshot].sort((a, b) => a.id.localeCompare(b.id)),
      );
    } finally {
      // Restore exact pre-test values even if a test or the integrity assertion fails.
      for (const role of roleActivitySnapshot)
        await prisma.roles.update({
          where: { id: role.id },
          data: { name: role.name, is_active: role.is_active },
        });
      for (const personState of existingPersonSnapshot)
        await prisma.persons.update({
          where: { id: personState.id },
          data: { is_active: personState.is_active },
        });
      for (const user of existingUserSnapshot)
        await prisma.users.update({
          where: { id: user.id },
          data: {
            username: user.username,
            password_hash: user.password_hash,
            must_change_password: user.must_change_password,
            password_changed_at: user.password_changed_at,
            is_active: user.is_active,
            role_id: user.role_id,
            person_id: user.person_id,
          },
        });
      await prisma.persons.updateMany({
        where: { id: { in: testPersonIds } },
        data: { is_active: true },
      });
      await prisma.users.updateMany({
        where: { id: { in: testUserIds } },
        data: { is_active: true },
      });
      await prisma.audit_logs.deleteMany({
        where: {
          OR: [
            { user_id: { in: testUserIds } },
            { entity_id: { in: testUserIds } },
          ],
        },
      });
      await prisma.users.deleteMany({ where: { id: { in: testUserIds } } });
      await prisma.persons.deleteMany({ where: { id: { in: testPersonIds } } });
      await app?.close();
    }
  });

  it('executes ADMIN creation, conflict, edit, status and reset flows', async () => {
    const activeSecretaryBefore = await prisma.users.findFirstOrThrow({
      where: { is_active: true, roles: { code: 'SECRETARIA' } },
      select: {
        id: true,
        person_id: true,
        role_id: true,
        password_hash: true,
        is_active: true,
      },
    });
    const secretaryCreated = await request(app.getHttpServer())
      .post('/users')
      .set(authorization(adminToken))
      .send({
        person: person('secretary'),
        username: `${prefix}_secretary`,
        role: 'SECRETARIA',
        isActive: false,
      });
    expect(secretaryCreated.status, JSON.stringify(secretaryCreated.body)).toBe(
      201,
    );
    secretaryId = secretaryCreated.body.user.id;
    secretaryPersonId = secretaryCreated.body.user.personId;
    testUserIds.push(secretaryId);
    testPersonIds.push(secretaryPersonId);
    expect(secretaryCreated.body.user.mustChangePassword).toBe(true);
    expect(secretaryCreated.body.user.isActive).toBe(false);
    expect(secretaryCreated.body.temporaryPassword).toEqual(expect.any(String));

    const directionCreated = await request(app.getHttpServer())
      .post('/users')
      .set(authorization(adminToken))
      .send({
        person: person('direction-old'),
        username: `${prefix}_direction_old`,
        role: 'DIRECCION',
        isActive: false,
      })
      .expect(201);
    previousDirectionId = directionCreated.body.user.id;
    previousDirectionPersonId = directionCreated.body.user.personId;
    testUserIds.push(previousDirectionId);
    testPersonIds.push(previousDirectionPersonId);

    const existingPerson = await prisma.persons.create({
      data: {
        document_type: 'E2E',
        document_number: `${runId}-existing`,
        first_name: 'Existing Person',
      },
    });
    testPersonIds.push(existingPerson.id);
    const linked = await request(app.getHttpServer())
      .post('/users')
      .set(authorization(adminToken))
      .send({
        personId: existingPerson.id,
        username: `${prefix}_existing`,
        role: 'DIRECCION',
        isActive: false,
      })
      .expect(201);
    testUserIds.push(linked.body.user.id);
    await request(app.getHttpServer())
      .post('/users')
      .set(authorization(adminToken))
      .send({
        personId: existingPerson.id,
        username: `${prefix}_second`,
        role: 'DIRECCION',
      })
      .expect(409);

    await request(app.getHttpServer())
      .patch(`/users/${secretaryId}`)
      .set(authorization(adminToken))
      .send({
        username: `${prefix}_secretary_edit`,
        person: { firstName: 'Secretaria Editada', phone: '988888888' },
      })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/users/${previousDirectionId}`)
      .set(authorization(adminToken))
      .send({ person: { firstName: 'Direccion Editada' } })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/users/${previousDirectionId}`)
      .set(authorization(adminToken))
      .send({ username: `${prefix}_secretary_edit` })
      .expect(409);

    await request(app.getHttpServer())
      .patch(`/users/${secretaryId}/status`)
      .set(authorization(adminToken))
      .send({ isActive: false })
      .expect(200);
    const secretaryPerson = await prisma.persons.findUniqueOrThrow({
      where: { id: secretaryPersonId },
    });
    expect(secretaryPerson.is_active).toBe(true);
    const secretaryActivation = await request(app.getHttpServer())
      .patch(`/users/${secretaryId}/status`)
      .set(authorization(adminToken))
      .send({ isActive: true });
    expect(secretaryActivation.status).toBe(409);
    expect(secretaryActivation.body.message).toMatch(/SECRETARIA activa/);
    await request(app.getHttpServer())
      .post(`/users/${secretaryId}/reset-password`)
      .set(authorization(adminToken))
      .expect(409);
    const activeSecretaryAfter = await prisma.users.findUniqueOrThrow({
      where: { id: activeSecretaryBefore.id },
      select: {
        id: true,
        person_id: true,
        role_id: true,
        password_hash: true,
        is_active: true,
      },
    });
    expect(activeSecretaryAfter).toEqual(activeSecretaryBefore);
    const directionActivation = await request(app.getHttpServer())
      .patch(`/users/${previousDirectionId}/status`)
      .set(authorization(adminToken))
      .send({ isActive: true });
    expect(directionActivation.status).toBe(409);
    expect(directionActivation.body.message).toMatch(/DIRECCION activa/);
  });

  it('executes SECRETARIA allowed flows and rejects privilege escalation', async () => {
    await request(app.getHttpServer())
      .get('/users')
      .set(authorization(secretaryToken))
      .expect(200);

    const created = await request(app.getHttpServer())
      .post('/users')
      .set(authorization(secretaryToken))
      .send({
        person: person('direction-new'),
        username: `${prefix}_direction_new`,
        role: 'DIRECCION',
        isActive: false,
      })
      .expect(201);
    directionId = created.body.user.id;
    directionPersonId = created.body.user.personId;
    testUserIds.push(directionId);
    testPersonIds.push(directionPersonId);
    await request(app.getHttpServer())
      .patch(`/users/${directionId}`)
      .set(authorization(secretaryToken))
      .send({ person: { phone: '977777777' } })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/users/${directionId}/status`)
      .set(authorization(secretaryToken))
      .send({ isActive: true })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/users/${directionId}/reset-password`)
      .set(authorization(secretaryToken))
      .expect(409);

    await request(app.getHttpServer())
      .post('/users')
      .set(authorization(secretaryToken))
      .send({
        person: person('forbidden-secretary'),
        username: `${prefix}_forbidden`,
        role: 'SECRETARIA',
      })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/users/${secretaryId}`)
      .set(authorization(secretaryToken))
      .send({ username: `${prefix}_forbidden` })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/users/${secretaryId}/reset-password`)
      .set(authorization(secretaryToken))
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/users/${adminId}/status`)
      .set(authorization(secretaryToken))
      .send({ isActive: false })
      .expect(403);
  });

  it('supports unique normalized email login and preserves mandatory password change', async () => {
    const adminRole = await prisma.roles.findUniqueOrThrow({
      where: { code: 'ADMINISTRADOR' },
    });
    const authPerson = await prisma.persons.create({
      data: {
        document_type: 'E2E',
        document_number: `${runId}-auth`,
        first_name: 'Auth E2E',
        email: `${prefix}.auth@example.test`,
      },
    });
    testPersonIds.push(authPerson.id);
    const initialPassword = 'AuthInitialA1!';
    const authUser = await prisma.users.create({
      data: {
        person_id: authPerson.id,
        role_id: adminRole.id,
        username: `${prefix}_auth`,
        password_hash: await bcrypt.hash(initialPassword, 10),
        must_change_password: true,
      },
    });
    testUserIds.push(authUser.id);
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        username: `  ${prefix}.auth@EXAMPLE.TEST  `,
        password: initialPassword,
      })
      .expect(201);
    let authToken = login.body.access_token;
    expect(login.body.user.mustChangePassword).toBe(true);
    const period = await prisma.school_periods.findFirst({
      select: { id: true },
    });
    await request(app.getHttpServer())
      .post('/auth/change-password')
      .set(authorization(authToken))
      .send({ currentPassword: initialPassword, newPassword: 'AuthChangedA1!' })
      .expect(201);
    const changedLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        username: `${prefix}.auth@example.test`,
        password: 'AuthChangedA1!',
      })
      .expect(201);
    authToken = changedLogin.body.access_token;
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        username: `${prefix}.auth@example.test`,
        password: initialPassword,
      })
      .expect(401);
    const persisted = await prisma.users.findUniqueOrThrow({
      where: { id: authUser.id },
    });
    expect(persisted.must_change_password).toBe(false);
    expect(persisted.password_changed_at).toBeInstanceOf(Date);
    if (period) {
      await request(app.getHttpServer())
        .get('/school-periods')
        .set(authorization(directionToken))
        .expect(200);
      await request(app.getHttpServer())
        .get('/academic-structure')
        .query({ schoolPeriodId: period.id })
        .set(authorization(directionToken))
        .expect(200);
      await request(app.getHttpServer())
        .get('/reports/summary')
        .query({ schoolPeriodId: period.id })
        .set(authorization(directionToken))
        .expect(200);
      for (const token of [adminToken, secretaryToken]) {
        await request(app.getHttpServer())
          .get('/reports/payments')
          .query({ schoolPeriodId: period.id })
          .set(authorization(token))
          .expect(200);
        await request(app.getHttpServer())
          .get('/reports/payments/export/xlsx')
          .query({ schoolPeriodId: period.id })
          .set(authorization(token))
          .expect(200)
          .expect('Content-Type', /spreadsheetml/);
      }
    }
    await request(app.getHttpServer())
      .get('/auth/profile')
      .set(authorization(authToken))
      .expect(200);
  });

  it('keeps old and new DIRECCION accounts linked to different persons', async () => {
    await request(app.getHttpServer())
      .patch(`/users/${previousDirectionId}/status`)
      .set(authorization(adminToken))
      .send({ isActive: false })
      .expect(200);
    const [oldUser, newUser] = await Promise.all([
      prisma.users.findUniqueOrThrow({ where: { id: previousDirectionId } }),
      prisma.users.findUniqueOrThrow({ where: { id: directionId } }),
    ]);
    expect(oldUser.is_active).toBe(false);
    expect(oldUser.person_id).toBe(previousDirectionPersonId);
    expect(newUser.person_id).toBe(directionPersonId);
    expect(newUser.person_id).not.toBe(oldUser.person_id);
  });

  it('invalidates prior tokens when the isolated user or person becomes inactive', async () => {
    const profile = () =>
      request(app.getHttpServer())
        .get('/auth/profile')
        .set(authorization(adminToken));
    const [userBefore, personBefore] = await Promise.all([
      prisma.users.findUniqueOrThrow({
        where: { id: adminId },
        select: { is_active: true },
      }),
      prisma.persons.findUniqueOrThrow({
        where: { id: adminPersonId },
        select: { is_active: true },
      }),
    ]);
    try {
      await prisma.users.update({
        where: { id: adminId },
        data: { is_active: false },
      });
      await profile().expect(401);
      await prisma.users.update({
        where: { id: adminId },
        data: { is_active: userBefore.is_active },
      });
      await prisma.persons.update({
        where: { id: adminPersonId },
        data: { is_active: false },
      });
      await profile().expect(401);
      await prisma.persons.update({
        where: { id: adminPersonId },
        data: { is_active: personBefore.is_active },
      });
    } finally {
      await prisma.users.update({
        where: { id: adminId },
        data: { is_active: userBefore.is_active },
      });
      await prisma.persons.update({
        where: { id: adminPersonId },
        data: { is_active: personBefore.is_active },
      });
    }
    await profile().expect(200);
  });

  it('persists all required safe audit actions', async () => {
    const logs = await prisma.audit_logs.findMany({
      where: { entity_id: { in: testUserIds } },
      select: { action: true, old_value: true, new_value: true },
    });
    const actions = new Set(logs.map((log) => log.action));
    for (const action of ['USER_CREATE', 'USER_UPDATE', 'USER_PASSWORD_CHANGE'])
      expect(actions).toContain(action);
    const serialized = JSON.stringify(logs);
    expect(serialized).not.toMatch(
      /password_hash|temporaryPassword|RegressionA1|AuthInitialA1|AuthChangedA1/,
    );
  });
});
