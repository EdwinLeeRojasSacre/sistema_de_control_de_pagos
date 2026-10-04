import {
  Module,
} from '@nestjs/common';

import {
  createObserveModule,
} from '@nestjs/observe';

import {
  AppController,
} from './app.controller.js';

import {
  AppService,
} from './app.service.js';

import {
  AcademicStructureModule,
} from './academic-structure/academic-structure.module.js';

import {
  AuthModule,
} from './auth/auth.module.js';

import {
  DashboardModule,
} from './dashboard/dashboard.module.js';

import {
  EnrollmentsModule,
} from './enrollments/enrollments.module.js';

import {
  FamilyGroupsModule,
} from './family-groups/family-groups.module.js';

import {
  PaymentsModule,
} from './payments/payments.module.js';

import {
  PrismaModule,
} from './prisma/prisma.module.js';

import {
  ReportsModule,
} from './reports/reports.module.js';

import {
  SchoolPeriodsModule,
} from './school-periods/school-periods.module.js';

import {
  StudentsModule,
} from './students/students.module.js';

import {
  UsersModule,
} from './users/users.module.js';

export const {
  ObserveModule,
  ObserveInstrument,
} = createObserveModule();

@Module({
  imports: [
    // Distributed tracing, auto-correlated logs, request/job metrics,
    // error telemetry, alarms, and more — out of the box.
    ObserveModule.forRoot({
      appKey:
        'YOUR_APP_KEY',

      appSecret:
        'YOUR_APP_SECRET',

      serviceId:
        'backend',
    }),

    PrismaModule,
    UsersModule,
    AuthModule,
    StudentsModule,
    FamilyGroupsModule,
    EnrollmentsModule,
    DashboardModule,
    SchoolPeriodsModule,
    AcademicStructureModule,
    PaymentsModule,
    ReportsModule,
  ],

  controllers: [
    AppController,
  ],

  providers: [
    AppService,
  ],
})
export class AppModule {}