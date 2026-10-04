import { Module } from '@nestjs/common';

import { PaymentVouchersService } from './payment-vouchers.service.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';

@Module({
  controllers: [
    PaymentsController,
  ],

  providers: [
    PaymentsService,
    PaymentVouchersService,
  ],

  exports: [
    PaymentsService,
    PaymentVouchersService,
  ],
})
export class PaymentsModule {}