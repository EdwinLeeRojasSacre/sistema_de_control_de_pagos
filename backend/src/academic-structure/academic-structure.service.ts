import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { classrooms, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service.js';
import { CreateClassroomDto } from './dto/create-classroom.dto.js';
import { UpdateClassroomDto } from './dto/update-classroom.dto.js';

interface AuditContext {
  userId: string;
  ipAddress: string | null;
  deviceName: string | null;
}

@Injectable()
export class AcademicStructureService {
  constructor(private readonly prisma: PrismaService) {}

  async findByPeriod(schoolPeriodId: string) {
    const [period, cycles] = await Promise.all([
      this.prisma.school_periods.findUnique({
        where: { id: schoolPeriodId },
        select: { id: true, year: true, status: true, is_active: true },
      }),
      this.prisma.education_cycles.findMany({
        include: {
          education_levels: {
            where: { is_active: true },
            include: {
              classrooms: {
                where: { school_period_id: schoolPeriodId },
                include: { shifts: true },
                orderBy: [{ name: 'asc' }, { shift_id: 'asc' }],
              },
            },
            orderBy: { min_age_months: 'asc' },
          },
        },
        orderBy: { code: 'asc' },
      }),
    ]);

    if (!period) {
      throw new NotFoundException('El período escolar no existe');
    }

    return {
      period: {
        id: period.id,
        year: period.year,
        status: period.status,
        isActive: period.is_active,
        isReadOnly: period.status === 'CLOSED',
      },
      cycles: cycles.map((cycle) => ({
        id: cycle.id,
        code: cycle.code,
        name: cycle.name,
        levels: cycle.education_levels.map((level) => ({
          id: level.id,
          name: level.name,
          minAgeMonths: level.min_age_months,
          maxAgeMonths: level.max_age_months,
          classrooms: level.classrooms.map((classroom) =>
            this.toClassroomResponse(classroom),
          ),
        })),
      })),
    };
  }

  async getOptions() {
    const [periods, levels, shifts] = await Promise.all([
      this.prisma.school_periods.findMany({
        select: { id: true, year: true, status: true, is_active: true },
        orderBy: { year: 'desc' },
      }),
      this.prisma.education_levels.findMany({
        where: { is_active: true },
        select: {
          id: true,
          name: true,
          education_cycles: { select: { id: true, code: true, name: true } },
        },
        orderBy: { min_age_months: 'asc' },
      }),
      this.prisma.shifts.findMany({
        select: { id: true, code: true, name: true },
        orderBy: { code: 'asc' },
      }),
    ]);

    return { periods, levels, shifts };
  }

  createClassroom(dto: CreateClassroomDto, context: AuditContext) {
    return this.runSerializable(async (transaction) => {
      const name = this.normalizeName(dto.name);
      const period = await this.getModifiablePeriod(
        transaction,
        dto.schoolPeriodId,
      );
      await this.validateCatalogReferences(
        transaction,
        dto.educationLevelId,
        dto.shiftId,
      );
      await this.ensureUnique(
        transaction,
        period.id,
        dto.educationLevelId,
        dto.shiftId,
        name,
      );

      const classroom = await transaction.classrooms.create({
        data: {
          school_period_id: period.id,
          education_level_id: dto.educationLevelId,
          shift_id: dto.shiftId,
          name,
          capacity: dto.capacity,
          is_active: dto.isActive ?? true,
        },
        include: { shifts: true },
      });

      await this.audit(
        transaction,
        classroom.id,
        'CREATE',
        null,
        this.snapshot(classroom),
        context,
      );
      return this.toClassroomResponse(classroom);
    });
  }

  updateClassroom(id: string, dto: UpdateClassroomDto, context: AuditContext) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException(
        'Debe enviar al menos un campo para actualizar',
      );
    }

    return this.runSerializable(async (transaction) => {
      const current = await this.getClassroom(transaction, id);
      await this.getModifiablePeriod(transaction, current.school_period_id);

      const educationLevelId =
        dto.educationLevelId ?? current.education_level_id;
      const shiftId = dto.shiftId ?? current.shift_id;
      const name = dto.name ? this.normalizeName(dto.name) : current.name;

      await this.validateCatalogReferences(
        transaction,
        educationLevelId,
        shiftId,
      );
      await this.ensureUnique(
        transaction,
        current.school_period_id,
        educationLevelId,
        shiftId,
        name,
        id,
      );

      const updated = await transaction.classrooms.update({
        where: { id },
        data: {
          education_level_id: educationLevelId,
          shift_id: shiftId,
          name,
          ...(dto.capacity === undefined ? {} : { capacity: dto.capacity }),
        },
        include: { shifts: true },
      });

      await this.audit(
        transaction,
        id,
        'UPDATE',
        this.snapshot(current),
        this.snapshot(updated),
        context,
      );
      return this.toClassroomResponse(updated);
    });
  }

  enableClassroom(id: string, context: AuditContext) {
    return this.changeAvailability(id, true, 'ENABLE', context);
  }

  disableClassroom(id: string, context: AuditContext) {
    return this.changeAvailability(id, false, 'DISABLE', context);
  }

  private changeAvailability(
    id: string,
    isActive: boolean,
    action: 'ENABLE' | 'DISABLE',
    context: AuditContext,
  ) {
    return this.runSerializable(async (transaction) => {
      const current = await this.getClassroom(transaction, id);
      await this.getModifiablePeriod(transaction, current.school_period_id);

      if (current.is_active === isActive) {
        throw new ConflictException(
          `El aula ya está ${isActive ? 'habilitada' : 'deshabilitada'}`,
        );
      }

      const updated = await transaction.classrooms.update({
        where: { id },
        data: { is_active: isActive },
        include: { shifts: true },
      });
      await this.audit(
        transaction,
        id,
        action,
        this.snapshot(current),
        this.snapshot(updated),
        context,
      );
      return this.toClassroomResponse(updated);
    });
  }

  private async getModifiablePeriod(
    transaction: Prisma.TransactionClient,
    id: string,
  ) {
    const period = await transaction.school_periods.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!period) throw new NotFoundException('El período escolar no existe');
    if (period.status === 'CLOSED') {
      throw new ConflictException(
        'La estructura de un período cerrado es histórica y no puede modificarse',
      );
    }
    if (period.status !== 'PLANNED' && period.status !== 'OPEN') {
      throw new ConflictException(
        'El estado del período no permite modificar su estructura',
      );
    }
    return period;
  }

  private async getClassroom(
    transaction: Prisma.TransactionClient,
    id: string,
  ) {
    const classroom = await transaction.classrooms.findUnique({
      where: { id },
      include: { shifts: true },
    });
    if (!classroom) throw new NotFoundException('El aula no existe');
    return classroom;
  }

  private async validateCatalogReferences(
    transaction: Prisma.TransactionClient,
    educationLevelId: string,
    shiftId: string,
  ) {
    const [level, shift] = await Promise.all([
      transaction.education_levels.findFirst({
        where: { id: educationLevelId, is_active: true },
        select: { id: true },
      }),
      transaction.shifts.findUnique({
        where: { id: shiftId },
        select: { id: true },
      }),
    ]);
    if (!level)
      throw new BadRequestException(
        'El nivel indicado no existe o está inactivo',
      );
    if (!shift) throw new BadRequestException('El turno indicado no existe');
  }

  private async ensureUnique(
    transaction: Prisma.TransactionClient,
    schoolPeriodId: string,
    educationLevelId: string,
    shiftId: string,
    name: string,
    excludedId?: string,
  ) {
    const duplicate = await transaction.classrooms.findFirst({
      where: {
        school_period_id: schoolPeriodId,
        education_level_id: educationLevelId,
        shift_id: shiftId,
        name: { equals: name, mode: 'insensitive' },
        ...(excludedId ? { id: { not: excludedId } } : {}),
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException(
        'Ya existe un aula con el mismo nombre, nivel y turno en este período',
      );
    }
  }

  private normalizeName(name: string) {
    const normalized = name.trim().replace(/\s+/g, ' ');
    if (!normalized)
      throw new BadRequestException('El nombre del aula es obligatorio');
    return normalized;
  }

  private async audit(
    transaction: Prisma.TransactionClient,
    entityId: string,
    action: 'CREATE' | 'UPDATE' | 'ENABLE' | 'DISABLE',
    oldValue: Prisma.InputJsonValue | null,
    newValue: Prisma.InputJsonValue,
    context: AuditContext,
  ) {
    await transaction.audit_logs.create({
      data: {
        user_id: context.userId,
        entity_name: 'classrooms',
        entity_id: entityId,
        action,
        old_value: oldValue === null ? Prisma.DbNull : oldValue,
        new_value: newValue,
        ip_address: context.ipAddress,
        device_name: context.deviceName,
      },
    });
  }

  private snapshot(classroom: classrooms): Prisma.InputJsonObject {
    return {
      schoolPeriodId: classroom.school_period_id,
      educationLevelId: classroom.education_level_id,
      shiftId: classroom.shift_id,
      name: classroom.name,
      capacity: classroom.capacity ?? null,
      isActive: classroom.is_active,
    };
  }

  private toClassroomResponse(
    classroom: classrooms & {
      shifts: { id: string; code: string; name: string };
    },
  ) {
    return {
      id: classroom.id,
      schoolPeriodId: classroom.school_period_id,
      educationLevelId: classroom.education_level_id,
      name: classroom.name,
      capacity: classroom.capacity,
      isActive: classroom.is_active,
      shift: classroom.shifts,
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
          throw new ConflictException(
            'Ya existe un aula con el mismo nombre, nivel y turno en este período',
          );
        }
        if (this.isPrismaError(error, 'P2034')) {
          throw new ConflictException(
            'No se pudo completar la operación debido a concurrencia. Intente nuevamente.',
          );
        }
        if (this.isPrismaError(error, 'P2003')) {
          throw new BadRequestException(
            'El período, nivel o turno indicado no existe',
          );
        }
        throw error;
      }
    }
    throw new ConflictException('No se pudo completar la operación');
  }

  private isPrismaError(error: unknown, code: string) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === code
    );
  }
}
