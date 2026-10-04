import { Module } from '@nestjs/common';

import { SchoolPeriodsController } from './school-periods.controller.js';
import { SchoolPeriodsService } from './school-periods.service.js';

@Module({
  controllers: [SchoolPeriodsController],
  providers: [SchoolPeriodsService],
})
export class SchoolPeriodsModule {}
