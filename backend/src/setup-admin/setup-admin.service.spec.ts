import { ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import type { PrismaService } from '../prisma/prisma.service.js';
import { SetupAdminService, type SetupAdminInput } from './setup-admin.service.js';

vi.mock('bcrypt', () => ({ hash: vi.fn() }));

const input: SetupAdminInput = {
  firstName: 'Ana',
  lastNameFather: 'Torres',
  lastNameMother: 'Rojas',
  documentType: 'dni',
  documentNumber: '12345678',
  email: 'ADMIN@EXAMPLE.TEST',
  phone: '999999999',
  username: 'ADMIN.LOCAL',
  password: 'SecureAdmin2026',
};

function createTransaction() {
  return {
    users: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    roles: { findUnique: vi.fn() },
    persons: { findUnique: vi.fn(), create: vi.fn() },
    audit_logs: { create: vi.fn() },
  };
}

describe('SetupAdminService', () => {
  beforeEach(() => {
    vi.mocked(bcrypt.hash).mockReset();
  });

  it('does not modify or reset an existing active administrator', async () => {
    const transaction = createTransaction();
    transaction.users.findFirst.mockResolvedValue({ id: 'existing-admin' });
    const prisma = {
      $transaction: vi.fn((operation: (tx: typeof transaction) => unknown) => operation(transaction)),
    };
    const service = new SetupAdminService(prisma as unknown as PrismaService);

    await expect(service.createFirstAdministrator(input)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(transaction.persons.create).not.toHaveBeenCalled();
    expect(transaction.users.create).not.toHaveBeenCalled();
    expect(bcrypt.hash).not.toHaveBeenCalled();
  });

  it('creates the first administrator transactionally and audits no secrets', async () => {
    const transaction = createTransaction();
    transaction.users.findFirst.mockResolvedValue(null);
    transaction.roles.findUnique.mockResolvedValue({ id: 'role-admin', is_active: true });
    transaction.users.findUnique.mockResolvedValue(null);
    transaction.persons.findUnique.mockResolvedValue(null);
    transaction.persons.create.mockResolvedValue({ id: 'person-1' });
    transaction.users.create.mockResolvedValue({
      id: 'user-1',
      person_id: 'person-1',
      username: 'admin.local',
    });
    transaction.audit_logs.create.mockResolvedValue({});
    vi.mocked(bcrypt.hash).mockResolvedValue('safe-hash');
    const prisma = {
      $transaction: vi.fn((operation: (tx: typeof transaction) => unknown) => operation(transaction)),
    };
    const service = new SetupAdminService(prisma as unknown as PrismaService);

    await expect(service.createFirstAdministrator(input)).resolves.toEqual({
      id: 'user-1',
      personId: 'person-1',
      username: 'admin.local',
      role: 'ADMINISTRADOR',
    });

    expect(bcrypt.hash).toHaveBeenCalledWith(input.password, 12);
    expect(transaction.persons.create).toHaveBeenCalledTimes(1);
    expect(transaction.users.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        person_id: 'person-1',
        role_id: 'role-admin',
        username: 'admin.local',
        password_hash: 'safe-hash',
        must_change_password: false,
        is_active: true,
      }),
      select: { id: true, person_id: true, username: true },
    });
    const audit = JSON.stringify(transaction.audit_logs.create.mock.calls[0][0]);
    expect(audit).not.toContain(input.password);
    expect(audit).not.toContain('safe-hash');
    expect(audit).not.toMatch(/password_hash|temporaryPassword/);
  });
});
