const E2E_DATABASE_MARKER = '_e2e';

export function getE2eDatabaseName(databaseUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL_E2E no es una URL valida.');
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  assertE2eDatabaseName(databaseName);
  return databaseName;
}

export function assertE2eDatabaseName(databaseName: string): void {
  const normalized = databaseName.trim().toLowerCase();
  if (
    !normalized.includes(E2E_DATABASE_MARKER) ||
    normalized === 'sgpe_dev' ||
    normalized.includes('production') ||
    normalized.includes('produccion') ||
    normalized.endsWith('_prod')
  ) {
    throw new Error(
      `Database E2E bloqueada: ${databaseName || 'desconocida'}. ` +
        `El nombre debe contener "${E2E_DATABASE_MARKER}" y no puede ser dev/prod.`,
    );
  }
}

export function configureE2eDatabase(): string {
  const databaseUrl = process.env.DATABASE_URL_E2E?.trim();
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL_E2E es obligatoria. La suite nunca usa DATABASE_URL como fallback.',
    );
  }

  const databaseName = getE2eDatabaseName(databaseUrl);
  process.env.DATABASE_URL = databaseUrl;
  return databaseName;
}
