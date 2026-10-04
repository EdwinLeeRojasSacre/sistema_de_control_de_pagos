import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import {
  access,
  unlink,
} from 'node:fs/promises';

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  PrismaService,
} from '../prisma/prisma.service.js';

import {
  PaymentVouchersService,
} from './payment-vouchers.service.js';

vi.mock(
  'node:fs/promises',
  () => ({
    access: vi.fn(),
    unlink: vi.fn(),
  }),
);

const PAYMENT_ID =
  '11111111-1111-4111-8111-111111111111';

const VOUCHER_ID =
  '22222222-2222-4222-8222-222222222222';

const FAMILY_ITEM_ID =
  '33333333-3333-4333-8333-333333333333';

const STUDENT_ITEM_ID =
  '44444444-4444-4444-8444-444444444444';

const STUDENT_ID =
  '55555555-5555-4555-8555-555555555555';

const OTHER_STUDENT_ID =
  '66666666-6666-4666-8666-666666666666';

const USER_ID =
  '77777777-7777-4777-8777-777777777777';

const auditContext = {
  userId: USER_ID,
  ipAddress: '127.0.0.1',
  deviceName: 'vitest',
};

function createStudentItem() {
  return {
    id: STUDENT_ITEM_ID,
    payment_id: PAYMENT_ID,
    school_period_id:
      '88888888-8888-4888-8888-888888888888',
    family_group_id:
      '99999999-9999-4999-8999-999999999999',
    student_id: STUDENT_ID,
    created_at: new Date(
      '2026-09-13T00:00:00.000Z',
    ),

    students: {
      id: STUDENT_ID,
      person_id:
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      student_code: null,
      is_active: true,
      created_at: new Date(
        '2026-09-13T00:00:00.000Z',
      ),
      updated_at: new Date(
        '2026-09-13T00:00:00.000Z',
      ),

      persons: {
        id:
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',

        document_type:
          'DNI',

        document_number:
          '12345678',

        first_name:
          'Juan',

        last_name_father:
          'Pérez',

        last_name_mother:
          'García',

        birth_date:
          null,

        gender:
          null,

        phone:
          null,

        email:
          null,

        address:
          null,

        is_active:
          true,

        created_at:
          new Date(
            '2026-09-13T00:00:00.000Z',
          ),

        updated_at:
          new Date(
            '2026-09-13T00:00:00.000Z',
          ),
      },
    },
  };
}

function createVoucherMetadata() {
  return {
    id: VOUCHER_ID,
    payment_id:
      PAYMENT_ID,

    original_name:
      'voucher.pdf',

    physical_name:
      'voucher-test.pdf',

    file_path:
      'storage/vouchers/voucher-test.pdf',

    mime_type:
      'application/pdf',

    file_size:
      BigInt(1024),

    file_hash:
      'abc123',

    uploaded_at:
      new Date(
        '2026-09-13T00:00:00.000Z',
      ),
  };
}

