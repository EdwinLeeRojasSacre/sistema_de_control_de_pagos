import { Module } from '@nestjs/common';

import { FamilyGroupsController } from './family-groups.controller.js';
import { FamilyGroupsService } from './family-groups.service.js';
import { FamilyGroupsImportService } from './family-groups-import.service.js';
import { EnrollmentsModule } from '../enrollments/enrollments.module.js';

@Module({
  imports: [EnrollmentsModule],
  controllers: [FamilyGroupsController],
  providers: [FamilyGroupsService, FamilyGroupsImportService],
})
export class FamilyGroupsModule {}
