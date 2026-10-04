import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { access, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe.sequential('Payment voucher rules against sgpe_dev', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const runId = randomUUID().slice(0, 8);
  const paymentIds: string[] = [];
  const voucherPaths: string[] = [];
  let token = '';
  let userId = '';
  let personId = '';
  let familyId = '';
  let periodId = '';
  let paymentId = '';
  let voucherId = '';
  let otherVoucherId = '';
  let paymentDate = '';

  const auth = () => ({ Authorization: `Bearer ${token}` });
  const pdf = () => Buffer.from('%PDF-1.4 E2E SGPE voucher');
  const postPayment = (associations: unknown[], files = associations.length, studentIds: string[] = []) => {
    let call = request(app.getHttpServer()).post('/payments').set(auth())
      .field('schoolPeriodId', periodId).field('familyGroupId', familyId)
      .field('paymentDate', paymentDate).field('includeApafa', 'true')
      .field('studentIds', JSON.stringify(studentIds))
      .field('voucherAssociations', JSON.stringify(associations));
    for (let index = 0; index < files; index += 1) {
      call = call.attach('vouchers', pdf(), { filename: `e2e-${runId}-${index}.pdf`, contentType: 'application/pdf' });
    }
    return call;
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    const [database] = await prisma.$queryRaw<Array<{ current_database: string }>>`SELECT current_database()`;
    if (database?.current_database !== 'sgpe_dev') throw new Error(`Database E2E bloqueada: ${database?.current_database ?? 'desconocida'}`);

    const role = await prisma.roles.findUniqueOrThrow({ where: { code: 'ADMINISTRADOR' } });
    const person = await prisma.persons.create({ data: { document_type: 'E2E', document_number: `${runId}-pay`, first_name: 'Payment E2E' } });
    personId = person.id;
    const user = await prisma.users.create({ data: { person_id: person.id, role_id: role.id, username: `e2e_pay_${runId}`, password_hash: await bcrypt.hash('RegressionA1!', 10), must_change_password: false } });
    userId = user.id;
    token = (await request(app.getHttpServer()).post('/auth/login').send({ username: user.username, password: 'RegressionA1!' }).expect(201)).body.access_token;
    const lowest = await prisma.school_periods.aggregate({ _min: { year: true } });
    const year = (lowest._min.year ?? 2000) - 1;
    paymentDate = `${year}-09-13`;
    periodId = (await prisma.school_periods.create({ data: { year, start_date: new Date(`${year}-01-01`), end_date: new Date(`${year}-12-31`), status: 'OPEN' } })).id;
    familyId = (await prisma.family_groups.create({ data: { code: `E2E-PAY-${runId}`, name: `E2E Payment ${runId}` } })).id;
  });

  afterAll(async () => {
    if (prisma) {
      const vouchers = await prisma.vouchers.findMany({ where: { payment_id: { in: paymentIds } }, select: { file_path: true } });
      voucherPaths.push(...vouchers.map((item) => item.file_path));
      await prisma.voucher_family_items.deleteMany({ where: { payment_id: { in: paymentIds } } });
      await prisma.voucher_student_items.deleteMany({ where: { payment_id: { in: paymentIds } } });
      await prisma.vouchers.deleteMany({ where: { payment_id: { in: paymentIds } } });
      await prisma.payment_family_items.deleteMany({ where: { payment_id: { in: paymentIds } } });
      await prisma.payment_student_items.deleteMany({ where: { payment_id: { in: paymentIds } } });
      await prisma.audit_logs.deleteMany({ where: { OR: [{ user_id: userId }, { entity_id: { in: [...paymentIds, voucherId, otherVoucherId].filter(Boolean) } }] } });
      await prisma.payments.deleteMany({ where: { id: { in: paymentIds } } });
      await prisma.users.delete({ where: { id: userId } });
      await prisma.persons.delete({ where: { id: personId } });
      await prisma.family_groups.delete({ where: { id: familyId } });
      await prisma.school_periods.delete({ where: { id: periodId } });
      for (const path of voucherPaths) await unlink(path).catch(() => undefined);
      expect(await prisma.payments.count({ where: { id: { in: paymentIds } } })).toBe(0);
      for (const path of voucherPaths) await expect(access(path)).rejects.toBeDefined();
    }
    await app?.close();
  });

  it('confirms sgpe_dev has no pre-existing invalid voucher associations', async () => {
    const [result] = await prisma.$queryRaw<Array<{
      empty_vouchers: bigint;
      duplicate_family_items: bigint;
      duplicate_student_items: bigint;
    }>>`
      SELECT
        (SELECT COUNT(*) FROM vouchers v
          WHERE NOT EXISTS (SELECT 1 FROM voucher_family_items vf WHERE vf.voucher_id = v.id)
            AND NOT EXISTS (SELECT 1 FROM voucher_student_items vs WHERE vs.voucher_id = v.id)) AS empty_vouchers,
        (SELECT COUNT(*) FROM (
          SELECT payment_family_item_id FROM voucher_family_items GROUP BY payment_family_item_id HAVING COUNT(*) > 1
        ) duplicated_family) AS duplicate_family_items,
        (SELECT COUNT(*) FROM (
          SELECT payment_student_item_id FROM voucher_student_items GROUP BY payment_student_item_id HAVING COUNT(*) > 1
        ) duplicated_student) AS duplicate_student_items
    `;
    const emptyVouchers = await prisma.vouchers.findMany({
      where: { voucher_family_items: { none: {} }, voucher_student_items: { none: {} } },
      select: { id: true, payment_id: true, original_name: true, file_path: true },
    });
    expect(emptyVouchers, JSON.stringify(emptyVouchers)).toEqual([]);
    expect(Number(result.duplicate_family_items)).toBe(0);
    expect(Number(result.duplicate_student_items)).toBe(0);
  });

  it('rejects duplicate APAFA, duplicate Taller, empty voucher and incomplete coverage without residue', async () => {
    const fakeStudent = randomUUID();
    const cases = [
      () => postPayment([{ includeApafa: true, studentIds: [] }, { includeApafa: true, studentIds: [] }], 2),
      () => postPayment([{ includeApafa: false, studentIds: [fakeStudent] }, { includeApafa: false, studentIds: [fakeStudent] }], 2, [fakeStudent]),
      () => postPayment([{ includeApafa: false, studentIds: [] }]),
      () => postPayment([{ includeApafa: false, studentIds: [fakeStudent] }]),
    ];
    for (const createCall of cases) await createCall().expect(400);
    expect(await prisma.payments.count({ where: { family_group_id: familyId } })).toBe(0);
  });

  it('creates a fully covered payment and persists one association', async () => {
    const response = await postPayment([{ includeApafa: true, studentIds: [] }]);
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    paymentId = response.body.id;
    paymentIds.push(paymentId);
    const voucher = await prisma.vouchers.findFirstOrThrow({ where: { payment_id: paymentId } });
    voucherId = voucher.id;
    expect(await prisma.voucher_family_items.count({ where: { voucher_id: voucher.id } })).toBe(1);
  });

  it('allows own PATCH, rejects conflict with another voucher, and rejects empty PATCH', async () => {
    await request(app.getHttpServer()).patch(`/payments/${paymentId}/vouchers/${voucherId}/links`).set(auth()).send({ includeApafa: true, studentIds: [] }).expect(200);
    const other = await prisma.vouchers.create({ data: { payment_id: paymentId, original_name: `e2e-empty-${runId}.pdf`, physical_name: `e2e-empty-${runId}.pdf`, file_path: `storage/vouchers/e2e-empty-${runId}.pdf`, mime_type: 'application/pdf' } });
    otherVoucherId = other.id;
    await request(app.getHttpServer()).patch(`/payments/${paymentId}/vouchers/${other.id}/links`).set(auth()).send({ includeApafa: true, studentIds: [] }).expect(409);
    await request(app.getHttpServer()).patch(`/payments/${paymentId}/vouchers/${voucherId}/links`).set(auth()).send({ includeApafa: false, studentIds: [] }).expect(400);
  });
});
