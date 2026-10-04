import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async summary() {
    const students =
      await this.prisma.students.count();

    const families =
      await this.prisma.family_groups.count();

    const enrollments =
      await this.prisma.enrollments.count();

    return {
      students,
      families,
      enrollments,
    };
  }
}
``