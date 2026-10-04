import {
  Test,
  TestingModule,
} from '@nestjs/testing';

import {
  vi,
} from 'vitest';

import {
  PaymentVouchersService,
} from './payment-vouchers.service.js';

import {
  PaymentsController,
} from './payments.controller.js';

import {
  PaymentsService,
} from './payments.service.js';

describe(
  'PaymentsController',
  () => {
    let controller:
      PaymentsController;

    let paymentsService: {
      findAll:
        ReturnType<typeof vi.fn>;
      findById:
        ReturnType<typeof vi.fn>;
      getFamilyPaymentStatus:
        ReturnType<typeof vi.fn>;
      create:
        ReturnType<typeof vi.fn>;
    };

    let paymentVouchersService: {
      getVoucherFile:
        ReturnType<typeof vi.fn>;
      getVoucherLinks:
        ReturnType<typeof vi.fn>;
      updateVoucherLinks:
        ReturnType<typeof vi.fn>;
      deleteVoucher:
        ReturnType<typeof vi.fn>;
    };

    beforeEach(
      async () => {
        paymentsService = {
          findAll:
            vi.fn(),

          findById:
            vi.fn(),

          getFamilyPaymentStatus:
            vi.fn(),

          create:
            vi.fn(),
        };

        paymentVouchersService =
          {
            getVoucherFile:
              vi.fn(),

            getVoucherLinks:
              vi.fn(),

            updateVoucherLinks:
              vi.fn(),

            deleteVoucher:
              vi.fn(),
          };

        const module:
          TestingModule =
          await Test
            .createTestingModule({
              controllers: [
                PaymentsController,
              ],

              providers: [
                {
                  provide:
                    PaymentsService,

                  useValue:
                    paymentsService,
                },

                {
                  provide:
                    PaymentVouchersService,

                  useValue:
                    paymentVouchersService,
                },
              ],
            })
            .compile();

        controller =
          module.get<
            PaymentsController
          >(
            PaymentsController,
          );
      },
    );

    it(
      'should be defined',
      () => {
        expect(
          controller,
        ).toBeDefined();
      },
    );

    it(
      'returns voucher links',
      async () => {
        const expected = {
          voucherId:
            '11111111-1111-4111-8111-111111111111',

          paymentId:
            '22222222-2222-4222-8222-222222222222',

          includeApafa:
            true,

          students: [],
        };

        paymentVouchersService
          .getVoucherLinks
          .mockResolvedValue(
            expected,
          );

        await expect(
          controller
            .getVoucherLinks(
              expected
                .paymentId,

              expected
                .voucherId,
            ),
        ).resolves.toEqual(
          expected,
        );

        expect(
          paymentVouchersService
            .getVoucherLinks,
        ).toHaveBeenCalledWith(
          expected.paymentId,
          expected.voucherId,
        );
      },
    );

    it(
      'updates voucher links with audit context',
      async () => {
        const paymentId =
          '22222222-2222-4222-8222-222222222222';

        const voucherId =
          '11111111-1111-4111-8111-111111111111';

        const dto = {
          includeApafa:
            true,

          studentIds: [
            '33333333-3333-4333-8333-333333333333',
          ],
        };

        const request = {
          user: {
            sub:
              '44444444-4444-4444-8444-444444444444',

            username:
              'secretaria',

            role:
              'SECRETARIA',
          },

          ip:
            '127.0.0.1',

          get:
            vi
              .fn()
              .mockReturnValue(
                'vitest',
              ),
        };

        paymentVouchersService
          .updateVoucherLinks
          .mockResolvedValue({
            voucherId,
            paymentId,
          });

        await controller
          .updateVoucherLinks(
            paymentId,
            voucherId,
            dto,
            request as never,
          );

        expect(
          paymentVouchersService
            .updateVoucherLinks,
        ).toHaveBeenCalledWith(
          paymentId,
          voucherId,
          dto,
          {
            userId:
              request
                .user
                .sub,

            ipAddress:
              '127.0.0.1',

            deviceName:
              'vitest',
          },
        );
      },
    );

    it(
      'deletes voucher with audit context',
      async () => {
        const paymentId =
          '22222222-2222-4222-8222-222222222222';

        const voucherId =
          '11111111-1111-4111-8111-111111111111';

        const request = {
          user: {
            sub:
              '44444444-4444-4444-8444-444444444444',

            username:
              'secretaria',

            role:
              'SECRETARIA',
          },

          ip:
            '127.0.0.1',

          get:
            vi
              .fn()
              .mockReturnValue(
                'vitest',
              ),
        };

        paymentVouchersService
          .deleteVoucher
          .mockResolvedValue({
            paymentId,
            voucherId,
            revertedApafa:
              true,

            revertedStudentIds:
              [],
          });

        const result =
          await controller
            .deleteVoucher(
              paymentId,
              voucherId,
              request as never,
            );

        expect(
          result,
        ).toEqual({
          paymentId,
          voucherId,
          revertedApafa:
            true,

          revertedStudentIds:
            [],
        });

        expect(
          paymentVouchersService
            .deleteVoucher,
        ).toHaveBeenCalledWith(
          paymentId,
          voucherId,
          {
            userId:
              request
                .user
                .sub,

            ipAddress:
              '127.0.0.1',

            deviceName:
              'vitest',
          },
        );
      },
    );
  },
);