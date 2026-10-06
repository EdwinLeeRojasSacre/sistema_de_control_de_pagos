import { afterEach, describe, expect, it } from 'vitest';
import {
  configureE2eDatabase,
  getE2eDatabaseName,
} from './e2e-database.guard.js';

describe.sequential('E2E database guard', () => {
  const originalE2eUrl = process.env.DATABASE_URL_E2E;
  const originalDatabaseUrl = process.env.DATABASE_URL;

  afterEach(() => {
    process.env.DATABASE_URL_E2E = originalE2eUrl;
    process.env.DATABASE_URL = originalDatabaseUrl;
  });

  it('rejects a missing dedicated URL instead of falling back to DATABASE_URL', () => {
    delete process.env.DATABASE_URL_E2E;
    process.env.DATABASE_URL =
      'postgresql://user:password@localhost:5432/sgpe_dev?schema=sgpe';

    expect(() => configureE2eDatabase()).toThrow('DATABASE_URL_E2E');
  });

  it('rejects sgpe_dev explicitly', () => {
    expect(() =>
      getE2eDatabaseName(
        'postgresql://user:password@localhost:5432/sgpe_dev?schema=sgpe',
      ),
    ).toThrow('Database E2E bloqueada');
  });

  it('accepts an isolated name and promotes only that URL for Prisma', () => {
    const isolatedUrl =
      'postgresql://user:password@localhost:5432/sgpe_ci_e2e_01?schema=sgpe';
    process.env.DATABASE_URL_E2E = isolatedUrl;

    expect(configureE2eDatabase()).toBe('sgpe_ci_e2e_01');
    expect(process.env.DATABASE_URL).toBe(isolatedUrl);
  });
});
