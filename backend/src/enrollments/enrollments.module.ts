import { Module } from '@nestjs/common';

import { EnrollmentsController } from './enrollments.controller.js';
import { EnrollmentsService } from './enrollments.service.js';
import { EnrollmentsImportService } from './enrollments-import.service.js';

@Module({
  controllers: [EnrollmentsController],
  providers: [EnrollmentsService, EnrollmentsImportService],
  exports: [EnrollmentsService],
})
export class EnrollmentsModule {}
