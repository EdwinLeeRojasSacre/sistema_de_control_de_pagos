import { Reflector } from '@nestjs/core';
import { vi } from 'vitest';

import { RolesGuard } from './roles.guard.js';

describe('RolesGuard', () => {
  const reflector = {
    getAllAndOverride: vi.fn(),
  };
  const guard = new RolesGuard(reflector as unknown as Reflector);

  function context(role: string, mustChangePassword = false) {
    return {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({
        getRequest: () => ({ user: { role, mustChangePassword } }),
      }),
    };
  }

  it('allows an authenticated user with an authorized current role', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMINISTRADOR']);

    expect(guard.canActivate(context('ADMINISTRADOR') as never)).toBe(true);
  });

  it('rejects an authenticated user without the required role', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMINISTRADOR']);

    expect(guard.canActivate(context('SECRETARIA') as never)).toBe(false);
  });

  it('allows an authenticated endpoint without role metadata', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(context('SECRETARIA') as never)).toBe(true);
  });

  it('blocks functional endpoints while password change is required', () => {
    reflector.getAllAndOverride.mockReturnValue(['DIRECCION']);
    expect(() => guard.canActivate(context('DIRECCION', true) as never)).toThrow('Debe cambiar su contrase');
  });
});
