import { ServiceUnavailableException } from '@nestjs/common';

import type { PrismaService } from '../prisma/prisma.service.js';
import { SYSTEM_VERSION_NUMBER } from '../system-version.js';
import { HealthService } from './health.service.js';

describe('HealthService', () => {
  it('reports the database and application as healthy', async () => {
    const prisma = { $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]) };
    const service = new HealthService(prisma as unknown as PrismaService);

    await expect(service.check()).resolves.toEqual({
      status: 'ok',
      database: 'ok',
      version: SYSTEM_VERSION_NUMBER,
    });
  });

  it('returns a safe 503 response when PostgreSQL is unavailable', async () => {
    const prisma = { $queryRaw: vi.fn().mockRejectedValue(new Error('connection failed')) };
    const service = new HealthService(prisma as unknown as PrismaService);

    const error = await service.check().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).getStatus()).toBe(503);
    expect((error as ServiceUnavailableException).getResponse()).toEqual({
      status: 'error',
      database: 'unavailable',
      version: SYSTEM_VERSION_NUMBER,
    });
  });
});
