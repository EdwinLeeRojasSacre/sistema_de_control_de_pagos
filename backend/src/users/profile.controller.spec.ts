import { Test } from '@nestjs/testing';
import { vi } from 'vitest';
import { ProfileController } from './profile.controller.js';
import { UsersService } from './users.service.js';

describe('ProfileController', () => {
  const service = { getMyProfile: vi.fn(), updateMyProfile: vi.fn() };
  const request = {
    user: { sub: 'authenticated-user', username: 'admin', role: 'ADMINISTRADOR', mustChangePassword: false },
    ip: '127.0.0.1',
    get: vi.fn().mockReturnValue('test-agent'),
  };

  it('uses the JWT user for GET and PATCH /users/me', async () => {
    const module = await Test.createTestingModule({
      controllers: [ProfileController], providers: [{ provide: UsersService, useValue: service }],
    }).compile();
    const controller = module.get(ProfileController);
    controller.getMyProfile(request as never);
    controller.updateMyProfile({ phone: '999' }, request as never);
    expect(service.getMyProfile).toHaveBeenCalledWith(request.user);
    expect(service.updateMyProfile).toHaveBeenCalledWith(
      request.user, { phone: '999' }, expect.objectContaining({ userId: 'authenticated-user' }),
    );
  });
});
