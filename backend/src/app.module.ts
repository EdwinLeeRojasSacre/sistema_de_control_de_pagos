import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';

import { AcademicStructureModule } from './academic-structure/academic-structure.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { EnrollmentsModule } from './enrollments/enrollments.module.js';
import { FamilyGroupsModule } from './family-groups/family-groups.module.js';
import { HealthModule } from './health/health.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { SchoolPeriodsModule } from './school-periods/school-periods.module.js';
import { StudentsModule } from './students/students.module.js';
import { UsersModule } from './users/users.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

export function isObserveConfigured() {
  return Boolean(
    process.env.OBSERVE_APP_KEY?.trim() &&
      process.env.OBSERVE_APP_SECRET?.trim(),
  );
}

const observeImports = isObserveConfigured()
  ? [
      ObserveModule.forRoot({
        appKey: process.env.OBSERVE_APP_KEY!,
        appSecret: process.env.OBSERVE_APP_SECRET!,
        serviceId: 'sistema-control-pagos-backend',
      }),
    ]
  : [];

@Module({
  imports: [
    ...observeImports,
    PrismaModule,
    UsersModule,
    AuthModule,
    StudentsModule,
    FamilyGroupsModule,
    HealthModule,
    EnrollmentsModule,
    DashboardModule,
    SchoolPeriodsModule,
    AcademicStructureModule,
    PaymentsModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
