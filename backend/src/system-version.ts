import { readFileSync } from 'node:fs';

interface PackageMetadata { version: string }

const packageMetadata = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as PackageMetadata;

export const SYSTEM_VERSION_NUMBER = packageMetadata.version;
export const SYSTEM_VERSION = `Sistema de Control de Pagos v${SYSTEM_VERSION_NUMBER}`;
