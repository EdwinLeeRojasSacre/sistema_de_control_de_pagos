import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { EnrollmentsService, type EnrollmentAuditContext } from './enrollments.service.js';
import {
  ENROLLMENT_HEADERS, type ImportFile, parseImportFile, type ParsedImportRow,
} from '../imports/import-file.js';

type ImportState = 'VALIDO' | 'ADVERTENCIA' | 'ERROR';
export interface EnrollmentImportRow {
  fila: number;
  familia_referencia: string;
  estudiante: string;
  documento: string;
  periodo: string;
  ciclo_nivel: string;
  aula: string;
  turno: string;
  estado: ImportState;
  detalle: string;
  studentId?: string;
  classroomId?: string;
  periodId?: string;
  enrollmentId?: string;
  student_code?: string;
}

const normalize = (value: string) => value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
const documentKey = (type: string, number: string) => `${normalize(type)}:${normalize(number)}`;

@Injectable()
export class EnrollmentsImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly enrollmentsService: EnrollmentsService,
  ) {}

  async preview(file: ImportFile) {
    const parsed = await parseImportFile(file, ENROLLMENT_HEADERS);
    const rows = await this.validateRows(parsed);
    return { rows, summary: this.summary(rows) };
  }

  async confirm(file: ImportFile, context: EnrollmentAuditContext) {
    const parsed = await parseImportFile(file, ENROLLMENT_HEADERS);
    const rows = await this.validateRows(parsed);
    for (const row of rows) {
      if (row.estado === 'ERROR' || !row.studentId || !row.classroomId || !row.periodId) continue;
      try {
        const created = await this.enrollmentsService.create({
          studentId: row.studentId,
          classroomId: row.classroomId,
          schoolPeriodId: row.periodId,
        }, context);
        row.enrollmentId = created.id;
        row.student_code = created.student.code ?? '';
        row.detalle = 'Matrícula creada';
      } catch (error) {
        row.estado = 'ERROR';
        row.detalle = error instanceof HttpException ? error.message : 'No se pudo crear la matrícula';
      }
    }
    await this.prisma.audit_logs.create({
      data: {
        user_id: context.userId, entity_name: 'enrollment_imports',
        action: 'IMPORT_ENROLLMENTS',
        new_value: {
          rows: parsed.length,
          created: rows.filter((row) => Boolean(row.enrollmentId)).length,
          rejected: rows.filter((row) => row.estado === 'ERROR').length,
        },
        ip_address: context.ipAddress, device_name: context.deviceName,
      },
    });
    return { rows, summary: this.summary(rows) };
  }

  private summary(rows: EnrollmentImportRow[]) {
    return {
      processed: rows.length,
      valid: rows.filter((row) => row.estado !== 'ERROR').length,
      created: rows.filter((row) => Boolean(row.enrollmentId)).length,
      rejected: rows.filter((row) => row.estado === 'ERROR').length,
    };
  }

  private async validateRows(parsed: ParsedImportRow[]): Promise<EnrollmentImportRow[]> {
    const years = [...new Set(parsed.map((row) => Number(row.values.periodo)).filter(Number.isInteger))];
    const documentPairs = parsed.map((row) => ({
      document_type: row.values.estudiante_tipo_documento.trim().toUpperCase(),
      document_number: row.values.estudiante_numero_documento.trim(),
    })).filter((pair) => pair.document_type && pair.document_number);
    const [periods, persons, classrooms] = await Promise.all([
      this.prisma.school_periods.findMany({ where: { year: { in: years } } }),
      this.prisma.persons.findMany({
        where: { OR: documentPairs },
        include: { students: { include: { enrollments: true } } },
      }),
      this.prisma.classrooms.findMany({
        where: { school_periods: { year: { in: years } } },
        include: {
          school_periods: true, shifts: true,
          education_levels: { include: { education_cycles: true } },
        },
      }),
    ]);
    const periodByYear = new Map(periods.map((period) => [period.year, period]));
    const personByDocument = new Map(persons.map((person) => [
      documentKey(person.document_type, person.document_number ?? ''), person,
    ]));
    const activeMemberships = await this.prisma.family_members.findMany({
      where: {
        person_id: { in: persons.map((person) => person.id) },
        relationship_type: 'ESTUDIANTE',
        family_groups: { is_active: true },
      },
      select: { person_id: true },
    });
    const memberPersonIds = new Set(activeMemberships.map((member) => member.person_id));
    const seen = new Set<string>();

    return parsed.map(({ rowNumber, values }) => {
      const year = Number(values.periodo);
      const key = documentKey(values.estudiante_tipo_documento, values.estudiante_numero_documento);
      const period = periodByYear.get(year);
      const person = personByDocument.get(key);
      const student = person?.students;
      const matchingRooms = classrooms.filter((room) => room.school_period_id === period?.id
        && normalize(room.name) === normalize(values.aula));
      const room = matchingRooms.find((candidate) => normalize(candidate.shifts.name) === normalize(values.turno));
      const actualLevel = room ? room.education_levels.name : '';
      const actualCycle = room ? room.education_levels.education_cycles.name : '';
      const givenLevel = normalize(values.ciclo_nivel);
      const levelMatches = Boolean(room) && [
        actualLevel, `${actualCycle} / ${actualLevel}`,
        `${actualCycle} - ${actualLevel}`,
      ].some((value) => normalize(value) === givenLevel);
      let detalle = '';
      if (!Number.isInteger(year) || !period) detalle = `El período ${values.periodo} no existe.`;
      else if (!period.is_active || period.status !== 'OPEN') detalle = `El período ${year} no está abierto.`;
      else if (!values.estudiante_tipo_documento || !values.estudiante_numero_documento) detalle = 'Falta el documento del estudiante.';
      else if (!student) detalle = `El estudiante ${values.estudiante_numero_documento} no existe.`;
      else if (!student.is_active || !person?.is_active) detalle = 'El estudiante está inactivo.';
      else if (!memberPersonIds.has(person.id)) detalle = 'El estudiante debe pertenecer a una familia activa.';
      else if (seen.has(`${period.id}:${student.id}`)) detalle = 'El estudiante está duplicado dentro del archivo.';
      else if (student.enrollments.some((enrollment) => enrollment.school_period_id === period.id)) detalle = `El estudiante ya cuenta con matrícula para el período ${year}. Para modificarla utilice el módulo Matrículas.`;
      else if (!matchingRooms.length) detalle = `El aula '${values.aula}' no existe para el período ${year}.`;
      else if (!room) detalle = `El turno '${values.turno}' no coincide con el aula '${values.aula}'.`;
      else if (!room.is_active) detalle = `El aula '${values.aula}' está inactiva.`;
      else if (!levelMatches) detalle = `El ciclo/nivel '${values.ciclo_nivel}' no coincide con el aula.`;
      if (student && period) seen.add(`${period.id}:${student.id}`);
      return {
        fila: rowNumber, familia_referencia: '',
        estudiante: values.estudiante_nombre_referencia || [person?.first_name, person?.last_name_father].filter(Boolean).join(' '),
        documento: `${values.estudiante_tipo_documento} ${values.estudiante_numero_documento}`.trim(),
        periodo: values.periodo, ciclo_nivel: values.ciclo_nivel,
        aula: values.aula, turno: values.turno,
        estado: detalle ? 'ERROR' : 'VALIDO',
        detalle: detalle || 'Estudiante y aula válidos',
        studentId: detalle ? undefined : student?.id,
        classroomId: detalle ? undefined : room?.id,
        periodId: detalle ? undefined : period?.id,
      };
    });
  }
}