describe(
  'PaymentVouchersService',
  () => {
    let service:
      PaymentVouchersService;

    let transaction: {
      vouchers: {
        findFirst:
          ReturnType<typeof vi.fn>;
        delete:
          ReturnType<typeof vi.fn>;
      };

      payments: {
        findUnique:
          ReturnType<typeof vi.fn>;
      };

      voucher_family_items: {
        count:
          ReturnType<typeof vi.fn>;
        deleteMany:
          ReturnType<typeof vi.fn>;
        create:
          ReturnType<typeof vi.fn>;
      };

      voucher_student_items: {
        count:
          ReturnType<typeof vi.fn>;
        deleteMany:
          ReturnType<typeof vi.fn>;
        createMany:
          ReturnType<typeof vi.fn>;
      };

      payment_family_items: {
        deleteMany:
          ReturnType<typeof vi.fn>;
      };

      payment_student_items: {
        deleteMany:
          ReturnType<typeof vi.fn>;
      };

      audit_logs: {
        create:
          ReturnType<typeof vi.fn>;
      };
    };

    let prisma: {
      vouchers: {
        findFirst:
          ReturnType<typeof vi.fn>;
      };

      $transaction:
        ReturnType<typeof vi.fn>;
    };

    beforeEach(
      () => {
        vi.clearAllMocks();

        vi.mocked(
          access,
        ).mockResolvedValue(
          undefined,
        );

        vi.mocked(
          unlink,
        ).mockResolvedValue(
          undefined,
        );

        transaction = {
          vouchers: {
            findFirst:
              vi.fn(),

            delete:
              vi.fn(),
          },

          payments: {
            findUnique:
              vi.fn(),
          },

          voucher_family_items:
            {
              count:
                vi.fn(),

              deleteMany:
                vi.fn(),

              create:
                vi.fn(),
            },

          voucher_student_items:
            {
              count:
                vi.fn(),

              deleteMany:
                vi.fn(),

              createMany:
                vi.fn(),
            },

          payment_family_items:
            {
              deleteMany:
                vi.fn(),
            },

          payment_student_items:
            {
              deleteMany:
                vi.fn(),
            },

          audit_logs: {
            create:
              vi.fn(),
          },
        };

        prisma = {
          vouchers: {
            findFirst:
              vi.fn(),
          },

          $transaction:
            vi.fn(
              (
                callback: (
                  client:
                    typeof transaction,
                ) => unknown,
              ) =>
                callback(
                  transaction,
                ),
            ),
        };

        service =
          new PaymentVouchersService(
            prisma as unknown as
              PrismaService,
          );
      },
    );

    // ==========================================================
    // ARCHIVOS
    // ==========================================================

    it(
      'permite visualizar un PDF inline',
      async () => {
        prisma
          .vouchers
          .findFirst
          .mockResolvedValue({
            id:
              VOUCHER_ID,

            original_name:
              'voucher.pdf',

            file_path:
              'storage/vouchers/voucher.pdf',

            mime_type:
              'application/pdf',

            file_size:
              BigInt(2048),
          });

        const result =
          await service
            .getVoucherFile(
              PAYMENT_ID,
              VOUCHER_ID,
              'view',
            );

        expect(
          result,
        ).toEqual(
          expect.objectContaining({
            originalName:
              'voucher.pdf',

            mimeType:
              'application/pdf',

            fileSize:
              2048,

            disposition:
              'inline',
          }),
        );

        expect(
          access,
        ).toHaveBeenCalledOnce();
      },
    );

    it(
      'permite visualizar una imagen inline',
      async () => {
        prisma
          .vouchers
          .findFirst
          .mockResolvedValue({
            id:
              VOUCHER_ID,

            original_name:
              'voucher.png',

            file_path:
              'storage/vouchers/voucher.png',

            mime_type:
              'image/png',

            file_size:
              BigInt(512),
          });

        const result =
          await service
            .getVoucherFile(
              PAYMENT_ID,
              VOUCHER_ID,
              'view',
            );

        expect(
          result.disposition,
        ).toBe(
          'inline',
        );

        expect(
          result.mimeType,
        ).toBe(
          'image/png',
        );
      },
    );

    it(
      'rechaza vista previa de un MIME no soportado',
      async () => {
        prisma
          .vouchers
          .findFirst
          .mockResolvedValue({
            id:
              VOUCHER_ID,

            original_name:
              'voucher.bin',

            file_path:
              'storage/vouchers/voucher.bin',

            mime_type:
              'application/octet-stream',

            file_size:
              BigInt(512),
          });

        await expect(
          service
            .getVoucherFile(
              PAYMENT_ID,
              VOUCHER_ID,
              'view',
            ),
        ).rejects
          .toBeInstanceOf(
            BadRequestException,
          );

        expect(
          access,
        ).not
          .toHaveBeenCalled();
      },
    );

    it(
      'devuelve 404 cuando el voucher no pertenece al payment',
      async () => {
        prisma
          .vouchers
          .findFirst
          .mockResolvedValue(
            null,
          );

        await expect(
          service
            .getVoucherFile(
              PAYMENT_ID,
              VOUCHER_ID,
              'download',
            ),
        ).rejects
          .toBeInstanceOf(
            NotFoundException,
          );
      },
    );

    // ==========================================================
    // CONSULTA DE ASOCIACIONES
    // ==========================================================

    it(
      'devuelve APAFA y Talleres asociados al voucher',
      async () => {
        const studentItem =
          createStudentItem();

        prisma
          .vouchers
          .findFirst
          .mockResolvedValue({
            id:
              VOUCHER_ID,

            payment_id:
              PAYMENT_ID,

            voucher_family_items:
              [
                {
                  payment_family_item_id:
                    FAMILY_ITEM_ID,

                  payment_family_items:
                    {
                      id:
                        FAMILY_ITEM_ID,
                    },
                },
              ],

            voucher_student_items:
              [
                {
                  payment_student_item_id:
                    STUDENT_ITEM_ID,

                  payment_student_items:
                    studentItem,
                },
              ],
          });

        const result =
          await service
            .getVoucherLinks(
              PAYMENT_ID,
              VOUCHER_ID,
            );

        expect(
          result,
        ).toEqual({
          voucherId:
            VOUCHER_ID,

          paymentId:
            PAYMENT_ID,

          includeApafa:
            true,

          students: [
            {
              studentId:
                STUDENT_ID,

              studentName:
                'Juan Pérez García',
            },
          ],
        });
      },
    );

    // ==========================================================
    // ACTUALIZAR ASOCIACIONES
    // ==========================================================

    it(
      'rechaza asociar un Taller que no pertenece al payment',
      async () => {
        transaction
          .vouchers
          .findFirst
          .mockResolvedValue({
            id:
              VOUCHER_ID,

            payment_id:
              PAYMENT_ID,

            voucher_family_items:
              [],

            voucher_student_items:
              [],
          });

        transaction
          .payments
          .findUnique
          .mockResolvedValue({
            id:
              PAYMENT_ID,

            family_items:
              [],

            student_items:
              [
                createStudentItem(),
              ],
          });

        await expect(
          service
            .updateVoucherLinks(
              PAYMENT_ID,
              VOUCHER_ID,
              {
                includeApafa:
                  false,

                studentIds: [
                  OTHER_STUDENT_ID,
                ],
              },
              auditContext,
            ),
        ).rejects
          .toBeInstanceOf(
            BadRequestException,
          );

        expect(
          transaction
            .voucher_student_items
            .createMany,
        ).not
          .toHaveBeenCalled();

        expect(
          transaction
            .audit_logs
            .create,
        ).not
          .toHaveBeenCalled();
      },
    );

    it(
      'permite mantener la asociación propia de APAFA',
      async () => {
        transaction
          .vouchers
          .findFirst
          .mockResolvedValue({
            id:
              VOUCHER_ID,

            payment_id:
              PAYMENT_ID,

            voucher_family_items:
              [
                {
                  payment_family_item_id:
                    FAMILY_ITEM_ID,
                },
              ],

            voucher_student_items:
              [],
          });

        transaction
          .payments
          .findUnique
          .mockResolvedValue({
            id:
              PAYMENT_ID,

            family_items: [
              {
                id:
                  FAMILY_ITEM_ID,

                payment_id:
                  PAYMENT_ID,
              },
            ],

            student_items:
              [],
          });

        transaction
          .voucher_family_items
          .count
          .mockResolvedValue(
            0,
          );

        prisma
          .vouchers
          .findFirst
          .mockResolvedValue({
            id:
              VOUCHER_ID,

            payment_id:
              PAYMENT_ID,

            voucher_family_items:
              [],

            voucher_student_items:
              [],
          });

        const result =
          await service
            .updateVoucherLinks(
              PAYMENT_ID,
              VOUCHER_ID,
              {
                includeApafa:
                  true,

                studentIds:
                  [],
              },
              auditContext,
            );

        expect(
          transaction
            .payment_family_items
            .deleteMany,
        ).not.toHaveBeenCalled();

        expect(
          result
            .revertedApafa,
        ).toBe(
          false,
        );

        expect(
          transaction
            .audit_logs
            .create,
        ).toHaveBeenCalledWith({
          data:
            expect.objectContaining({
              user_id:
                USER_ID,

              entity_name:
                'vouchers',

              entity_id:
                VOUCHER_ID,

              action:
                'UPDATE_LINKS',
            }),
        });
      },
    );

    it(
      'permite mantener APAFA en su propio voucher sin otro vínculo',
      async () => {
        transaction
          .vouchers
          .findFirst
          .mockResolvedValue({
            id:
              VOUCHER_ID,

            payment_id:
              PAYMENT_ID,

            voucher_family_items:
              [
                {
                  payment_family_item_id:
                    FAMILY_ITEM_ID,
                },
              ],

            voucher_student_items:
              [],
          });

        transaction
          .payments
          .findUnique
          .mockResolvedValue({
            id:
              PAYMENT_ID,

            family_items: [
              {
                id:
                  FAMILY_ITEM_ID,

                payment_id:
                  PAYMENT_ID,
              },
            ],

            student_items:
              [],
          });

        /*
         * Existe otro voucher que continúa
         * respaldando APAFA.
         */
        transaction
          .voucher_family_items
          .count
          .mockResolvedValue(0);

        prisma
          .vouchers
          .findFirst
          .mockResolvedValue({
            id:
              VOUCHER_ID,

            payment_id:
              PAYMENT_ID,

            voucher_family_items:
              [],

            voucher_student_items:
              [],
          });

        const result =
          await service
            .updateVoucherLinks(
              PAYMENT_ID,
              VOUCHER_ID,
              {
                includeApafa:
                  true,

                studentIds:
                  [],
              },
              auditContext,
            );

        expect(
          transaction
            .payment_family_items
            .deleteMany,
        ).not
          .toHaveBeenCalled();

        expect(
          result
            .revertedApafa,
        ).toBe(
          false,
        );
      },
    );

    it(
      'permite mantener el Taller en su propio voucher',
      async () => {
        const studentItem =
          createStudentItem();

        transaction
          .vouchers
          .findFirst
          .mockResolvedValue({
            id:
              VOUCHER_ID,

            payment_id:
              PAYMENT_ID,

            voucher_family_items:
              [],

            voucher_student_items:
              [
                {
                  payment_student_item_id:
                    STUDENT_ITEM_ID,

                  payment_student_items:
                    studentItem,
                },
              ],
          });

        transaction
          .payments
          .findUnique
          .mockResolvedValue({
            id:
              PAYMENT_ID,

            family_items:
              [],

            student_items:
              [
                studentItem,
              ],
          });

        transaction
          .voucher_student_items
          .count
          .mockResolvedValue(
            0,
          );

        prisma
          .vouchers
          .findFirst
          .mockResolvedValue({
            id:
              VOUCHER_ID,

            payment_id:
              PAYMENT_ID,

            voucher_family_items:
              [],

            voucher_student_items:
              [],
          });

        const result =
          await service
            .updateVoucherLinks(
              PAYMENT_ID,
              VOUCHER_ID,
              {
                includeApafa:
                  false,

                studentIds: [STUDENT_ID],
              },
              auditContext,
            );

        expect(
          transaction
            .payment_student_items
            .deleteMany,
        ).not.toHaveBeenCalled();

        expect(
          result
            .revertedStudentIds,
        ).toEqual([]);
      },
    );

    // ==========================================================
    // ELIMINACIÓN
    // ==========================================================

    it('rechaza dejar un voucher sin asociaciones y no audita', async () => {
      await expect(service.updateVoucherLinks(
        PAYMENT_ID, VOUCHER_ID,
        { includeApafa: false, studentIds: [] }, auditContext,
      )).rejects.toBeInstanceOf(BadRequestException);
      expect(transaction.audit_logs.create).not.toHaveBeenCalled();
    });

    it.each([
      { includeApafa: true, studentIds: [] as string[], conflict: 'family' },
      { includeApafa: false, studentIds: [STUDENT_ID], conflict: 'student' },
    ])('rechaza un concepto asociado a otro voucher ($conflict)', async ({ includeApafa, studentIds, conflict }) => {
      const studentItem = createStudentItem();
      transaction.vouchers.findFirst.mockResolvedValue({
        id: VOUCHER_ID, payment_id: PAYMENT_ID,
        voucher_family_items: [], voucher_student_items: [],
      });
      transaction.payments.findUnique.mockResolvedValue({
        id: PAYMENT_ID,
        family_items: [{ id: FAMILY_ITEM_ID, payment_id: PAYMENT_ID }],
        student_items: [studentItem],
      });
      transaction.voucher_family_items.count.mockResolvedValue(conflict === 'family' ? 1 : 0);
      transaction.voucher_student_items.count.mockResolvedValue(conflict === 'student' ? 1 : 0);

      await expect(service.updateVoucherLinks(
        PAYMENT_ID, VOUCHER_ID, { includeApafa, studentIds }, auditContext,
      )).rejects.toBeInstanceOf(ConflictException);
      expect(transaction.audit_logs.create).not.toHaveBeenCalled();
    });

    it(
      'elimina un voucher general sin desmarcar APAFA ni Taller',
      async () => {
        prisma
          .vouchers
          .findFirst
          .mockResolvedValue(
            createVoucherMetadata(),
          );

        transaction
          .vouchers
          .findFirst
          .mockResolvedValue({
            ...createVoucherMetadata(),

            voucher_family_items:
              [],

            voucher_student_items:
              [],
          });

        transaction
          .vouchers
          .delete
          .mockResolvedValue({
            id:
              VOUCHER_ID,
          });

        const result =
          await service
            .deleteVoucher(
              PAYMENT_ID,
              VOUCHER_ID,
              auditContext,
            );

        expect(
          result,
        ).toEqual({
          paymentId:
            PAYMENT_ID,

          voucherId:
            VOUCHER_ID,

          revertedApafa:
            false,

          revertedStudentIds:
            [],
        });

        expect(
          transaction
            .payment_family_items
            .deleteMany,
        ).not
          .toHaveBeenCalled();

        expect(
          transaction
            .payment_student_items
            .deleteMany,
        ).not
          .toHaveBeenCalled();

        expect(
          transaction
            .vouchers
            .delete,
        ).toHaveBeenCalledWith({
          where: {
            id:
              VOUCHER_ID,
          },
        });

        expect(
          unlink,
        ).toHaveBeenCalledOnce();
      },
    );

    it(
      'elimina el último voucher de APAFA y revierte APAFA',
      async () => {
        prisma
          .vouchers
          .findFirst
          .mockResolvedValue(
            createVoucherMetadata(),
          );

        transaction
          .vouchers
          .findFirst
          .mockResolvedValue({
            ...createVoucherMetadata(),

            voucher_family_items:
              [
                {
                  payment_family_item_id:
                    FAMILY_ITEM_ID,
                },
              ],

            voucher_student_items:
              [],
          });

        transaction
          .voucher_family_items
          .count
          .mockResolvedValue(
            0,
          );

        const result =
          await service
            .deleteVoucher(
              PAYMENT_ID,
              VOUCHER_ID,
              auditContext,
            );

        expect(
          transaction
            .payment_family_items
            .deleteMany,
        ).toHaveBeenCalledWith({
          where: {
            payment_id:
              PAYMENT_ID,

            id: {
              in: [
                FAMILY_ITEM_ID,
              ],
            },
          },
        });

        expect(
          result
            .revertedApafa,
        ).toBe(
          true,
        );
      },
    );

    it(
      'elimina un voucher de APAFA pero mantiene PAGADO si existe otra evidencia específica',
      async () => {
        prisma
          .vouchers
          .findFirst
          .mockResolvedValue(
            createVoucherMetadata(),
          );

        transaction
          .vouchers
          .findFirst
          .mockResolvedValue({
            ...createVoucherMetadata(),

            voucher_family_items:
              [
                {
                  payment_family_item_id:
                    FAMILY_ITEM_ID,
                },
              ],

            voucher_student_items:
              [],
          });

        transaction
          .voucher_family_items
          .count
          .mockResolvedValue(
            1,
          );

        const result =
          await service
            .deleteVoucher(
              PAYMENT_ID,
              VOUCHER_ID,
              auditContext,
            );

        expect(
          transaction
            .payment_family_items
            .deleteMany,
        ).not
          .toHaveBeenCalled();

        expect(
          result
            .revertedApafa,
        ).toBe(
          false,
        );
      },
    );

    it(
      'elimina el último voucher de un Taller y revierte solo ese estudiante',
      async () => {
        const studentItem =
          createStudentItem();

        prisma
          .vouchers
          .findFirst
          .mockResolvedValue(
            createVoucherMetadata(),
          );

        transaction
          .vouchers
          .findFirst
          .mockResolvedValue({
            ...createVoucherMetadata(),

            voucher_family_items:
              [],

            voucher_student_items:
              [
                {
                  payment_student_item_id:
                    STUDENT_ITEM_ID,

                  payment_student_items:
                    studentItem,
                },
              ],
          });

        transaction
          .voucher_student_items
          .count
          .mockResolvedValue(
            0,
          );

        const result =
          await service
            .deleteVoucher(
              PAYMENT_ID,
              VOUCHER_ID,
              auditContext,
            );

        expect(
          transaction
            .payment_student_items
            .deleteMany,
        ).toHaveBeenCalledWith({
          where: {
            payment_id:
              PAYMENT_ID,

            id: {
              in: [
                STUDENT_ITEM_ID,
              ],
            },
          },
        });

        expect(
          result
            .revertedStudentIds,
        ).toEqual([
          STUDENT_ID,
        ]);
      },
    );

    it(
      'registra auditoría al eliminar un voucher',
      async () => {
        prisma
          .vouchers
          .findFirst
          .mockResolvedValue(
            createVoucherMetadata(),
          );

        transaction
          .vouchers
          .findFirst
          .mockResolvedValue({
            ...createVoucherMetadata(),

            voucher_family_items:
              [],

            voucher_student_items:
              [],
          });

        await service
          .deleteVoucher(
            PAYMENT_ID,
            VOUCHER_ID,
            auditContext,
          );

        expect(
          transaction
            .audit_logs
            .create,
        ).toHaveBeenCalledWith({
          data:
            expect.objectContaining({
              user_id:
                USER_ID,

              entity_name:
                'vouchers',

              entity_id:
                VOUCHER_ID,

              action:
                'DELETE',

              ip_address:
                '127.0.0.1',

              device_name:
                'vitest',
            }),
        });
      },
    );

    it(
      'permite eliminar de la BD aunque el archivo físico ya no exista',
      async () => {
        prisma
          .vouchers
          .findFirst
          .mockResolvedValue(
            createVoucherMetadata(),
          );

        transaction
          .vouchers
          .findFirst
          .mockResolvedValue({
            ...createVoucherMetadata(),

            voucher_family_items:
              [],

            voucher_student_items:
              [],
          });

        const missingFileError =
          Object.assign(
            new Error(
              'File not found',
            ),
            {
              code:
                'ENOENT',
            },
          );

        vi.mocked(
          unlink,
        ).mockRejectedValue(
          missingFileError,
        );

        await expect(
          service
            .deleteVoucher(
              PAYMENT_ID,
              VOUCHER_ID,
              auditContext,
            ),
        ).resolves.toEqual({
          paymentId:
            PAYMENT_ID,

          voucherId:
            VOUCHER_ID,

          revertedApafa:
            false,

          revertedStudentIds:
            [],
        });

        expect(
          transaction
            .vouchers
            .delete,
        ).toHaveBeenCalled();
      },
    );
  },
);
