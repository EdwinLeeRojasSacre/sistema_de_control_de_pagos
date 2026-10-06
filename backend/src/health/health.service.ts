import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { SYSTEM_VERSION_NUMBER } from '../system-version.js';

export interface HealthResponse {
  status: 'ok' | 'error';
  database: 'ok' | 'unavailable';
  version: string;
}

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        database: 'ok',
        version: SYSTEM_VERSION_NUMBER,
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'unavailable',
        version: SYSTEM_VERSION_NUMBER,
      } satisfies HealthResponse);
    }
  }
}
