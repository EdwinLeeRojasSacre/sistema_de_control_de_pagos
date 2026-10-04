import { UnauthorizedException } from '@nestjs/common';
import { vi } from 'vitest';

import { PrismaService } from '../prisma/prisma.service.js';
import { JwtStrategy } from './jwt.strategy.js';

describe('JwtStrategy', () => {
  const prisma = {
    users: {
      findUnique: vi.fn(),
    },
  };
  const payload = {
    sub: 'user-1', username: 'secretaria', role: 'SECRETARIA',
  };
  let strategy: JwtStrategy;

  function activeUser() {
    return {
      id: 'user-1', username: 'secretaria', is_active: true,
      must_change_password: false,
      persons: { is_active: true },
      roles: { code: 'SECRETARIA', is_active: true },
    };
  }

  beforeEach(() => {
    prisma.users.findUnique.mockReset();
    strategy = new JwtStrategy(prisma as unknown as PrismaService);
  });

  it('returns the authenticated user for an active database record', async () => {
    prisma.users.findUnique.mockResolvedValue(activeUser());

    await expect(strategy.validate(payload)).resolves.toEqual({
      sub: 'user-1', username: 'secretaria', role: 'SECRETARIA',
      mustChangePassword: false,
    });
  });

  it('rejects a token whose user no longer exists', async () => {
    prisma.users.findUnique.mockResolvedValue(null);

    await expect(strategy.validate(payload))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns the current role from the database', async () => {
    prisma.users.findUnique.mockResolvedValue({
      ...activeUser(),
      roles: { code: 'DIRECCION', is_active: true },
    });

    await expect(strategy.validate(payload)).resolves.toEqual({
      sub: 'user-1', username: 'secretaria', role: 'DIRECCION',
      mustChangePassword: false,
    });
  });

  it.each([
    ['user', { is_active: false }],
    ['person', { persons: { is_active: false } }],
    ['role', { roles: { code: 'SECRETARIA', is_active: false } }],
  ])('rejects a token when the %s is inactive', async (_, change) => {
    const user = activeUser();
    Object.assign(user, change);
    prisma.users.findUnique.mockResolvedValue(user);

    await expect(strategy.validate(payload))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });
});
