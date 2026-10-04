import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, school_periods } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service.js';
import { CreateSchoolPeriodDto } from './dto/create-school-period.dto.js';
import { UpdateSchoolPeriodDto } from './dto/update-school-period.dto.js';

export interface SchoolPeriodAuditContext {
  userId: string;
  ipAddress: string | null;
  deviceName: string | null;
}

type SchoolPeriodStatus = 'PLANNED' | 'OPEN' | 'CLOSED';

export const SCHOOL_PERIOD_CLOSE_WARNING_DAYS = 30;
const MILLISECONDS_PER_DAY = 86_400_000;

interface RelatedRecordCounts {
  enrollments: number;
  payments: number;
}

@Injectable()
export class SchoolPeriodsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const periods = await this.prisma.school_periods.findMany({
      orderBy: { year: 'desc' },
    });

    const data = periods.map((period) => this.toResponse(period));
    const currentYear = this.getNow().getFullYear();
    const currentOpenPeriod = periods.find(
      (period) => period.status === 'OPEN' && period.year === currentYear,
    ) ?? periods.find((period) => period.status === 'OPEN');

    return {
      data,
      currentOpenPeriod: currentOpenPeriod
        ? this.toResponse(currentOpenPeriod)
        : null,
      warning: currentOpenPeriod
        ? this.buildCloseWarning(currentOpenPeriod)
        : null,
    };
  }

  async findById(id: string) {
    const period = await this.prisma.school_periods.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            enrollments: true,
            payments: true,
          },
        },
      },
    });

    if (!period) {
      throw new NotFoundException('El período escolar no existe');
    }

    return {
      ...this.toResponse(period),
      hasReferences: this.hasReferences(period._count),
    };
  }

  async create(
    dto: CreateSchoolPeriodDto,
    auditContext: SchoolPeriodAuditContext,
  ) {
    const startDate = this.parseDateOnly(dto.startDate);
    const endDate = this.parseDateOnly(dto.endDate);

    this.validateDates(dto.year, startDate, endDate);

    return this.runSerializable(async (transaction) => {
      const duplicate = await transaction.school_periods.findUnique({
        where: { year: dto.year },
        select: { id: true },
      });

      if (duplicate) {
        throw new ConflictException(
          `Ya existe un período escolar para el año ${dto.year}`,
        );
      }

      const period = await transaction.school_periods.create({
        data: {
          year: dto.year,
          start_date: startDate,
          end_date: endDate,
          status: 'PLANNED',
          is_active: true,
        },
      });

      await this.createAuditLog(
        transaction,
        period.id,
        'CREATE',
        null,
        this.toAuditSnapshot(period),
        auditContext,
      );

      return this.toResponse(period);
    });
  }

  async update(
    id: string,
    dto: UpdateSchoolPeriodDto,
    auditContext: SchoolPeriodAuditContext,
  ) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException(
        'Debe enviar al menos un campo para actualizar',
      );
    }

    return this.runSerializable(async (transaction) => {
      const current = await transaction.school_periods.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              enrollments: true,
              payments: true,
            },
          },
        },
      });

      if (!current) {
        throw new NotFoundException('El período escolar no existe');
      }

      if (current.status === 'CLOSED') {
        throw new ConflictException(
          'Un período cerrado es histórico y no puede editarse',
        );
      }

      const year = dto.year ?? current.year;

      const startDate = dto.startDate
        ? this.parseDateOnly(dto.startDate)
        : current.start_date;

      const endDate = dto.endDate
        ? this.parseDateOnly(dto.endDate)
        : current.end_date;

      this.validateDates(year, startDate, endDate);

      if (year !== current.year) {
        if (this.hasReferences(current._count)) {
          throw new ConflictException(
            'El año no puede modificarse porque el período tiene información histórica relacionada',
          );
        }

        const duplicate = await transaction.school_periods.findFirst({
          where: {
            year,
            id: { not: id },
          },
          select: { id: true },
        });

        if (duplicate) {
          throw new ConflictException(
            `Ya existe un período escolar para el año ${year}`,
          );
        }
      }

      const updated = await transaction.school_periods.update({
        where: { id },
        data: {
          year,
          start_date: startDate,
          end_date: endDate,
          updated_at: new Date(),
        },
      });

      await this.createAuditLog(
        transaction,
        id,
        'UPDATE',
        this.toAuditSnapshot(current),
        this.toAuditSnapshot(updated),
        auditContext,
      );

      return this.toResponse(updated);
    });
  }

  open(
    id: string,
    auditContext: SchoolPeriodAuditContext,
  ) {
    return this.runSerializable(async (transaction) => {
      const current = await this.getPeriodOrThrow(
        transaction,
        id,
      );

      if (current.status !== 'PLANNED') {
        throw new ConflictException(
          'Solo un período planificado puede abrirse',
        );
      }

      if (!current.is_active) {
        throw new ConflictException(
          'El período debe estar habilitado antes de abrirse',
        );
      }

      const currentYear =
        this.getNow().getFullYear();

      if (
        current.year !== currentYear &&
        current.year !== currentYear + 1
      ) {
        throw new ConflictException(
          `Solo puede abrirse el período del año actual (${currentYear}) o del siguiente (${currentYear + 1})`,
        );
      }

      const inheritance = await this.inheritAcademicStructure(
        transaction,
        current.id,
        current.year,
      );

      return this.changeState(
        transaction,
        current,
        { status: 'OPEN' },
        'OPEN',
        auditContext,
        {
          academicInheritance: inheritance,
        },
      );
    });
  }

  close(
    id: string,
    auditContext: SchoolPeriodAuditContext,
  ) {
    return this.runSerializable(async (transaction) => {
      const current = await this.getPeriodOrThrow(
        transaction,
        id,
      );

      if (current.status !== 'OPEN') {
        throw new ConflictException(
          'Solo un período abierto puede cerrarse',
        );
      }

      const now = this.getNow();
      const currentYear = now.getFullYear();

      if (current.year > currentYear) {
        throw new ConflictException(
          `No se puede cerrar un período escolar futuro (${current.year})`,
        );
      }

      if (current.year === currentYear && now.getMonth() !== 11) {
        throw new ConflictException(
          `El período escolar ${current.year} solo puede cerrarse en diciembre`,
        );
      }

      return this.changeState(
        transaction,
        current,
        { status: 'CLOSED' },
        'CLOSE',
        auditContext,
      );
    });
  }

  enable(
    id: string,
    auditContext: SchoolPeriodAuditContext,
  ) {
    return this.runSerializable(async (transaction) => {
      const current = await this.getPeriodOrThrow(
        transaction,
        id,
      );

      if (current.status !== 'PLANNED') {
        throw new ConflictException(
          'Solo un período planificado puede habilitarse',
        );
      }

      if (current.is_active) {
        throw new ConflictException(
          'El período ya está habilitado',
        );
      }

      return this.changeState(
        transaction,
        current,
        { is_active: true },
        'ENABLE',
        auditContext,
      );
    });
  }

  disable(
    id: string,
    auditContext: SchoolPeriodAuditContext,
  ) {
    return this.runSerializable(async (transaction) => {
      const current = await this.getPeriodOrThrow(
        transaction,
        id,
      );

      if (current.status !== 'PLANNED') {
        throw new ConflictException(
          'Solo un período planificado puede deshabilitarse',
        );
      }

      if (!current.is_active) {
        throw new ConflictException(
          'El período ya está deshabilitado',
        );
      }

      return this.changeState(
        transaction,
        current,
        { is_active: false },
        'DISABLE',
        auditContext,
      );
    });
  }

  private async changeState(
    transaction: Prisma.TransactionClient,
    current: school_periods,
    data: {
      status?: SchoolPeriodStatus;
      is_active?: boolean;
    },
    action:
      | 'OPEN'
      | 'CLOSE'
      | 'ENABLE'
      | 'DISABLE',
    auditContext: SchoolPeriodAuditContext,
    auditDetails?: Prisma.InputJsonObject,
  ) {
    const updated =
      await transaction.school_periods.update({
        where: {
          id: current.id,
        },
        data: {
          ...data,
          updated_at: new Date(),
        },
      });

    await this.createAuditLog(
      transaction,
      current.id,
      action,
      this.toAuditSnapshot(current),
      {
        ...this.toAuditSnapshot(updated),
        ...auditDetails,
      },
      auditContext,
    );

    return this.toResponse(updated);
  }

  private async inheritAcademicStructure(
    transaction: Prisma.TransactionClient,
    targetPeriodId: string,
    targetYear: number,
  ): Promise<Prisma.InputJsonObject> {
    const existingClassrooms = await transaction.classrooms.count({
      where: { school_period_id: targetPeriodId },
    });

    if (existingClassrooms > 0) {
      return {
        sourceSchoolPeriodId: null,
        sourceYear: targetYear - 1,
        inheritedClassrooms: 0,
        reason: 'TARGET_ALREADY_CONFIGURED',
      };
    }

    const sourcePeriod = await transaction.school_periods.findUnique({
      where: { year: targetYear - 1 },
      select: { id: true, year: true },
    });

    if (!sourcePeriod) {
      return {
        sourceSchoolPeriodId: null,
        sourceYear: targetYear - 1,
        inheritedClassrooms: 0,
        reason: 'PREVIOUS_PERIOD_NOT_FOUND',
      };
    }

    const sourceClassrooms = await transaction.classrooms.findMany({
      where: {
        school_period_id: sourcePeriod.id,
        is_active: true,
      },
      select: {
        education_level_id: true,
        shift_id: true,
        name: true,
        capacity: true,
      },
    });

    if (sourceClassrooms.length > 0) {
      await transaction.classrooms.createMany({
        data: sourceClassrooms.map((classroom) => ({
          school_period_id: targetPeriodId,
          education_level_id: classroom.education_level_id,
          shift_id: classroom.shift_id,
          name: classroom.name,
          capacity: classroom.capacity,
          is_active: true,
        })),
      });
    }

    return {
      sourceSchoolPeriodId: sourcePeriod.id,
      sourceYear: sourcePeriod.year,
      inheritedClassrooms: sourceClassrooms.length,
      reason: sourceClassrooms.length > 0
        ? 'INHERITED'
        : 'PREVIOUS_PERIOD_WITHOUT_ACTIVE_CLASSROOMS',
    };
  }

  private async getPeriodOrThrow(
    transaction: Prisma.TransactionClient,
    id: string,
  ) {
    const period =
      await transaction.school_periods.findUnique({
        where: { id },
      });

    if (!period) {
      throw new NotFoundException(
        'El período escolar no existe',
      );
    }

    return period;
  }

  private async createAuditLog(
    transaction: Prisma.TransactionClient,
    entityId: string,
    action:
      | 'CREATE'
      | 'UPDATE'
      | 'OPEN'
      | 'CLOSE'
      | 'ENABLE'
      | 'DISABLE',
    oldValue: Prisma.InputJsonValue | null,
    newValue: Prisma.InputJsonValue,
    context: SchoolPeriodAuditContext,
  ) {
    await transaction.audit_logs.create({
      data: {
        user_id: context.userId,
        entity_name: 'school_periods',
        entity_id: entityId,
        action,
        old_value:
          oldValue === null
            ? Prisma.DbNull
            : oldValue,
        new_value: newValue,
        ip_address: context.ipAddress,
        device_name: context.deviceName,
      },
    });
  }

  private async runSerializable<T>(
    operation: (
      transaction: Prisma.TransactionClient,
    ) => Promise<T>,
  ): Promise<T> {
    const maxRetries = 3;

    for (
      let attempt = 1;
      attempt <= maxRetries;
      attempt += 1
    ) {
      try {
        return await this.prisma.$transaction(
          operation,
          {
            isolationLevel:
              Prisma.TransactionIsolationLevel
                .Serializable,
            maxWait: 5000,
            timeout: 15000,
          },
        );
      } catch (error: unknown) {
        if (
          this.isPrismaError(
            error,
            'P2034',
          ) &&
          attempt < maxRetries
        ) {
          continue;
        }

        this.handlePersistenceError(error);
      }
    }

    throw new ConflictException(
      'No se pudo completar la operación debido a concurrencia. Intente nuevamente.',
    );
  }

  private handlePersistenceError(
    error: unknown,
  ): never {
    if (error instanceof HttpException) {
      throw error;
    }

    if (
      this.isPrismaError(
        error,
        'P2002',
      )
    ) {
      throw new ConflictException(
        'Ya existe un período escolar con ese año',
      );
    }

    if (
      this.isPrismaError(
        error,
        'P2034',
      )
    ) {
      throw new ConflictException(
        'No se pudo completar la operación debido a concurrencia. Intente nuevamente.',
      );
    }

    if (
      this.isPrismaError(
        error,
        'P2003',
      )
    ) {
      throw new BadRequestException(
        'La operación no cumple la integridad referencial requerida',
      );
    }

    throw error;
  }

  private isPrismaError(
    error: unknown,
    code: string,
  ) {
    return (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code === code
    );
  }

  private parseDateOnly(
    value: string,
  ) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(
        value,
      )
    ) {
      throw new BadRequestException(
        'Las fechas deben usar el formato YYYY-MM-DD',
      );
    }

    const date = new Date(
      `${value}T00:00:00.000Z`,
    );

    if (
      Number.isNaN(date.getTime()) ||
      this.formatDate(date) !== value
    ) {
      throw new BadRequestException(
        'La fecha indicada no es válida',
      );
    }

    return date;
  }

  private validateDates(
    year: number,
    startDate: Date,
    endDate: Date,
  ) {
    if (
      startDate.getTime() >=
      endDate.getTime()
    ) {
      throw new BadRequestException(
        'La fecha de inicio debe ser anterior a la fecha de fin',
      );
    }

    if (
      startDate.getUTCFullYear() !==
      year
    ) {
      throw new BadRequestException(
        'El año de la fecha de inicio debe coincidir con el año del período',
      );
    }
  }

  private hasReferences(
    counts: RelatedRecordCounts,
  ) {
    return (
      counts.enrollments > 0 ||
      counts.payments > 0
    );
  }

  private toResponse(
    period: school_periods,
  ) {
    return {
      id: period.id,
      year: period.year,
      startDate: this.formatDate(
        period.start_date,
      ),
      endDate: this.formatDate(
        period.end_date,
      ),
      status:
        period.status as SchoolPeriodStatus,
      isActive: period.is_active,
      createdAt:
        period.created_at.toISOString(),
      updatedAt:
        period.updated_at.toISOString(),
    };
  }

  private toAuditSnapshot(
    period: school_periods,
  ): Prisma.InputJsonObject {
    return {
      year: period.year,
      startDate: this.formatDate(
        period.start_date,
      ),
      endDate: this.formatDate(
        period.end_date,
      ),
      status: period.status,
      isActive: period.is_active,
    };
  }

  private formatDate(
    date: Date,
  ) {
    return date
      .toISOString()
      .slice(0, 10);
  }

  private getNow() {
    return new Date();
  }

  private buildCloseWarning(
    period: school_periods,
  ) {
    const now = this.getNow();

    const today = Date.UTC(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

    const endDate = Date.UTC(
      period.end_date.getUTCFullYear(),
      period.end_date.getUTCMonth(),
      period.end_date.getUTCDate(),
    );

    const daysRemaining = Math.round(
      (endDate - today) /
        MILLISECONDS_PER_DAY,
    );

    if (daysRemaining < 0) {
      return {
        type: 'OVERDUE' as const,
        daysRemaining,
        message: `El período escolar ${period.year} ya superó su fecha de finalización y continúa abierto. Debe cerrarlo.`,
      };
    }

    if (
      daysRemaining <=
      SCHOOL_PERIOD_CLOSE_WARNING_DAYS
    ) {
      return {
        type: 'NEAR_END' as const,
        daysRemaining,
        message: `El período escolar ${period.year} finaliza el ${this.formatDisplayDate(
          period.end_date,
        )}. Faltan ${daysRemaining} días. Recuerde cerrar el período al finalizar el año escolar.`,
      };
    }

    return null;
  }

  private formatDisplayDate(
    date: Date,
  ) {
    const day = String(
      date.getUTCDate(),
    ).padStart(2, '0');

    const month = String(
      date.getUTCMonth() + 1,
    ).padStart(2, '0');

    return `${day}/${month}/${date.getUTCFullYear()}`;
  }
}
