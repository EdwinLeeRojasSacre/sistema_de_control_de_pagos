import { Test } from '@nestjs/testing';
import { vi } from 'vitest';
import { SupportController } from './support.controller.js';
import { UsersService } from './users.service.js';

describe('SupportController', () => {
  it('returns only the explicit public support contract', async () => {
    const response = {
      institution: 'Institution', administratorName: 'Admin', administratorEmail: 'a@test.pe',
      administratorPhone: null, version: 'Sistema de Control de Pagos v1.0.0',
    };
    const service = { getPublicSupport: vi.fn().mockResolvedValue(response) };
    const module = await Test.createTestingModule({
      controllers: [SupportController], providers: [{ provide: UsersService, useValue: service }],
    }).compile();
    await expect(module.get(SupportController).getPublicSupport()).resolves.toEqual(response);
  });
});
