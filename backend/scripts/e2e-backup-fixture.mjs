import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const databaseUrl = process.env.DATABASE_URL_E2E?.trim();
const voucherRoot = process.env.VOUCHER_STORAGE_PATH?.trim();
if (!databaseUrl || !voucherRoot) {
  throw new Error('DATABASE_URL_E2E y VOUCHER_STORAGE_PATH son obligatorias.');
}

const parsedUrl = new URL(databaseUrl);
const databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\//, ''));
const normalizedName = databaseName.toLowerCase();
if (
  !normalizedName.includes('_e2e') ||
  normalizedName === 'sgpe_dev' ||
  normalizedName.includes('production') ||
  normalizedName.includes('produccion') ||
  normalizedName.endsWith('_prod')
) {
  throw new Error(`Base no permitida para fixture de backup: ${databaseName}`);
}

process.env.DATABASE_URL = databaseUrl;
const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();
const contents = Buffer.from('%PDF-1.4 SGPE disposable backup fixture\n');
const physicalName = 'e2e-backup-voucher.pdf';
const absolutePath = join(voucherRoot, physicalName);

try {
  await mkdir(voucherRoot, { recursive: true });
  await writeFile(absolutePath, contents);

  const existing = await prisma.payments.findFirst({
    where: { operation_number: 'E2E-BACKUP-FIXTURE' },
  });
  if (!existing) {
    const user = await prisma.users.findUniqueOrThrow({
      where: { username: 'fixture_secretaria' },
    });
    const period = await prisma.school_periods.upsert({
      where: { year: 1998 },
      update: {},
      create: {
        year: 1998,
        start_date: new Date('1998-01-01'),
        end_date: new Date('1998-12-31'),
        status: 'CLOSED',
      },
    });
    const family = await prisma.family_groups.upsert({
      where: { code: 'E2E-BACKUP' },
      update: {},
      create: { code: 'E2E-BACKUP', name: 'E2E Backup Fixture' },
    });

    await prisma.$transaction(async (transaction) => {
      const payment = await transaction.payments.create({
        data: {
          school_period_id: period.id,
          family_group_id: family.id,
          registered_by_user_id: user.id,
          payment_date: new Date('1998-06-15'),
          operation_number: 'E2E-BACKUP-FIXTURE',
        },
      });
      const familyItem = await transaction.payment_family_items.create({
        data: {
          payment_id: payment.id,
          school_period_id: period.id,
          family_group_id: family.id,
        },
      });
      const voucher = await transaction.vouchers.create({
        data: {
          payment_id: payment.id,
          original_name: physicalName,
          physical_name: physicalName,
          file_path: absolutePath,
          mime_type: 'application/pdf',
          file_size: BigInt(contents.length),
          file_hash: createHash('sha256').update(contents).digest('hex'),
        },
      });
      await transaction.voucher_family_items.create({
        data: {
          voucher_id: voucher.id,
          payment_id: payment.id,
          payment_family_item_id: familyItem.id,
        },
      });
    });
  }
} finally {
  await prisma.$disconnect();
}

console.log(`Fixture de backup preparado en ${databaseName}.`);
