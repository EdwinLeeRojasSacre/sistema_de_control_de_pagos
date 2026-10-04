import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { vi } from 'vitest';

import { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  let service: UsersService;
  const prisma = {
    users: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    persons: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    roles: { findMany: vi.fn(), findUnique: vi.fn() },
    audit_logs: { create: vi.fn() },
    $transaction: vi.fn(),
  };

  const admin = { sub: 'admin-1', username: 'admin', role: 'ADMINISTRADOR', mustChangePassword: false };
  const secretary = { sub: 'sec-1', username: 'sec', role: 'SECRETARIA', mustChangePassword: false };
  const context = { userId: 'sec-1', ipAddress: '127.0.0.1', deviceName: 'test' };
  const selectedDirection = {
    id: 'direction-1', person_id: 'person-1', username: 'director', is_active: true,
    must_change_password: false, password_changed_at: null, last_login: null,
    created_at: new Date(), updated_at: new Date(),
    persons: { id: 'person-1', first_name: 'Ana', last_name_father: 'Diaz', last_name_mother: null, document_type: 'DNI', document_number: '1', birth_date: null, gender: null, phone: null, email: null, address: null, is_active: true },
    roles: { code: 'DIRECCION', name: 'Direccion' },
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    prisma.$transaction.mockImplementation(async (callback: (transaction: typeof prisma) => unknown) => callback(prisma));
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns only the authenticated user profile without internal identifiers', async () => {
    prisma.users.findUnique.mockResolvedValue(selectedDirection);

    const result = await service.getMyProfile(admin);

    expect(prisma.users.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: admin.sub } }));
    expect(result).toMatchObject({
      username: 'director',
      role: { code: 'DIRECCION' },
      person: { firstName: 'Ana', documentType: 'DNI', phone: null, email: null },
    });
    expect(result).not.toHaveProperty('id');
    expect(result.person).not.toHaveProperty('id');
    expect(JSON.stringify(result)).not.toMatch(/password|role_id|person_id/);
  });

  it('updates only the authenticated person profile and audits the safe change', async () => {
    const updated = {
      ...selectedDirection,
      persons: { ...selectedDirection.persons, document_type: 'CE', document_number: 'CE-100', phone: '988888888', email: 'admin@example.test' },
    };
    prisma.users.findUnique.mockResolvedValueOnce(selectedDirection).mockResolvedValueOnce(updated);

    const result = await service.updateMyProfile(
      admin,
      { documentType: 'ce', documentNumber: 'CE-100', phone: ' 988888888 ', email: ' ADMIN@EXAMPLE.TEST ' },
      { ...context, userId: admin.sub },
    );

    expect(prisma.users.findUnique).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: { id: admin.sub } }));
    expect(prisma.persons.update).toHaveBeenCalledWith({
      where: { id: selectedDirection.person_id },
      data: { document_type: 'CE', document_number: 'CE-100', phone: '988888888', email: 'admin@example.test' },
    });
    expect(result.person).toMatchObject({ documentType: 'CE', documentNumber: 'CE-100', phone: '988888888', email: 'admin@example.test' });
    const audit = prisma.audit_logs.create.mock.calls[0][0].data;
    expect(audit).toMatchObject({ user_id: admin.sub, entity_id: admin.sub, action: 'USER_UPDATE' });
    expect(JSON.stringify(audit)).not.toMatch(/password|username/);
  });

  it('always derives /me identity from the JWT actor rather than another user', async () => {
    prisma.users.findUnique.mockResolvedValueOnce(selectedDirection).mockResolvedValueOnce(selectedDirection);

    await service.updateMyProfile(admin, { phone: '999' }, { ...context, userId: admin.sub });

    for (const call of prisma.users.findUnique.mock.calls) {
      expect(call[0].where).toEqual({ id: admin.sub });
    }
  });

  it('returns conflict when the authenticated profile document belongs to another person', async () => {
    prisma.users.findUnique.mockResolvedValueOnce(selectedDirection);
    prisma.persons.update.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002', clientVersion: '6.16.2', meta: { target: ['document_type', 'document_number'] },
    }));
    await expect(service.updateMyProfile(admin, { documentType: 'DNI', documentNumber: '99999999' }, {
      ...context, userId: admin.sub,
    })).rejects.toThrow('Ya existe otra persona con ese tipo y numero de documento');
  });

  it('returns the single active administrator as a reduced public support response', async () => {
    prisma.users.findMany.mockResolvedValue([{ persons: {
      first_name: 'Ada', last_name_father: 'López', last_name_mother: null,
      email: 'ada@example.test', phone: '999999999',
    } }]);

    const result = await service.getPublicSupport();

    expect(result).toMatchObject({
      administratorName: 'Ada López', administratorEmail: 'ada@example.test',
      administratorPhone: '999999999', version: expect.stringMatching(/^Sistema de Control de Pagos v/),
    });
    expect(JSON.stringify(result)).not.toMatch(/\bid\b|username|document|password|role_id|created_at/);
    expect(prisma.users.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 2 }));
  });

  it.each([[[]], [[
    { persons: { first_name: 'A', last_name_father: null, last_name_mother: null, email: 'a@test.pe', phone: null } },
    { persons: { first_name: 'B', last_name_father: null, last_name_mother: null, email: 'b@test.pe', phone: null } },
  ]]])('returns an unconfigured safe contact for zero or multiple active administrators', async (administrators) => {
    prisma.users.findMany.mockResolvedValue(administrators);
    await expect(service.getPublicSupport()).resolves.toMatchObject({
      administratorName: null, administratorEmail: null, administratorPhone: null,
    });
  });

  it('rejects privilege escalation by SECRETARIA', async () => {
    await expect(service.create(
      { personId: 'person-1', username: 'admin2', role: 'ADMINISTRADOR' } as never,
      secretary, context,
    )).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.users.create).not.toHaveBeenCalled();
  });

  it('allows SECRETARIA to create DIRECCION with a one-time password and safe audit', async () => {
    prisma.persons.findUnique.mockResolvedValue({ id: 'person-1', is_active: true, users: null });
    prisma.roles.findUnique.mockResolvedValue({ id: 'role-1', code: 'DIRECCION', is_active: true });
    prisma.users.create.mockResolvedValue(selectedDirection);
    const result = await service.create({ personId: 'person-1', username: 'Director', role: 'DIRECCION' }, secretary, context);
    expect(result.temporaryPassword).toBeTruthy();
    const createData = prisma.users.create.mock.calls[0][0].data;
    expect(createData.username).toBe('director');
    expect(createData.must_change_password).toBe(true);
    expect(await bcrypt.compare(result.temporaryPassword, createData.password_hash)).toBe(true);
    expect(JSON.stringify(prisma.audit_logs.create.mock.calls[0][0])).not.toContain(result.temporaryPassword);
    expect(JSON.stringify(prisma.audit_logs.create.mock.calls[0][0])).not.toContain(createData.password_hash);
  });

  it('rejects creating a second active DIRECCION with a clear conflict', async () => {
    prisma.roles.findUnique.mockResolvedValue({ id: 'role-1', code: 'DIRECCION', is_active: true });
    prisma.users.findFirst.mockResolvedValue({ username: 'direccion.actual' });
    await expect(service.create({
      personId: 'person-2', username: 'direccion.nueva', role: 'DIRECCION',
    }, admin, context)).rejects.toThrow('Ya existe una cuenta DIRECCION activa: direccion.actual');
    expect(prisma.users.create).not.toHaveBeenCalled();
  });

  it('rejects creating a second active SECRETARIA with a role-specific conflict and no partial writes', async () => {
    prisma.roles.findUnique.mockResolvedValue({ id: 'role-secretary', code: 'SECRETARIA', is_active: true });
    prisma.users.findFirst.mockResolvedValue({ username: 'secretaria.actual' });
    await expect(service.create({
      personId: 'person-2', username: 'secretaria.nueva', role: 'SECRETARIA',
    }, admin, context)).rejects.toThrow('Ya existe una cuenta SECRETARIA activa: secretaria.actual');
    expect(prisma.persons.create).not.toHaveBeenCalled();
    expect(prisma.users.create).not.toHaveBeenCalled();
  });

  it('allows creating an inactive SECRETARIA while another is active', async () => {
    prisma.roles.findUnique.mockResolvedValue({ id: 'role-secretary', code: 'SECRETARIA', is_active: true });
    prisma.persons.findUnique.mockResolvedValue({ id: 'person-2', is_active: true, users: null });
    prisma.users.create.mockResolvedValue({ ...selectedDirection, roles: { code: 'SECRETARIA', name: 'Secretaria' }, is_active: false });
    await expect(service.create({
      personId: 'person-2', username: 'secretaria.nueva', role: 'SECRETARIA', isActive: false,
    }, admin, context)).resolves.toBeDefined();
    expect(prisma.users.findFirst).not.toHaveBeenCalled();
  });

  it('allows creating an inactive DIRECCION while another is active', async () => {
    prisma.roles.findUnique.mockResolvedValue({ id: 'role-1', code: 'DIRECCION', is_active: true });
    prisma.persons.findUnique.mockResolvedValue({ id: 'person-2', is_active: true, users: null });
    prisma.users.create.mockResolvedValue({ ...selectedDirection, id: 'direction-2', person_id: 'person-2', username: 'direccion.nueva', is_active: false });
    await service.create({
      personId: 'person-2', username: 'direccion.nueva', role: 'DIRECCION', isActive: false,
    }, admin, context);
    expect(prisma.users.findFirst).not.toHaveBeenCalled();
    expect(prisma.users.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ is_active: false }),
    }));
  });

  it.each(['DIRECCION', 'SECRETARIA'] as const)('allows ADMIN to create %s with an existing person', async (role) => {
    prisma.persons.findUnique.mockResolvedValue({ id: 'person-1', is_active: true, users: null });
    prisma.roles.findUnique.mockResolvedValue({ id: `role-${role}`, code: role, is_active: true });
    prisma.users.create.mockResolvedValue({ ...selectedDirection, roles: { code: role, name: role } });
    await expect(service.create({ personId: 'person-1', username: `user-${role.toLowerCase()}`, role }, admin, context)).resolves.toMatchObject({ user: { role: { code: role } }, temporaryPassword: expect.any(String) });
  });

  it.each(['DIRECCION', 'SECRETARIA'] as const)('creates a new independent person and %s account atomically as ADMIN', async (role) => {
    prisma.roles.findUnique.mockResolvedValue({ id: `role-${role}`, code: role, is_active: true });
    prisma.persons.create.mockResolvedValue({ id: 'new-person', is_active: true });
    prisma.users.create.mockResolvedValue({ ...selectedDirection, person_id: 'new-person', roles: { code: role, name: role } });
    const result = await service.create({
      person: { documentType: 'dni', documentNumber: '123', firstName: ' Ana ', phone: '999' },
      username: 'new.user', role,
    }, admin, context);
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.persons.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ document_type: 'DNI', document_number: '123', first_name: 'Ana' }) }));
    expect(prisma.users.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ person_id: 'new-person', must_change_password: true }) }));
    expect(result.temporaryPassword).toEqual(expect.any(String));
  });

  it('rejects new SECRETARIA creation by SECRETARIA before creating a person', async () => {
    await expect(service.create({
      person: { documentType: 'DNI', documentNumber: '123', firstName: 'Ana' },
      username: 'new.secretary', role: 'SECRETARIA',
    }, secretary, context)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.persons.create).not.toHaveBeenCalled();
  });

  it('does not audit when user creation fails after creating the person inside the transaction', async () => {
    prisma.roles.findUnique.mockResolvedValue({ id: 'role-1', code: 'DIRECCION', is_active: true });
    prisma.persons.create.mockResolvedValue({ id: 'new-person', is_active: true });
    prisma.users.create.mockRejectedValue(new Error('user insert failed'));
    await expect(service.create({
      person: { documentType: 'DNI', documentNumber: '123', firstName: 'Ana' },
      username: 'director', role: 'DIRECCION',
    }, admin, context)).rejects.toThrow('user insert failed');
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.audit_logs.create).not.toHaveBeenCalled();
  });

  it('translates concurrent document duplication into HTTP conflict', async () => {
    prisma.roles.findUnique.mockResolvedValue({ id: 'role-1', code: 'DIRECCION', is_active: true });
    prisma.persons.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: '6.16.2', meta: { target: ['document_type', 'document_number'] } }));
    await expect(service.create({
      person: { documentType: 'DNI', documentNumber: '123', firstName: 'Ana' },
      username: 'director', role: 'DIRECCION',
    }, admin, context)).rejects.toThrow('Ya existe una persona');
  });

  it('rejects a duplicate username before writes', async () => {
    prisma.roles.findUnique.mockResolvedValue({ id: 'role-1', code: 'DIRECCION', is_active: true });
    prisma.users.findUnique.mockResolvedValue({ id: 'existing-user' });
    await expect(service.create({ personId: 'person-1', username: 'duplicate', role: 'DIRECCION' }, admin, context)).rejects.toThrow('username ya esta en uso');
    expect(prisma.users.create).not.toHaveBeenCalled();
  });

  it('rejects a person that already has a user', async () => {
    prisma.persons.findUnique.mockResolvedValue({ id: 'person-1', is_active: true, users: { id: 'existing' } });
    prisma.roles.findUnique.mockResolvedValue({ id: 'role-1', code: 'DIRECCION', is_active: true });
    await expect(service.create({ personId: 'person-1', username: 'director', role: 'DIRECCION' }, secretary, context)).rejects.toBeInstanceOf(ConflictException);
  });

  it('translates concurrent unique conflicts into HTTP conflict', async () => {
    prisma.persons.findUnique.mockResolvedValue({ id: 'person-1', is_active: true, users: null });
    prisma.roles.findUnique.mockResolvedValue({ id: 'role-1', code: 'DIRECCION', is_active: true });
    prisma.users.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: '6.16.2', meta: { target: ['username'] } }));
    await expect(service.create({ personId: 'person-1', username: 'director', role: 'DIRECCION' }, secretary, context)).rejects.toThrow('username ya esta en uso');
  });

  it('allows SECRETARIA to reset DIRECCION and never audits secrets', async () => {
    prisma.users.findUnique.mockResolvedValueOnce(selectedDirection).mockResolvedValueOnce(null);
    const result = await service.resetPassword('direction-1', secretary, context);
    const updateData = prisma.users.update.mock.calls[0][0].data;
    expect(updateData.must_change_password).toBe(true);
    expect(updateData).not.toHaveProperty('password_changed_at');
    expect(await bcrypt.compare(result.temporaryPassword, updateData.password_hash)).toBe(true);
    const audit = JSON.stringify(prisma.audit_logs.create.mock.calls[0][0]);
    expect(audit).not.toContain(result.temporaryPassword);
    expect(audit).not.toContain(updateData.password_hash);
  });

  it('rejects reset for an inactive account without returning an unusable credential', async () => {
    prisma.users.findUnique.mockResolvedValue({ ...selectedDirection, is_active: false });
    await expect(service.resetPassword('direction-1', admin, context)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.users.update).not.toHaveBeenCalled();
    expect(prisma.audit_logs.create).not.toHaveBeenCalled();
  });

  it('rejects SECRETARIA reset of another SECRETARIA', async () => {
    prisma.users.findUnique.mockResolvedValue({ ...selectedDirection, roles: { code: 'SECRETARIA', name: 'Secretaria' } });
    await expect(service.resetPassword('sec-2', secretary, context)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.users.update).not.toHaveBeenCalled();
  });

  it('allows ADMIN to activate or deactivate managed roles', async () => {
    prisma.users.findUnique.mockResolvedValue(selectedDirection);
    prisma.users.update.mockResolvedValue({ ...selectedDirection, is_active: false });
    await expect(service.updateStatus('direction-1', false, admin, context)).resolves.toMatchObject({ isActive: false });
    expect(prisma.audit_logs.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'USER_DEACTIVATE' }) }));
    expect(prisma.persons.update).not.toHaveBeenCalled();
  });

  it('prevents the authenticated ADMINISTRADOR from deactivating itself', async () => {
    await expect(service.updateStatus(admin.sub, false, admin, { ...context, userId: admin.sub }))
      .rejects.toThrow('No puede desactivar su propia cuenta');
    expect(prisma.users.update).not.toHaveBeenCalled();
  });

  it('rejects activating DIRECCION while another is active and allows it after deactivation', async () => {
    const inactive = { ...selectedDirection, id: 'direction-2', username: 'direccion.nueva', is_active: false };
    prisma.users.findUnique.mockResolvedValue(inactive);
    prisma.users.findFirst.mockResolvedValueOnce({ username: 'direccion.actual' });
    await expect(service.updateStatus('direction-2', true, admin, context)).rejects.toThrow(
      'Ya existe una cuenta DIRECCION activa: direccion.actual',
    );
    prisma.users.findFirst.mockResolvedValueOnce(null);
    prisma.users.update.mockResolvedValue({ ...inactive, is_active: true });
    await expect(service.updateStatus('direction-2', true, admin, context)).resolves.toMatchObject({ isActive: true });
  });

  it('rejects activating SECRETARIA while another SECRETARIA is active', async () => {
    const inactive = {
      ...selectedDirection,
      id: 'secretary-2', username: 'secretaria.nueva', is_active: false,
      roles: { code: 'SECRETARIA', name: 'Secretaria' },
    };
    prisma.users.findUnique.mockResolvedValue(inactive);
    prisma.users.findFirst.mockResolvedValue({ username: 'secretaria.actual' });
    await expect(service.updateStatus('secretary-2', true, admin, context)).rejects.toThrow(
      'Ya existe una cuenta SECRETARIA activa: secretaria.actual',
    );
    expect(prisma.users.update).not.toHaveBeenCalled();
  });

  it('uses SERIALIZABLE transactions for DIRECCION creation and activation', async () => {
    prisma.roles.findUnique.mockResolvedValue({ id: 'role-1', code: 'DIRECCION', is_active: true });
    prisma.persons.findUnique.mockResolvedValue({ id: 'person-2', is_active: true, users: null });
    prisma.users.create.mockResolvedValue({ ...selectedDirection, id: 'direction-2', person_id: 'person-2', is_active: false });
    await service.create({ personId: 'person-2', username: 'dir2', role: 'DIRECCION', isActive: false }, admin, context);
    expect(prisma.$transaction.mock.calls[0][1]).toMatchObject({
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it('allows at most one of two concurrent DIRECCION activations', async () => {
    let activeId: string | null = null;
    let transactionQueue = Promise.resolve();
    prisma.$transaction.mockImplementation((callback: (transaction: typeof prisma) => Promise<unknown>) => {
      const result = transactionQueue.then(() => callback(prisma));
      transactionQueue = result.then(() => undefined, () => undefined);
      return result;
    });
    prisma.users.findUnique.mockImplementation(({ where }: { where: { id: string } }) => Promise.resolve({
      ...selectedDirection,
      id: where.id,
      username: where.id,
      is_active: false,
    }));
    prisma.users.findFirst.mockImplementation(({ where }: { where: { id?: { not?: string } } }) => Promise.resolve(
      activeId && activeId !== where.id?.not ? { username: activeId } : null,
    ));
    prisma.users.update.mockImplementation(({ where }: { where: { id: string } }) => {
      activeId = where.id;
      return Promise.resolve({ ...selectedDirection, id: where.id, username: where.id, is_active: true });
    });

    const results = await Promise.allSettled([
      service.updateStatus('direction-a', true, admin, context),
      service.updateStatus('direction-b', true, admin, context),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(activeId).toBe('direction-a');
  });

  it('allows simultaneous activations for different administrative roles', async () => {
    const activeRoles = new Set<string>();
    prisma.users.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
      const code = where.id.startsWith('secretary') ? 'SECRETARIA' : 'DIRECCION';
      return Promise.resolve({
        ...selectedDirection, id: where.id, username: where.id, is_active: false,
        roles: { code, name: code },
      });
    });
    prisma.users.findFirst.mockImplementation(({ where }: { where: { roles: { code: string } } }) =>
      Promise.resolve(activeRoles.has(where.roles.code) ? { username: `active-${where.roles.code}` } : null));
    prisma.users.update.mockImplementation(({ where }: { where: { id: string } }) => {
      const code = where.id.startsWith('secretary') ? 'SECRETARIA' : 'DIRECCION';
      activeRoles.add(code);
      return Promise.resolve({
        ...selectedDirection, id: where.id, username: where.id, is_active: true,
        roles: { code, name: code },
      });
    });

    const results = await Promise.all([
      service.updateStatus('secretary-new', true, admin, context),
      service.updateStatus('direction-new', true, admin, context),
    ]);

    expect(results).toHaveLength(2);
    expect(activeRoles).toEqual(new Set(['SECRETARIA', 'DIRECCION']));
  });

  it.each(['DIRECCION', 'SECRETARIA'] as const)('allows ADMIN to edit %s personal data and username', async (role) => {
    const target = { ...selectedDirection, roles: { code: role, name: role } };
    const updated = { ...target, username: 'updated.user', persons: { ...target.persons, first_name: 'Actualizada', phone: '999' } };
    prisma.users.findUnique.mockResolvedValueOnce(target).mockResolvedValueOnce(null);
    prisma.users.update.mockResolvedValue(updated);
    await expect(service.update('direction-1', { username: 'Updated.User', person: { firstName: 'Actualizada', phone: '999' } }, admin, context)).resolves.toMatchObject({ username: 'updated.user', person: { firstName: 'Actualizada' } });
    expect(prisma.persons.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'person-1' }, data: expect.objectContaining({ first_name: 'Actualizada', phone: '999' }) }));
  });

  it.each(['DIRECCION', 'SECRETARIA'] as const)('allows ADMIN to correct %s document without changing technical identity', async (role) => {
    const target = { ...selectedDirection, roles: { code: role, name: role } };
    const updated = { ...target, persons: { ...target.persons, document_type: 'CE', document_number: 'CE-123' } };
    prisma.users.findUnique.mockResolvedValueOnce(target).mockResolvedValueOnce(updated);

    const result = await service.update(target.id, { person: { documentType: 'ce', documentNumber: 'CE-123' } }, admin, context);

    expect(prisma.persons.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: target.person_id }, data: expect.objectContaining({ document_type: 'CE', document_number: 'CE-123' }),
    }));
    expect(result).toMatchObject({ id: target.id, personId: target.person_id, person: { documentType: 'CE', documentNumber: 'CE-123' } });
    expect(prisma.audit_logs.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'USER_UPDATE' }) }));
  });

  it('translates a duplicate document during user edit into a clear conflict', async () => {
    prisma.users.findUnique.mockResolvedValueOnce(selectedDirection);
    prisma.persons.update.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002', clientVersion: '6.16.2', meta: { target: ['document_type', 'document_number'] },
    }));
    await expect(service.update('direction-1', {
      person: { documentType: 'DNI', documentNumber: '99999999' },
    }, admin, context)).rejects.toThrow('Ya existe otra persona con ese tipo y numero de documento');
  });

  it('allows SECRETARIA to edit DIRECCION', async () => {
    prisma.users.findUnique.mockResolvedValueOnce(selectedDirection).mockResolvedValueOnce({ ...selectedDirection, persons: { ...selectedDirection.persons, email: 'ana@example.com' } });
    await expect(service.update('direction-1', { person: { email: 'ana@example.com' } }, secretary, context)).resolves.toMatchObject({ person: { email: 'ana@example.com' } });
  });

  it('rejects SECRETARIA editing SECRETARIA', async () => {
    prisma.users.findUnique.mockResolvedValue({ ...selectedDirection, roles: { code: 'SECRETARIA', name: 'Secretaria' } });
    await expect(service.update('sec-2', { username: 'changed' }, secretary, context)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.persons.update).not.toHaveBeenCalled();
    expect(prisma.users.update).not.toHaveBeenCalled();
  });

  it('rejects DIRECCION editing any user', async () => {
    prisma.users.findUnique.mockResolvedValueOnce(selectedDirection).mockResolvedValueOnce(null);
    await expect(service.update('direction-1', { username: 'changed' }, { sub: 'direction-2', username: 'director2', role: 'DIRECCION', mustChangePassword: false }, context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects duplicate username during edit as conflict', async () => {
    prisma.users.findUnique.mockResolvedValueOnce(selectedDirection).mockResolvedValueOnce({ id: 'other-user' });
    await expect(service.update('direction-1', { username: 'existing' }, admin, context)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects changing personId or role and never reuses the account', async () => {
    await expect(service.update('direction-1', { personId: 'other-person' } as never, admin, context)).rejects.toThrow('No se permite cambiar la persona');
    await expect(service.update('direction-1', { role: 'SECRETARIA' } as never, admin, context)).rejects.toThrow('No se permite cambiar la persona');
    expect(prisma.users.update).not.toHaveBeenCalled();
  });

  it('updates persons and users in one transaction and audits without secrets', async () => {
    const updated = { ...selectedDirection, username: 'new.director', persons: { ...selectedDirection.persons, first_name: 'Nueva' } };
    prisma.users.findUnique.mockResolvedValueOnce(selectedDirection).mockResolvedValueOnce(null);
    prisma.users.update.mockResolvedValue(updated);
    await service.update('direction-1', { username: 'new.director', person: { firstName: 'Nueva' } }, admin, context);
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.persons.update).toHaveBeenCalledOnce();
    expect(prisma.users.update).toHaveBeenCalledOnce();
    const audit = prisma.audit_logs.create.mock.calls[0][0].data;
    expect(audit.action).toBe('USER_UPDATE');
    expect(JSON.stringify(audit)).not.toMatch(/password|password_hash|temporaryPassword/);
    expect(prisma.users.update.mock.calls[0][0].data).not.toHaveProperty('person_id');
  });

  it('translates concurrent username conflict during edit to 409', async () => {
    prisma.users.findUnique.mockResolvedValueOnce(selectedDirection).mockResolvedValueOnce(null);
    prisma.users.update.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: '6.16.2', meta: { target: ['username'] } }));
    await expect(service.update('direction-1', { username: 'other' }, admin, context)).rejects.toBeInstanceOf(ConflictException);
  });

  it('looks up a person by normalized document and reports an existing account', async () => {
    prisma.persons.findUnique.mockResolvedValue({
      id: 'person-1', document_type: 'DNI', document_number: '123', first_name: 'Ana',
      last_name_father: 'Diaz', last_name_mother: null, birth_date: null, gender: null,
      phone: '999', email: null, address: null, is_active: true,
      users: { id: 'user-1', username: 'ana', is_active: true },
    });
    await expect(service.findPersonByDocument(' dni ', ' 123 ')).resolves.toMatchObject({ found: true, person: { id: 'person-1', hasUser: true } });
    expect(prisma.persons.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { document_type_document_number: { document_type: 'DNI', document_number: '123' } } }));
  });

  it('selects an explicit safe user response without password_hash', async () => {
    prisma.users.findMany.mockResolvedValue([]);

    await service.findAll({ sub: 'admin-1', username: 'admin', role: 'ADMINISTRADOR', mustChangePassword: false });

    const [query] = prisma.users.findMany.mock.calls[0] as [
      { select: Record<string, unknown> },
    ];
    expect(query.select).not.toHaveProperty('password_hash');
    expect(query.select).toMatchObject({
      id: true,
      username: true,
      is_active: true,
    });
    expect(query).toMatchObject({ where: { roles: { code: { in: ['SECRETARIA', 'DIRECCION'] } } } });
  });

  it('limits SECRETARIA listing to DIRECCION', async () => {
    prisma.users.findMany.mockResolvedValue([]);
    await service.findAll({ sub: 'sec-1', username: 'sec', role: 'SECRETARIA', mustChangePassword: false });
    expect(prisma.users.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { roles: { code: 'DIRECCION' } } }));
  });
});
