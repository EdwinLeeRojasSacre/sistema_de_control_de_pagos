import bcrypt from 'bcrypt';

const marker = '_e2e';
const databaseUrl = process.env.DATABASE_URL_E2E?.trim();
if (!databaseUrl) {
  throw new Error('DATABASE_URL_E2E es obligatoria para preparar fixtures E2E.');
}

const parsedUrl = new URL(databaseUrl);
const databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\//, ''));
const normalizedName = databaseName.toLowerCase();
if (
  !normalizedName.includes(marker) ||
  normalizedName === 'sgpe_dev' ||
  normalizedName.includes('production') ||
  normalizedName.includes('produccion') ||
  normalizedName.endsWith('_prod')
) {
  throw new Error(`Base no permitida para fixtures E2E: ${databaseName}`);
}

process.env.DATABASE_URL = databaseUrl;
const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

try {
  const roles = [
    ['ADMINISTRADOR', 'Administrador'],
    ['SECRETARIA', 'Secretaria'],
    ['DIRECCION', 'Direccion'],
  ];
  for (const [code, name] of roles) {
    await prisma.roles.upsert({
      where: { code },
      update: { name, is_active: true },
      create: { code, name },
    });
  }

  const passwordHash = await bcrypt.hash('E2eFixture2026!', 10);
  for (const roleCode of ['SECRETARIA', 'DIRECCION']) {
    const suffix = roleCode.toLowerCase();
    const role = await prisma.roles.findUniqueOrThrow({ where: { code: roleCode } });
    const person = await prisma.persons.upsert({
      where: {
        document_type_document_number: {
          document_type: 'E2E',
          document_number: `FIXTURE-${roleCode}`,
        },
      },
      update: { is_active: true },
      create: {
        document_type: 'E2E',
        document_number: `FIXTURE-${roleCode}`,
        first_name: `Fixture ${roleCode}`,
      },
    });
    await prisma.users.upsert({
      where: { username: `fixture_${suffix}` },
      update: {
        person_id: person.id,
        role_id: role.id,
        password_hash: passwordHash,
        is_active: true,
        must_change_password: false,
      },
      create: {
        person_id: person.id,
        role_id: role.id,
        username: `fixture_${suffix}`,
        password_hash: passwordHash,
        is_active: true,
        must_change_password: false,
      },
    });
  }
} finally {
  await prisma.$disconnect();
}

console.log(`Fixtures minimos preparados en ${databaseName}.`);
