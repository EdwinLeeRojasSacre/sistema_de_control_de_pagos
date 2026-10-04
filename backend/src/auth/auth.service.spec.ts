import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { vi } from 'vitest';

import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';

vi.mock('bcrypt', () => ({
  compare: vi.fn(),
  hash: vi.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  const prisma = {
    users: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    audit_logs: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  const jwtService = {
    signAsync: vi.fn(),
  };

  function activeUser() {
    return {
      id: 'user-1',
      username: 'secretaria',
      password_hash: 'hash',
      is_active: true,
      must_change_password: false,
      persons: {
        first_name: 'Secretaria',
        last_name_father: 'General',
        is_active: true,
      },
      roles: {
        code: 'SECRETARIA',
        is_active: true,
      },
    };
  }

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.mocked(bcrypt.compare).mockReset();
    prisma.users.findUnique.mockReset();
    prisma.users.findMany.mockReset().mockResolvedValue([]);
    prisma.users.update.mockReset();
    prisma.audit_logs.create.mockReset();
    prisma.$transaction.mockImplementation(async (callback: (transaction: typeof prisma) => unknown) => callback(prisma));
    jwtService.signAsync.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('authenticates an active user with active person and role', async () => {
    prisma.users.findUnique.mockResolvedValue(activeUser());
    jwtService.signAsync.mockResolvedValue('token');
    vi.mocked(bcrypt.compare).mockResolvedValue(true);

    await expect(
      service.login('secretaria', 'Password123'),
    ).resolves.toEqual({
      access_token: 'token',
      user: {
        id: 'user-1',
        username: 'secretaria',
        role: 'SECRETARIA',
        name: 'Secretaria General',
        mustChangePassword: false,
      },
    });

    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: 'user-1', username: 'secretaria', role: 'SECRETARIA',
    });
  });

  it('rejects an unknown user with the generic authentication error', async () => {
    prisma.users.findUnique.mockResolvedValue(null);

    await expect(
      service.login('unknown', 'Password123'),
    ).rejects.toThrow('Usuario o contraseña incorrectos');

    expect(bcrypt.compare).not.toHaveBeenCalled();
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it('authenticates by a unique normalized person email', async () => {
    prisma.users.findUnique.mockResolvedValue(null);
    prisma.users.findMany.mockResolvedValue([activeUser()]);
    jwtService.signAsync.mockResolvedValue('token');
    vi.mocked(bcrypt.compare).mockResolvedValue(true);

    await expect(service.login('  SECRETARIA@EXAMPLE.TEST  ', 'Password123')).resolves.toMatchObject({
      access_token: 'token', user: { username: 'secretaria' },
    });
    expect(prisma.users.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { persons: { email: { equals: 'secretaria@example.test', mode: 'insensitive' } } },
      take: 2,
    }));
  });

  it.each(['ADMINISTRADOR', 'SECRETARIA', 'DIRECCION'] as const)(
    'authenticates %s by username and by a unique email',
    async (role) => {
      const user = {
        ...activeUser(),
        id: `user-${role}`,
        username: role.toLowerCase(),
        roles: { code: role, is_active: true },
      };
      jwtService.signAsync.mockResolvedValue('token');
      vi.mocked(bcrypt.compare).mockResolvedValue(true);

      prisma.users.findUnique.mockResolvedValueOnce(user).mockResolvedValueOnce(null);
      prisma.users.findMany.mockResolvedValueOnce([user]);

      const byUsername = await service.login(user.username, 'Password123');
      const byEmail = await service.login(`  ${role}@COLEGIO.PE  `, 'Password123');
      expect(byUsername).toMatchObject({ user: { id: user.id, role } });
      expect(byEmail).toMatchObject({ user: { id: user.id, role } });
      expect(byEmail.user.id).toBe(byUsername.user.id);
      expect(prisma.users.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { persons: { email: { equals: `${role.toLowerCase()}@colegio.pe`, mode: 'insensitive' } } },
      }));
    },
  );

  it('rejects an ambiguous email with the generic authentication error', async () => {
    prisma.users.findUnique.mockResolvedValue(null);
    prisma.users.findMany.mockResolvedValue([activeUser(), { ...activeUser(), id: 'user-2' }]);
    await expect(service.login('shared@example.test', 'Password123')).rejects.toThrow(
      'Usuario o contraseña incorrectos',
    );
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  it('preserves must_change_password when authenticating by email', async () => {
    prisma.users.findUnique.mockResolvedValue(null);
    prisma.users.findMany.mockResolvedValue([{ ...activeUser(), must_change_password: true }]);
    jwtService.signAsync.mockResolvedValue('token');
    vi.mocked(bcrypt.compare).mockResolvedValue(true);
    await expect(service.login('secretaria@example.test', 'Password123')).resolves.toMatchObject({
      user: { mustChangePassword: true },
    });
  });

  it('rejects an incorrect password with the generic authentication error', async () => {
    prisma.users.findUnique.mockResolvedValue(activeUser());
    vi.mocked(bcrypt.compare).mockResolvedValue(false);

    await expect(
      service.login('secretaria', 'WrongPassword'),
    ).rejects.toThrow('Usuario o contraseña incorrectos');

    expect(jwtService.signAsync).not.toHaveBeenCalled();
    expect(prisma.users.update).not.toHaveBeenCalled();
  });

  it.each([
    ['user', { is_active: false }],
    ['person', { persons: { is_active: false } }],
    ['role', { roles: { is_active: false } }],
  ])('rejects login for an inactive %s', async (_, change) => {
    const user = activeUser();
    Object.assign(user, change);
    prisma.users.findUnique.mockResolvedValue(user);
    vi.mocked(bcrypt.compare).mockResolvedValue(true);

    await expect(
      service.login('secretaria', 'Password123'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it('changes the password, clears the mandatory flag and audits no secrets', async () => {
    prisma.users.findUnique.mockResolvedValue({ id: 'user-1', password_hash: 'old-hash', must_change_password: true });
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    vi.mocked(bcrypt.hash).mockResolvedValue('new-hash');

    await service.changePassword('user-1', 'OldPassword1', 'NewPassword2', {
      userId: 'user-1', ipAddress: '127.0.0.1', deviceName: 'test',
    });

    expect(prisma.users.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ password_hash: 'new-hash', must_change_password: false, password_changed_at: expect.any(Date) }),
    }));
    const auditData = prisma.audit_logs.create.mock.calls[0][0].data;
    expect(JSON.stringify(auditData)).not.toMatch(/password_hash|OldPassword|NewPassword|new-hash/);
    expect(auditData.action).toBe('USER_PASSWORD_CHANGE');
  });

  it('rejects password change when the current password is incorrect', async () => {
    prisma.users.findUnique.mockResolvedValue({ id: 'user-1', password_hash: 'old-hash', must_change_password: false });
    vi.mocked(bcrypt.compare).mockResolvedValue(false);
    await expect(service.changePassword('user-1', 'wrong', 'NewPassword2', {
      userId: 'user-1', ipAddress: null, deviceName: null,
    })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.users.update).not.toHaveBeenCalled();
  });
});
