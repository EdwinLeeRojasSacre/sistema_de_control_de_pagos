import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, enrollments } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service.js';
import { ChangeEnrollmentClassroomDto } from './dto/change-enrollment-classroom.dto.js';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto.js';
import { EnrollmentOptionsQueryDto } from './dto/enrollment-options-query.dto.js';
import { FindEnrollmentsQueryDto } from './dto/find-enrollments-query.dto.js';

export interface EnrollmentAuditContext {
  userId: string;
  ipAddress: string | null;
  deviceName: string | null;
}

const enrollmentInclude = Prisma.validator<Prisma.enrollmentsInclude>()({
  students: { include: { persons: true } },
  school_periods: true,
  classrooms: {
    include: {
      shifts: true,
      education_levels: { include: { education_cycles: true } },
    },
  },
});

type EnrollmentDetail = Prisma.enrollmentsGetPayload<{
  include: typeof enrollmentInclude;
}>;

@Injectable()
export class EnrollmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: FindEnrollmentsQueryDto = {}) {
    const search = query.search?.trim();
    const rows = await this.prisma.enrollments.findMany({
      where: {
        ...(query.schoolPeriodId ? { school_period_id: query.schoolPeriodId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(search
          ? {
              OR: [
                { students: { student_code: { contains: search, mode: 'insensitive' } } },
                { students: { persons: { document_number: { contains: search, mode: 'insensitive' } } } },
                { students: { persons: { first_name: { contains: search, mode: 'insensitive' } } } },
                { students: { persons: { last_name_father: { contains: search, mode: 'insensitive' } } } },
                { students: { persons: { last_name_mother: { contains: search, mode: 'insensitive' } } } },
              ],
            }
          : {}),
      },
      include: enrollmentInclude,
      orderBy: [
        { school_periods: { year: 'desc' } },
        { students: { persons: { last_name_father: 'asc' } } },
        { students: { persons: { first_name: 'asc' } } },
      ],
    });
    return rows.map((row) => this.toResponse(row));
  }

  async findById(id: string) {
    const row = await this.prisma.enrollments.findUnique({
      where: { id },
      include: enrollmentInclude,
    });
    if (!row) throw new NotFoundException('La matrícula no existe');
    return this.toResponse(row);
  }

  async findByStudent(studentId: string) {
    const student = await this.prisma.students.findUnique({
      where: { id: studentId },
      select: { id: true },
    });
    if (!student) throw new NotFoundException('El estudiante no existe');
    const rows = await this.prisma.enrollments.findMany({
      where: { student_id: studentId },
      include: enrollmentInclude,
      orderBy: { school_periods: { year: 'desc' } },
    });
    return rows.map((row) => this.toResponse(row));
  }

  async getOptions(query: EnrollmentOptionsQueryDto = {}) {
    const [periods, classrooms] = await Promise.all([
      this.prisma.school_periods.findMany({
        where: { is_active: true },
        select: { id: true, year: true, status: true, start_date: true, end_date: true },
        orderBy: { year: 'desc' },
      }),
      this.prisma.classrooms.findMany({
        where: {
          is_active: true,
          ...(query.schoolPeriodId
            ? { school_period_id: query.schoolPeriodId }
            : { school_periods: { status: 'OPEN', is_active: true } }),
        },
        include: {
          shifts: { select: { id: true, code: true, name: true } },
          education_levels: {
            select: {
              id: true,
              name: true,
              min_age_months: true,
              max_age_months: true,
              education_cycles: { select: { id: true, code: true, name: true } },
            },
          },
        },
        orderBy: [{ education_levels: { min_age_months: 'asc' } }, { name: 'asc' }],
      }),
    ]);
    return {
      schoolPeriods: periods.map((period) => ({
        id: period.id,
        year: period.year,
        status: period.status,
        startDate: period.start_date,
        endDate: period.end_date,
      })),
      classrooms: classrooms.map((room) => ({
        id: room.id,
        schoolPeriodId: room.school_period_id,
        name: room.name,
        capacity: room.capacity,
        educationLevel: {
          id: room.education_levels.id,
          name: room.education_levels.name,
          minAgeMonths: room.education_levels.min_age_months,
          maxAgeMonths: room.education_levels.max_age_months,
          cycle: room.education_levels.education_cycles,
        },
        shift: room.shifts,
      })),
    };
  }

  create(dto: CreateEnrollmentDto, context: EnrollmentAuditContext) {
    return this.runSerializable((transaction) =>
      this.createInTransaction(transaction, dto, context),
    );
  }

  async createInTransaction(
    transaction: Prisma.TransactionClient,
    dto: CreateEnrollmentDto,
    context: EnrollmentAuditContext,
  ) {
    const student = await transaction.students.findUnique({
      where: { id: dto.studentId },
      include: { persons: true },
    });
    if (!student) throw new NotFoundException('El estudiante no existe');
    if (!student.is_active || !student.persons.is_active) {
      throw new ConflictException('El estudiante está inactivo');
    }

    const membership = await transaction.family_members.findFirst({
      where: { person_id: student.person_id, family_groups: { is_active: true } },
      select: { id: true },
    });
    if (!membership) {
      throw new ConflictException('El estudiante debe pertenecer a un grupo familiar activo');
    }

    const period = await transaction.school_periods.findUnique({
      where: { id: dto.schoolPeriodId },
    });
    if (!period) throw new NotFoundException('El período escolar no existe');
    if (!period.is_active || period.status !== 'OPEN') {
      throw new ConflictException('El período escolar debe estar abierto');
    }

    const classroom = await transaction.classrooms.findUnique({
      where: { id: dto.classroomId },
      include: {
        shifts: true,
        education_levels: { include: { education_cycles: true } },
      },
    });
    if (!classroom) throw new NotFoundException('El aula no existe');
    if (!classroom.is_active) throw new ConflictException('El aula está inactiva');
    if (classroom.school_period_id !== dto.schoolPeriodId) {
      throw new ConflictException('El aula no pertenece al período escolar indicado');
    }

    const duplicate = await transaction.enrollments.findUnique({
      where: {
        student_id_school_period_id: {
          student_id: dto.studentId,
          school_period_id: dto.schoolPeriodId,
        },
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException('El estudiante ya está matriculado en este período');
    }

    const row = await transaction.enrollments.create({
      data: {
        student_id: dto.studentId,
        school_period_id: dto.schoolPeriodId,
        classroom_id: dto.classroomId,
        enrollment_date: new Date(),
        status: 'ACTIVE',
      },
      include: enrollmentInclude,
    });
    await this.audit(transaction, row, 'CREATE', null, context);
    return this.toResponse(row);
  }

  changeClassroom(id: string, dto: ChangeEnrollmentClassroomDto, context: EnrollmentAuditContext) {
    return this.runSerializable(async (transaction) => {
      const current = await transaction.enrollments.findUnique({
        where: { id },
        include: enrollmentInclude,
      });
      if (!current) throw new NotFoundException('La matrícula no existe');
      if (!current.school_periods.is_active || current.school_periods.status !== 'OPEN') {
        throw new ConflictException('Solo se puede cambiar el aula en un período abierto');
      }
      if (current.classroom_id === dto.classroomId) {
        throw new ConflictException('El estudiante ya pertenece a esta aula');
      }
      const classroom = await transaction.classrooms.findUnique({
        where: { id: dto.classroomId },
        select: { id: true, school_period_id: true, is_active: true },
      });
      if (!classroom) throw new NotFoundException('El aula no existe');
      if (!classroom.is_active) throw new ConflictException('El aula está inactiva');
      if (classroom.school_period_id !== current.school_period_id) {
        throw new ConflictException('El aula no pertenece al período de la matrícula');
      }
      const updated = await transaction.enrollments.update({
        where: { id },
        data: { classroom_id: dto.classroomId },
        include: enrollmentInclude,
      });
      await this.audit(transaction, updated, 'CLASSROOM_CHANGE', current, context);
      return this.toResponse(updated);
    });
  }

  private async audit(
    transaction: Prisma.TransactionClient,
    row: EnrollmentDetail,
    action: 'CREATE' | 'CLASSROOM_CHANGE',
    oldRow: EnrollmentDetail | null,
    context: EnrollmentAuditContext,
  ) {
    await transaction.audit_logs.create({
      data: {
        user_id: context.userId,
        entity_name: 'enrollments',
        entity_id: row.id,
        action,
        old_value: oldRow ? this.snapshot(oldRow) : Prisma.DbNull,
        new_value: this.snapshot(row),
        ip_address: context.ipAddress,
        device_name: context.deviceName,
      },
    });
  }

  private snapshot(row: enrollments): Prisma.InputJsonObject {
    return {
      studentId: row.student_id,
      schoolPeriodId: row.school_period_id,
      classroomId: row.classroom_id,
      enrollmentDate: row.enrollment_date.toISOString(),
      status: row.status,
    };
  }

  private toResponse(row: EnrollmentDetail) {
    const person = row.students.persons;
    return {
      id: row.id,
      enrollmentDate: row.enrollment_date,
      status: row.status,
      isHistorical: row.school_periods.status === 'CLOSED',
      canChangeClassroom:
        row.status === 'ACTIVE' &&
        row.school_periods.status === 'OPEN' &&
        row.school_periods.is_active,
      student: {
        id: row.students.id,
        code: row.students.student_code,
        documentType: person.document_type,
        documentNumber: person.document_number,
        firstName: person.first_name,
        lastNameFather: person.last_name_father,
        lastNameMother: person.last_name_mother,
        fullName: [person.first_name, person.last_name_father, person.last_name_mother]
          .filter(Boolean)
          .join(' '),
      },
      schoolPeriod: {
        id: row.school_periods.id,
        year: row.school_periods.year,
        status: row.school_periods.status,
      },
      classroom: {
        id: row.classrooms.id,
        name: row.classrooms.name,
        capacity: row.classrooms.capacity,
        shift: {
          id: row.classrooms.shifts.id,
          code: row.classrooms.shifts.code,
          name: row.classrooms.shifts.name,
        },
        educationLevel: {
          id: row.classrooms.education_levels.id,
          name: row.classrooms.education_levels.name,
          cycle: {
            id: row.classrooms.education_levels.education_cycles.id,
            code: row.classrooms.education_levels.education_cycles.code,
            name: row.classrooms.education_levels.education_cycles.name,
          },
        },
      },
    };
  }

  private async runSerializable<T>(
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5000,
          timeout: 15000,
        });
      } catch (error: unknown) {
        if (this.isPrismaError(error, 'P2034') && attempt < 3) continue;
        if (error instanceof HttpException) throw error;
        if (this.isPrismaError(error, 'P2002')) {
          throw new ConflictException('El estudiante ya está matriculado en este período');
        }
        if (this.isPrismaError(error, 'P2034')) {
          throw new ConflictException(
            'No se pudo completar la operación debido a concurrencia. Intente nuevamente.',
          );
        }
        if (this.isPrismaError(error, 'P2003')) {
          throw new BadRequestException('El estudiante, período o aula indicado no existe');
        }
        throw error;
      }
    }
    throw new ConflictException('No se pudo completar la operación');
  }

  private isPrismaError(error: unknown, code: string) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
  }
}
