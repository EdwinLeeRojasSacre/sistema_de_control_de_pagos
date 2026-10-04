import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  Prisma,
} from '@prisma/client';

import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  PrismaService,
} from '../prisma/prisma.service.js';

import {
  ApafaReportQueryDto,
} from './dto/apafa-report-query.dto.js';

import type {
  ReportStatus,
} from './dto/report-status.enum.js';

import {
  ReportSummaryQueryDto,
} from './dto/report-summary-query.dto.js';

import {
  TallerReportQueryDto,
} from './dto/taller-report-query.dto.js';

import { PaymentsReportQueryDto } from './dto/payments-report-query.dto.js';

interface ExportResult {
  buffer: Buffer;
  contentType: string;
  filename: string;
}

export interface PersonSummary {
  personId: string;
  fullName: string;
  documentType: string;
  documentNumber: string | null;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  // ============================================================
  // RESUMEN
  // ============================================================

  async getSummary(
    query:
      ReportSummaryQueryDto,
  ) {
    const result = await this.getPaymentsReportData({ ...query, paymentType: query.paymentType ?? 'ALL' });
    const byClassroom = new Map<string, { classroomId: string; classroom: string; families: Map<string, string>; tallerUnpaid: number }>();
    for (const row of result.rows) {
      const key = row.academic.classroomId;
      const current = byClassroom.get(key) ?? { classroomId: key, classroom: row.academic.classroomName, families: new Map(), tallerUnpaid: 0 };
      if (row.family.id) current.families.set(row.family.id, row.apafa.status);
      if (row.taller.status === 'NO_PAGADO') current.tallerUnpaid += 1;
      byClassroom.set(key, current);
    }
    const classrooms = [...byClassroom.values()].map((item) => ({
      classroomId: item.classroomId, classroom: item.classroom,
      apafaUnpaid: [...item.families.values()].filter((status) => status === 'NO_PAGADO').length,
      tallerUnpaid: item.tallerUnpaid,
    })).sort((a, b) => (b.apafaUnpaid + b.tallerUnpaid) - (a.apafaUnpaid + a.tallerUnpaid) || a.classroom.localeCompare(b.classroom, 'es'));
    return {
      schoolPeriod: result.schoolPeriod,
      families: result.statistics.visibleFamilies,
      students: result.statistics.visibleStudents,
      apafa: {
        totalFamilies: result.statistics.visibleFamilies, paid: result.statistics.apafaPaid,
        unpaid: result.statistics.apafaUnpaid,
        paidPercentage: this.calculatePercentage(result.statistics.apafaPaid, result.statistics.visibleFamilies),
      },
      taller: {
        totalStudents: result.statistics.visibleStudents, paid: result.statistics.tallerPaid,
        unpaid: result.statistics.tallerUnpaid,
        paidPercentage: this.calculatePercentage(result.statistics.tallerPaid, result.statistics.visibleStudents),
      },
      classrooms: classrooms.slice(0, 5),
    };
  }

  // ============================================================
  // PAGOS CONSOLIDADOS
  // ============================================================

  async getPaymentsReport(query: PaymentsReportQueryDto) {
    const result = await this.getPaymentsReportData(query);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    return {
      schoolPeriod: result.schoolPeriod,
      data: result.rows.slice((page - 1) * limit, page * limit),
      statistics: result.statistics,
      pagination: {
        page, limit, total: result.rows.length,
        totalPages: Math.ceil(result.rows.length / limit),
      },
    };
  }

  async exportPaymentsXlsx(query: PaymentsReportQueryDto): Promise<ExportResult> {
    const result = await this.getPaymentsReportData(query);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Pagos');
    sheet.columns = [
      { header: 'Código Familia', key: 'familyCode', width: 18 },
      { header: 'Familia', key: 'familyName', width: 28 },
      { header: 'Padre', key: 'father', width: 28 },
      { header: 'Madre', key: 'mother', width: 28 },
      { header: 'Apoderado', key: 'guardian', width: 28 },
      { header: 'Documento Apoderado', key: 'guardianDocument', width: 20 },
      { header: 'Teléfono Apoderado', key: 'guardianPhone', width: 18 },
      { header: 'Correo Apoderado', key: 'guardianEmail', width: 28 },
      { header: 'Código Estudiante', key: 'studentCode', width: 18 },
      { header: 'Estudiante', key: 'student', width: 28 },
      { header: 'Documento Estudiante', key: 'studentDocument', width: 20 },
      { header: 'Período', key: 'period', width: 12 },
      { header: 'Ciclo', key: 'cycle', width: 18 },
      { header: 'Nivel / grado', key: 'level', width: 18 },
      { header: 'Aula', key: 'classroom', width: 18 },
      { header: 'Turno', key: 'shift', width: 14 },
      { header: 'APAFA', key: 'apafa', width: 14 },
      { header: 'Taller', key: 'taller', width: 14 },
    ];
    for (const row of result.rows) {
      sheet.addRow({
        familyCode: row.family.code ?? '', familyName: row.family.name,
        father: row.father?.fullName ?? '', mother: row.mother?.fullName ?? '',
        guardian: row.guardian?.fullName ?? '',
        guardianDocument: row.guardian ? `${row.guardian.documentType} ${row.guardian.documentNumber ?? ''}`.trim() : '',
        guardianPhone: row.guardian?.phone ?? '', guardianEmail: row.guardian?.email ?? '',
        studentCode: row.student.code ?? '', student: row.student.fullName,
        studentDocument: `${row.student.documentType} ${row.student.documentNumber ?? ''}`.trim(),
        period: result.schoolPeriod.year, cycle: row.academic.cycleName,
        level: row.academic.educationLevelName, classroom: row.academic.classroomName,
        shift: row.academic.shiftName, apafa: row.apafa.status, taller: row.taller.status,
      });
    }
    sheet.getRow(1).font = { bold: true };
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    return { buffer, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename: `reporte-pagos-${result.schoolPeriod.year}.xlsx` };
  }

  async exportPaymentsPdf(query: PaymentsReportQueryDto): Promise<ExportResult> {
    const result = await this.getPaymentsReportData(query);
    const paymentType = query.paymentType ?? 'ALL';
    const status = query.status ?? 'ALL';
    const filterLabels = [
      `Año académico: ${result.schoolPeriod.year}`,
      `Nivel: ${query.educationLevelId ? result.rows[0]?.academic.educationLevelName ?? query.educationLevelId : 'Todos'}`,
      `Ciclo: ${query.cycleId ? result.rows[0]?.academic.cycleName ?? query.cycleId : 'Todos'}`,
      `Turno: ${query.shiftId ? result.rows[0]?.academic.shiftName ?? query.shiftId : 'Todos'}`,
      `Aula: ${query.classroomId ? result.rows[0]?.academic.classroomName ?? query.classroomId : 'Todas'}`,
      `Estado de pago: ${status === 'ALL' ? 'Todos' : status === 'PAGADO' ? 'Pagado' : 'No pagado'}`,
      `Tipo de pago: ${paymentType === 'ALL' ? 'Todos' : paymentType}`,
      query.search && `Búsqueda: ${query.search}`,
    ].filter((value): value is string => Boolean(value));
    const rows = result.rows.map((row, index) => ({
      sort: row.academic,
      number: index + 1,
      student: row.student.fullName,
      cycleLevel: `${row.academic.cycleName} / ${row.academic.educationLevelName}`,
      shift: row.academic.shiftName,
      classroom: row.academic.classroomName,
      apafa: {
        status: row.apafa.status === 'PAGADO' ? 'PAGO' : 'DEBE',
        date: this.formatPdfDate(row.apafa.paymentDate),
      },
      taller: {
        status: row.taller.status === 'PAGADO' ? 'PAGO' : 'DEBE',
        date: this.formatPdfDate(row.taller.paymentDate),
      },
    }));
    const columns = [
      { title: 'N.°', key: 'number', width: 34 },
      { title: 'Estudiante', key: 'student', width: 220 },
      { title: 'Ciclo / Nivel', key: 'cycleLevel', width: 145 },
      { title: 'Turno', key: 'shift', width: 76 },
      { title: 'Aula', key: 'classroom', width: 110 },
      ...(paymentType !== 'TALLER' ? [{ title: 'APAFA', key: 'apafa', width: 96 }] : []),
      ...(paymentType !== 'APAFA' ? [{ title: 'Taller', key: 'taller', width: 96 }] : []),
    ];
    const buffer = await this.createPaymentsPdf(result.schoolPeriod.year, filterLabels, columns, rows, result.statistics, paymentType);
    return { buffer, contentType: 'application/pdf', filename: `reporte-pagos-${result.schoolPeriod.year}.pdf` };
  }

  // ============================================================
  // APAFA
  // ============================================================

  async getApafaReport(
    query:
      ApafaReportQueryDto,
  ) {
    const period =
      await this.getPeriodOrThrow(
        query.schoolPeriodId,
      );

    const page =
      query.page ?? 1;

    const limit =
      query.limit ?? 20;

    const where =
      this.buildApafaWhere(
        query,
      );

    const [
      families,
      total,
    ] =
      await Promise.all([
        this.prisma
          .family_groups
          .findMany({
            where,

            include:
              this.getApafaInclude(
                query
                  .schoolPeriodId,
              ),

            orderBy: [
              {
                name: 'asc',
              },
              {
                id: 'asc',
              },
            ],

            skip:
              (page - 1) *
              limit,

            take: limit,
          }),

        this.prisma
          .family_groups
          .count({
            where,
          }),
      ]);

    return {
      schoolPeriod:
        this.mapPeriod(period),

      data:
        families.map(
          (family) =>
            this.mapApafaFamily(
              family,
            ),
        ),

      pagination: {
        page,
        limit,
        total,

        totalPages:
          Math.ceil(
            total / limit,
          ),
      },
    };
  }

  // ============================================================
  // TALLER
  // ============================================================

  async getTallerReport(
    query:
      TallerReportQueryDto,
  ) {
    const period =
      await this.getPeriodOrThrow(
        query.schoolPeriodId,
      );

    const page =
      query.page ?? 1;

    const limit =
      query.limit ?? 20;

    const where =
      this.buildTallerWhere(
        query,
      );

    const [
      enrollments,
      total,
    ] =
      await Promise.all([
        this.prisma
          .enrollments
          .findMany({
            where,

            include:
              this.getTallerInclude(
                query
                  .schoolPeriodId,
              ),

            orderBy: [
              {
                classrooms: {
                  education_levels: {
                    name: 'asc',
                  },
                },
              },
              {
                classrooms: {
                  name: 'asc',
                },
              },
              {
                students: {
                  persons: {
                    last_name_father:
                      'asc',
                  },
                },
              },
              {
                students: {
                  persons: {
                    first_name:
                      'asc',
                  },
                },
              },
            ],

            skip:
              (page - 1) *
              limit,

            take: limit,
          }),

        this.prisma
          .enrollments
          .count({
            where,
          }),
      ]);

    return {
      schoolPeriod:
        this.mapPeriod(period),

      data:
        enrollments.map(
          (enrollment) =>
            this.mapTallerEnrollment(
              enrollment,
            ),
        ),

      pagination: {
        page,
        limit,
        total,

        totalPages:
          Math.ceil(
            total / limit,
          ),
      },
    };
  }

  // ============================================================
  // EXPORTACIÓN APAFA - XLSX
  // ============================================================

  async exportApafaXlsx(
    query:
      ApafaReportQueryDto,
  ): Promise<ExportResult> {
    const period =
      await this.getPeriodOrThrow(
        query.schoolPeriodId,
      );

    const families =
      await this.prisma
        .family_groups
        .findMany({
          where:
            this.buildApafaWhere(
              query,
            ),

          include:
            this.getApafaInclude(
              query
                .schoolPeriodId,
            ),

          orderBy: [
            {
              name: 'asc',
            },
            {
              id: 'asc',
            },
          ],
        });

    const rows =
      families.map(
        (family) =>
          this.mapApafaFamily(
            family,
          ),
      );

    const workbook =
      new ExcelJS.Workbook();

    workbook.creator =
      'SGPE';

    workbook.created =
      new Date();

    const worksheet =
      workbook.addWorksheet(
        'APAFA',
      );

    worksheet.mergeCells(
      'A1:I1',
    );

    worksheet.getCell(
      'A1',
    ).value =
      `SGPE - Reporte APAFA ${period.year}`;

    worksheet.getCell(
      'A2',
    ).value =
      'Generado';

    worksheet.getCell(
      'B2',
    ).value =
      new Date();

    worksheet.getCell(
      'A3',
    ).value =
      'Estado';

    worksheet.getCell(
      'B3',
    ).value =
      query.status ??
      'ALL';

    worksheet.getCell(
      'A4',
    ).value =
      'Búsqueda';

    worksheet.getCell(
      'B4',
    ).value =
      query.search ??
      'Sin filtro';

    worksheet.addRow([]);

    worksheet.addRow([
      'Código familia',
      'Familia',
      'Apoderado',
      'Tipo documento',
      'Documento',
      'Estudiantes',
      'Estado',
      'Fecha pago',
      'N° operación',
    ]);

    for (
      const row
      of rows
    ) {
      worksheet.addRow([
        row.familyCode ??
          '',
        row.familyName,
        row.guardian
          ?.fullName ??
          '',
        row.guardian
          ?.documentType ??
          '',
        row.guardian
          ?.documentNumber ??
          '',
        row.studentsCount,
        row.status,
        row.payment
          ?.paymentDate ??
          '',
        row.payment
          ?.operationNumber ??
          '',
      ]);
    }

    worksheet.columns = [
      { width: 20 },
      { width: 30 },
      { width: 35 },
      { width: 16 },
      { width: 18 },
      { width: 14 },
      { width: 14 },
      { width: 16 },
      { width: 22 },
    ];

    worksheet.views = [
      {
        state: 'frozen',
        ySplit: 6,
      },
    ];

    const header =
      worksheet.getRow(6);

    header.font = {
      bold: true,
    };

    header.alignment = {
      vertical:
        'middle',
      horizontal:
        'center',
    };

    worksheet.autoFilter =
      'A6:I6';

    const excelBuffer =
      await workbook.xlsx
        .writeBuffer();

    return {
      buffer:
        Buffer.from(
          excelBuffer,
        ),

      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

      filename:
        `reporte-apafa-${period.year}.xlsx`,
    };
  }

  // ============================================================
  // EXPORTACIÓN TALLER - XLSX
  // ============================================================

  async exportTallerXlsx(
    query:
      TallerReportQueryDto,
  ): Promise<ExportResult> {
    const period =
      await this.getPeriodOrThrow(
        query.schoolPeriodId,
      );

    const enrollments =
      await this.prisma
        .enrollments
        .findMany({
          where:
            this.buildTallerWhere(
              query,
            ),

          include:
            this.getTallerInclude(
              query
                .schoolPeriodId,
            ),

          orderBy: [
            {
              classrooms: {
                education_levels: {
                  name: 'asc',
                },
              },
            },
            {
              classrooms: {
                name: 'asc',
              },
            },
            {
              students: {
                persons: {
                  last_name_father:
                    'asc',
                },
              },
            },
          ],
        });

    const rows =
      enrollments.map(
        (enrollment) =>
          this.mapTallerEnrollment(
            enrollment,
          ),
      );

    const workbook =
      new ExcelJS.Workbook();

    workbook.creator =
      'SGPE';

    workbook.created =
      new Date();

    const worksheet =
      workbook.addWorksheet(
        'Taller',
      );

    worksheet.mergeCells(
      'A1:O1',
    );

    worksheet.getCell(
      'A1',
    ).value =
      `SGPE - Reporte Taller ${period.year}`;

    worksheet.getCell(
      'A2',
    ).value =
      'Generado';

    worksheet.getCell(
      'B2',
    ).value =
      new Date();

    worksheet.getCell(
      'A3',
    ).value =
      'Estado';

    worksheet.getCell(
      'B3',
    ).value =
      query.status ??
      'ALL';

    worksheet.getCell(
      'A4',
    ).value =
      'Búsqueda';

    worksheet.getCell(
      'B4',
    ).value =
      query.search ??
      'Sin filtro';

    worksheet.addRow([]);

    worksheet.addRow([
      'Estudiante',
      'Tipo documento',
      'Documento',
      'Familia',
      'Código familia',
      'Apoderado',
      'Documento apoderado',
      'Ciclo',
      'Grado / Nivel',
      'Aula',
      'Turno',
      'Estado',
      'Fecha pago',
      'N° operación',
      'Estado matrícula',
    ]);

    for (
      const row
      of rows
    ) {
      worksheet.addRow([
        row.student
          .fullName,
        row.student
          .documentType,
        row.student
          .documentNumber ??
          '',
        row.family
          ?.name ??
          '',
        row.family
          ?.code ??
          '',
        row.guardian
          ?.fullName ??
          '',
        row.guardian
          ?.documentNumber ??
          '',
        row.academic
          .cycleName,
        row.academic
          .educationLevelName,
        row.academic
          .classroomName,
        row.academic
          .shiftName,
        row.status,
        row.payment
          ?.paymentDate ??
          '',
        row.payment
          ?.operationNumber ??
          '',
        row.enrollmentStatus,
      ]);
    }

    worksheet.columns = [
      { width: 35 },
      { width: 16 },
      { width: 18 },
      { width: 30 },
      { width: 20 },
      { width: 35 },
      { width: 20 },
      { width: 18 },
      { width: 20 },
      { width: 20 },
      { width: 18 },
      { width: 14 },
      { width: 16 },
      { width: 22 },
      { width: 18 },
    ];

    worksheet.views = [
      {
        state: 'frozen',
        ySplit: 6,
      },
    ];

    const header =
      worksheet.getRow(6);

    header.font = {
      bold: true,
    };

    header.alignment = {
      vertical:
        'middle',
      horizontal:
        'center',
    };

    worksheet.autoFilter =
      'A6:O6';

    const excelBuffer =
      await workbook.xlsx
        .writeBuffer();

    return {
      buffer:
        Buffer.from(
          excelBuffer,
        ),

      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

      filename:
        `reporte-taller-${period.year}.xlsx`,
    };
  }

  // ============================================================
  // EXPORTACIÓN APAFA - PDF
  // ============================================================

  async exportApafaPdf(
    query:
      ApafaReportQueryDto,
  ): Promise<ExportResult> {
    const families = await this.prisma.family_groups.findMany({
      where: this.buildApafaWhere(query),
      select: { id: true },
    });
    const allowedFamilyIds = new Set(families.map((family) => family.id));
    const result = await this.getPaymentsReportData({ schoolPeriodId: query.schoolPeriodId });
    const rows = result.rows
      .filter((row) => allowedFamilyIds.has(row.family.id))
      .map((row) => ({
        sort: row.academic,
        student: row.student.fullName,
        classroom: row.academic.classroomName,
        shift: row.academic.shiftName,
        status: row.apafa.status,
        date: this.formatPdfDate(row.apafa.paymentDate),
      }));
    const filters = [
      query.status && query.status !== 'ALL' && `APAFA: ${query.status}`,
      query.search && `Búsqueda: ${query.search}`,
    ].filter((value): value is string => Boolean(value));
    const buffer = await this.createSimpleReportPdf(
      'REPORTE DE PAGOS APAFA', result.schoolPeriod.year, filters,
      [
        { title: 'Estudiante', key: 'student', width: 190 },
        { title: 'Aula', key: 'classroom', width: 145 },
        { title: 'Turno', key: 'shift', width: 85 },
        { title: 'Estado APAFA', key: 'status', width: 110 },
        { title: 'Fecha APAFA', key: 'date', width: 105 },
      ],
      rows,
    );
    return { buffer, contentType: 'application/pdf', filename: `reporte-apafa-${result.schoolPeriod.year}.pdf` };
  }

  // ============================================================
  // EXPORTACIÓN TALLER - PDF
  // ============================================================

  async exportTallerPdf(
    query:
      TallerReportQueryDto,
  ): Promise<ExportResult> {
    const period =
      await this.getPeriodOrThrow(
        query.schoolPeriodId,
      );

    const enrollments =
      await this.prisma
        .enrollments
        .findMany({
          where:
            this.buildTallerWhere(
              query,
            ),

          include:
            this.getTallerInclude(
              query
                .schoolPeriodId,
            ),

          orderBy: [
            {
              classrooms: {
                education_levels: {
                  name: 'asc',
                },
              },
            },
            {
              classrooms: {
                name: 'asc',
              },
            },
          ],
        });

    const rows =
      enrollments.map(
        (enrollment) =>
          this.mapTallerEnrollment(
            enrollment,
          ),
      );

    const mappedRows = rows.map((row) => ({
      sort: row.academic,
      student: row.student.fullName,
      classroom: row.academic.classroomName,
      shift: row.academic.shiftName,
      status: row.status,
      date: this.formatPdfDate(row.payment?.paymentDate),
    }));
    const filters = [
      query.educationLevelId && `Nivel: ${rows[0]?.academic.educationLevelName ?? query.educationLevelId}`,
      query.classroomId && `Aula: ${rows[0]?.academic.classroomName ?? query.classroomId}`,
      query.shiftId && `Turno: ${rows[0]?.academic.shiftName ?? query.shiftId}`,
      query.status && query.status !== 'ALL' && `Taller: ${query.status}`,
      query.search && `Búsqueda: ${query.search}`,
    ].filter((value): value is string => Boolean(value));
    const buffer = await this.createSimpleReportPdf(
      'REPORTE DE PAGOS TALLER', period.year, filters,
      [
        { title: 'Estudiante', key: 'student', width: 190 },
        { title: 'Aula', key: 'classroom', width: 145 },
        { title: 'Turno', key: 'shift', width: 85 },
        { title: 'Estado Taller', key: 'status', width: 110 },
        { title: 'Fecha Taller', key: 'date', width: 105 },
      ],
      mappedRows,
    );

    return {
      buffer,

      contentType:
        'application/pdf',

      filename:
        `reporte-taller-${period.year}.pdf`,
    };
  }

  private async getPaymentsReportData(query: PaymentsReportQueryDto) {
    const period = await this.getPeriodOrThrow(query.schoolPeriodId);
    const enrollments = await this.prisma.enrollments.findMany({
      where: {
        school_period_id: query.schoolPeriodId,
        ...(query.classroomId ? { classroom_id: query.classroomId } : {}),
        ...((query.cycleId || query.educationLevelId || query.shiftId) ? {
          classrooms: {
            ...(query.educationLevelId ? { education_level_id: query.educationLevelId } : {}),
            ...(query.shiftId ? { shift_id: query.shiftId } : {}),
            ...(query.cycleId ? { education_levels: { cycle_id: query.cycleId } } : {}),
          },
        } : {}),
      },
      include: {
        classrooms: { include: { shifts: true, education_levels: { include: { education_cycles: true } } } },
        students: {
          include: {
            persons: {
              include: {
                family_members: {
                  where: { relationship_type: 'ESTUDIANTE' },
                  include: {
                    family_groups: {
                      include: {
                        family_members: { include: { persons: true } },
                        payment_family_items: {
                          where: { school_period_id: query.schoolPeriodId },
                          include: { payments: true }, take: 1,
                        },
                      },
                    },
                  },
                },
              },
            },
            payment_student_items: {
              where: { school_period_id: query.schoolPeriodId },
              include: { payments: true }, take: 1,
            },
          },
        },
      },
    });

    const rows = enrollments.map((enrollment: any) => {
      const studentPerson = enrollment.students.persons;
      const family = studentPerson.family_members[0]?.family_groups ?? null;
      const members = family?.family_members ?? [];
      const guardianMember = members.find((member: any) => member.is_guardian);
      const fatherMember = members.find((member: any) => member.relationship_type === 'PADRE');
      const motherMember = members.find((member: any) => member.relationship_type === 'MADRE');
      const apafaItem = family?.payment_family_items[0] ?? null;
      const tallerItem = enrollment.students.payment_student_items[0] ?? null;
      const mapContact = (member: any) => member ? {
        ...this.mapPerson(member.persons),
        phone: member.persons.phone,
        email: member.persons.email,
        relationship: member.relationship_type,
      } : null;
      return {
        enrollmentId: enrollment.id,
        family: family ? { id: family.id, code: family.code, name: family.name } : { id: '', code: null, name: 'Sin familia' },
        guardian: mapContact(guardianMember), father: mapContact(fatherMember), mother: mapContact(motherMember),
        student: {
          ...this.mapPerson(studentPerson), code: enrollment.students.student_code,
          firstName: studentPerson.first_name,
          lastNameFather: studentPerson.last_name_father,
          lastNameMother: studentPerson.last_name_mother,
        },
        academic: {
          cycleId: enrollment.classrooms.education_levels.education_cycles.id,
          cycleCode: enrollment.classrooms.education_levels.education_cycles.code,
          cycleName: enrollment.classrooms.education_levels.education_cycles.name,
          educationLevelId: enrollment.classrooms.education_levels.id,
          educationLevelName: enrollment.classrooms.education_levels.name,
          classroomId: enrollment.classrooms.id, classroomName: enrollment.classrooms.name,
          shiftId: enrollment.classrooms.shifts.id, shiftName: enrollment.classrooms.shifts.name,
          shiftCode: enrollment.classrooms.shifts.code,
        },
        apafa: { status: apafaItem ? 'PAGADO' : 'NO_PAGADO', paymentDate: apafaItem ? this.formatDate(apafaItem.payments.payment_date) : null },
        taller: { status: tallerItem ? 'PAGADO' : 'NO_PAGADO', paymentDate: tallerItem ? this.formatDate(tallerItem.payments.payment_date) : null },
      };
    }).filter((row) => {
      if (query.apafaStatus && query.apafaStatus !== 'ALL' && row.apafa.status !== query.apafaStatus) return false;
      if (query.tallerStatus && query.tallerStatus !== 'ALL' && row.taller.status !== query.tallerStatus) return false;
      if (query.status && query.status !== 'ALL') {
        const paymentType = query.paymentType ?? 'ALL';
        if (paymentType === 'APAFA' && row.apafa.status !== query.status) return false;
        if (paymentType === 'TALLER' && row.taller.status !== query.status) return false;
        if (paymentType === 'ALL' && row.apafa.status !== query.status && row.taller.status !== query.status) return false;
      }
      const search = query.search?.trim().toLocaleLowerCase('es');
      if (!search) return true;
      return [row.family.code, row.family.name, row.guardian?.fullName, row.student.fullName, row.student.documentNumber]
        .some((value) => value?.toLocaleLowerCase('es').includes(search));
    }).sort((left, right) => {
      const compare = (a: string, b: string) => a.localeCompare(b, 'es', { sensitivity: 'base' });
      return compare(left.academic.cycleName, right.academic.cycleName)
        || compare(left.academic.educationLevelName, right.academic.educationLevelName)
        || compare(left.academic.classroomName, right.academic.classroomName)
        || compare(left.academic.shiftName, right.academic.shiftName)
        || compare(left.student.fullName, right.student.fullName);
    });
    const families = new Map<string, string>();
    for (const row of rows) if (row.family.id) families.set(row.family.id, row.apafa.status);
    const familyStatuses = [...families.values()];
    return {
      schoolPeriod: this.mapPeriod(period), rows,
      statistics: {
        visibleFamilies: families.size, visibleStudents: rows.length,
        apafaPaid: familyStatuses.filter((status) => status === 'PAGADO').length,
        apafaUnpaid: familyStatuses.filter((status) => status === 'NO_PAGADO').length,
        tallerPaid: rows.filter((row) => row.taller.status === 'PAGADO').length,
        tallerUnpaid: rows.filter((row) => row.taller.status === 'NO_PAGADO').length,
      },
    };
  }

  // ============================================================
  // WHERE APAFA
  // ============================================================

  private buildApafaWhere(
    query:
      ApafaReportQueryDto,
  ): Prisma.family_groupsWhereInput {
    const status:
      ReportStatus =
        query.status ??
        'ALL';

    const search =
      query.search
        ?.trim() ||
      undefined;

    const conditions:
      Prisma.family_groupsWhereInput[] =
      [
        {
          family_members: {
            some: {
              relationship_type:
                'ESTUDIANTE',

              persons: {
                students: {
                  is: {
                    enrollments: {
                      some: {
                        school_period_id:
                          query
                            .schoolPeriodId,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      ];

    if (
      status ===
      'PAGADO'
    ) {
      conditions.push({
        payment_family_items: {
          some: {
            school_period_id:
              query
                .schoolPeriodId,
          },
        },
      });
    }

    if (
      status ===
      'NO_PAGADO'
    ) {
      conditions.push({
        payment_family_items: {
          none: {
            school_period_id:
              query
                .schoolPeriodId,
          },
        },
      });
    }

    if (search) {
      conditions.push({
        OR: [
          {
            code: {
              contains:
                search,
              mode:
                'insensitive',
            },
          },

          {
            name: {
              contains:
                search,
              mode:
                'insensitive',
            },
          },

          {
            family_members: {
              some: {
                persons: {
                  OR: [
                    {
                      document_number:
                        {
                          contains:
                            search,

                          mode:
                            'insensitive',
                        },
                    },

                    {
                      first_name:
                        {
                          contains:
                            search,

                          mode:
                            'insensitive',
                        },
                    },

                    {
                      last_name_father:
                        {
                          contains:
                            search,

                          mode:
                            'insensitive',
                        },
                    },

                    {
                      last_name_mother:
                        {
                          contains:
                            search,

                          mode:
                            'insensitive',
                        },
                    },
                  ],
                },
              },
            },
          },
        ],
      });
    }

    return {
      AND:
        conditions,
    };
  }

  // ============================================================
  // WHERE TALLER
  // ============================================================

  private buildTallerWhere(
    query:
      TallerReportQueryDto,
  ): Prisma.enrollmentsWhereInput {
    const status:
      ReportStatus =
        query.status ??
        'ALL';

    const search =
      query.search
        ?.trim() ||
      undefined;

    const conditions:
      Prisma.enrollmentsWhereInput[] =
      [
        {
          school_period_id:
            query
              .schoolPeriodId,
        },
      ];

    if (
      query
        .educationLevelId
    ) {
      conditions.push({
        classrooms: {
          education_level_id:
            query
              .educationLevelId,
        },
      });
    }

    if (
      query
        .classroomId
    ) {
      conditions.push({
        classroom_id:
          query
            .classroomId,
      });
    }

    if (
      query.shiftId
    ) {
      conditions.push({
        classrooms: {
          shift_id:
            query.shiftId,
        },
      });
    }

    if (
      status ===
      'PAGADO'
    ) {
      conditions.push({
        students: {
          payment_student_items:
            {
              some: {
                school_period_id:
                  query
                    .schoolPeriodId,
              },
            },
        },
      });
    }

    if (
      status ===
      'NO_PAGADO'
    ) {
      conditions.push({
        students: {
          payment_student_items:
            {
              none: {
                school_period_id:
                  query
                    .schoolPeriodId,
              },
            },
        },
      });
    }

    if (search) {
      conditions.push({
        OR: [
          {
            students: {
              persons: {
                OR: [
                  {
                    document_number:
                      {
                        contains:
                          search,

                        mode:
                          'insensitive',
                      },
                  },

                  {
                    first_name:
                      {
                        contains:
                          search,

                        mode:
                          'insensitive',
                      },
                  },

                  {
                    last_name_father:
                      {
                        contains:
                          search,

                        mode:
                          'insensitive',
                      },
                  },

                  {
                    last_name_mother:
                      {
                        contains:
                          search,

                        mode:
                          'insensitive',
                      },
                  },
                ],
              },
            },
          },

          {
            students: {
              persons: {
                family_members: {
                  some: {
                    relationship_type:
                      'ESTUDIANTE',

                    family_groups: {
                      OR: [
                        {
                          code: {
                            contains:
                              search,

                            mode:
                              'insensitive',
                          },
                        },

                        {
                          name: {
                            contains:
                              search,

                            mode:
                              'insensitive',
                          },
                        },

                        {
                          family_members:
                            {
                              some: {
                                is_guardian:
                                  true,

                                persons:
                                  {
                                    OR: [
                                      {
                                        document_number:
                                          {
                                            contains:
                                              search,

                                            mode:
                                              'insensitive',
                                          },
                                      },

                                      {
                                        first_name:
                                          {
                                            contains:
                                              search,

                                            mode:
                                              'insensitive',
                                          },
                                      },

                                      {
                                        last_name_father:
                                          {
                                            contains:
                                              search,

                                            mode:
                                              'insensitive',
                                          },
                                      },

                                      {
                                        last_name_mother:
                                          {
                                            contains:
                                              search,

                                            mode:
                                              'insensitive',
                                          },
                                      },
                                    ],
                                  },
                              },
                            },
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
        ],
      });
    }

    return {
      AND:
        conditions,
    };
  }

  // ============================================================
  // INCLUDE APAFA
  // ============================================================

  private getApafaInclude(
    schoolPeriodId:
      string,
  ) {
    return {
      family_members: {
        include: {
          persons: {
            include: {
              students: {
                include: {
                  enrollments: {
                    where: {
                      school_period_id:
                        schoolPeriodId,
                    },

                    select: {
                      id: true,
                    },
                  },
                },
              },
            },
          },
        },
      },

      payment_family_items:
        {
          where: {
            school_period_id:
              schoolPeriodId,
          },

          include: {
            payments: true,
          },

          take: 1,
        },
    } satisfies Prisma.family_groupsInclude;
  }

  // ============================================================
  // INCLUDE TALLER
  // ============================================================

  private getTallerInclude(
    schoolPeriodId:
      string,
  ) {
    return {
      classrooms: {
        include: {
          education_levels: {
            include: {
              education_cycles:
                true,
            },
          },

          shifts:
            true,
        },
      },

      students: {
        include: {
          persons: {
            include: {
              family_members: {
                where: {
                  relationship_type:
                    'ESTUDIANTE',
                },

                include: {
                  family_groups: {
                    include: {
                      family_members: {
                        where: {
                          is_guardian:
                            true,
                        },

                        include: {
                          persons:
                            true,
                        },

                        take: 1,
                      },
                    },
                  },
                },
              },
            },
          },

          payment_student_items:
            {
              where: {
                school_period_id:
                  schoolPeriodId,
              },

              include: {
                payments:
                  true,
              },

              take: 1,
            },
        },
      },
    } satisfies Prisma.enrollmentsInclude;
  }

  // ============================================================
  // MAP APAFA
  // ============================================================

  private mapApafaFamily(
    family: any,
  ) {
    const guardianMember =
      family.family_members.find(
        (member: any) =>
          member.is_guardian,
      );

    const guardian =
      guardianMember
        ? this.mapPerson(
            guardianMember
              .persons,
          )
        : null;

    const studentsCount =
      family.family_members.filter(
        (member: any) =>
          member
            .relationship_type ===
            'ESTUDIANTE' &&
          member
            .persons
            .students
            ?.enrollments
            ?.length >
            0,
      ).length;

    const paymentItem =
      family
        .payment_family_items[0] ??
      null;

    return {
      familyId:
        family.id,

      familyCode:
        family.code,

      familyName:
        family.name,

      guardian,

      studentsCount,

      status:
        paymentItem
          ? 'PAGADO'
          : 'NO_PAGADO',

      payment:
        paymentItem
          ? {
              paymentId:
                paymentItem
                  .payment_id,

              paymentDate:
                this.formatDate(
                  paymentItem
                    .payments
                    .payment_date,
                ),

              operationNumber:
                paymentItem
                  .payments
                  .operation_number,

              registeredAt:
                paymentItem
                  .payments
                  .created_at
                  .toISOString(),
            }
          : null,
    };
  }

  // ============================================================
  // MAP TALLER
  // ============================================================

  private mapTallerEnrollment(
    enrollment: any,
  ) {
    const student =
      enrollment.students;

    const person =
      student.persons;

    const familyMembership =
      person
        .family_members[0] ??
      null;

    const family =
      familyMembership
        ?.family_groups ??
      null;

    const guardianMember =
      family
        ?.family_members?.[0] ??
      null;

    const guardian =
      guardianMember
        ? this.mapPerson(
            guardianMember
              .persons,
          )
        : null;

    const paymentItem =
      student
        .payment_student_items[0] ??
      null;

    const classroom =
      enrollment.classrooms;

    const educationLevel =
      classroom
        .education_levels;

    const cycle =
      educationLevel
        .education_cycles;

    const shift =
      classroom.shifts;

    return {
      enrollmentId:
        enrollment.id,

      enrollmentStatus:
        enrollment.status,

      studentId:
        student.id,

      student:
        this.mapPerson(
          person,
        ),

      family:
        family
          ? {
              id:
                family.id,

              code:
                family.code,

              name:
                family.name,
            }
          : null,

      guardian,

      academic: {
        cycleId:
          cycle.id,

        cycleCode:
          cycle.code,

        cycleName:
          cycle.name,

        educationLevelId:
          educationLevel.id,

        educationLevelName:
          educationLevel.name,

        classroomId:
          classroom.id,

        classroomName:
          classroom.name,

        shiftId:
          shift.id,

        shiftCode:
          shift.code,

        shiftName:
          shift.name,
      },

      status:
        paymentItem
          ? 'PAGADO'
          : 'NO_PAGADO',

      payment:
        paymentItem
          ? {
              paymentId:
                paymentItem
                  .payment_id,

              paymentDate:
                this.formatDate(
                  paymentItem
                    .payments
                    .payment_date,
                ),

              operationNumber:
                paymentItem
                  .payments
                  .operation_number,

              registeredAt:
                paymentItem
                  .payments
                  .created_at
                  .toISOString(),
            }
          : null,
    };
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private async getPeriodOrThrow(
    id: string,
  ) {
    const period =
      await this.prisma
        .school_periods
        .findUnique({
          where: {
            id,
          },
        });

    if (!period) {
      throw new NotFoundException(
        'El período escolar no existe',
      );
    }

    return period;
  }

  private mapPeriod(
    period: {
      id: string;
      year: number;
      status: string;
      is_active: boolean;
    },
  ) {
    return {
      id: period.id,
      year:
        period.year,
      status:
        period.status,
      isActive:
        period.is_active,
    };
  }

  private mapPerson(
    person: {
      id: string;
      first_name: string;
      last_name_father:
        string | null;
      last_name_mother:
        string | null;
      document_type:
        string;
      document_number:
        string | null;
    },
  ): PersonSummary {
    return {
      personId:
        person.id,

      fullName:
        this.buildFullName({
          firstName:
            person.first_name,

          lastNameFather:
            person
              .last_name_father,

          lastNameMother:
            person
              .last_name_mother,
        }),

      documentType:
        person.document_type,

      documentNumber:
        person.document_number,
    };
  }

  private buildFullName(
    data: {
      firstName: string;

      lastNameFather:
        string | null;

      lastNameMother:
        string | null;
    },
  ): string {
    return [
      data.firstName,
      data.lastNameFather,
      data.lastNameMother,
    ]
      .filter(
        (
          value,
        ): value is string =>
          typeof value ===
            'string' &&
          value.trim().length >
            0,
      )
      .join(' ')
      .replace(
        /\s+/g,
        ' ',
      )
      .trim();
  }

  private formatDate(
    date: Date,
  ): string {
    return date
      .toISOString()
      .slice(
        0,
        10,
      );
  }

  private formatPdfDate(value: string | null | undefined): string {
    if (!value) return '-';
    const [year, month, day] = value.split('-');
    return year && month && day ? `${day}/${month}/${year}` : value;
  }

  private getPaymentsPdfHorizontalLayout(contentLeft: number) {
    return {
      criteriaTitleX: contentLeft,
      summaryTitleX: contentLeft,
      studentsTitleX: contentLeft,
      tableX: contentLeft,
    } as const;
  }

  private createPaymentsPdf(
    year: number,
    criteria: string[],
    columns: Array<{ title: string; key: string; width: number }>,
    rows: Array<Record<string, any>>,
    statistics: { visibleFamilies: number; visibleStudents: number; apafaPaid: number; apafaUnpaid: number; tallerPaid: number; tallerUnpaid: number },
    paymentType: 'ALL' | 'APAFA' | 'TALLER',
  ): Promise<Buffer> {
    return new Promise((resolveBuffer, reject) => {
      const document = new PDFDocument({
        size: 'A4', layout: 'landscape', margin: 28, bufferPages: true,
        info: { Title: 'Sistema de Control de Pagos - Reporte de pagos', Author: 'Sistema de Control de Pagos' },
      });
      const chunks: Buffer[] = [];
      document.on('data', (chunk: Buffer) => chunks.push(chunk));
      document.on('error', reject);
      document.on('end', () => resolveBuffer(Buffer.concat(chunks)));
      const contentLeft = document.page.margins.left;
      const horizontalLayout = this.getPaymentsPdfHorizontalLayout(contentLeft);
      const contentRight = document.page.width - document.page.margins.right;
      const contentWidth = contentRight - contentLeft;
      const pageHeight = document.page.height;
      const marginTop = document.page.margins.top;
      const marginBottom = document.page.margins.bottom;
      const contentTop = marginTop;
      const footerHeight = 9;
      const footerY = pageHeight - marginBottom - footerHeight;
      const contentBottom = footerY - 5;
      const columnWeights: Record<string, number> = paymentType === 'ALL'
        ? { number: 4, student: 28, cycleLevel: 19, shift: 10, classroom: 14, apafa: 12.5, taller: 12.5 }
        : { number: 5, student: 34, cycleLevel: 23, shift: 11, classroom: 16, apafa: 12, taller: 12 };
      const activeWeight = columns.reduce((sum, column) => sum + (columnWeights[column.key] ?? 10), 0);
      const layoutColumns = columns.map((column) => ({
        ...column,
        title: column.key.endsWith('Date') ? 'Fecha' : column.title,
        width: contentWidth * (columnWeights[column.key] ?? 10) / activeWeight,
      }));
      const tableWidth = contentWidth;
      const logoPath = resolve(process.cwd(), '../frontend/public/images/insignia-jardin-85.png');
      const generatedAt = new Date();
      const generatedDate = new Intl.DateTimeFormat('es-PE', {
        timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric',
      }).format(generatedAt);
      const generatedTime = new Intl.DateTimeFormat('es-PE', {
        timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hour12: false,
      }).format(generatedAt);

      const header = () => {
        if (existsSync(logoPath)) document.image(logoPath, contentLeft, 16, { fit: [66, 66] });
        const institutionX = contentLeft + 78;
        const institutionWidth = contentWidth - 286;
        document.fillColor('#1e293b').font('Helvetica-Bold').fontSize(13)
          .text('I.E.I. Cuna Jardín N.° 85', institutionX, 20, { width: institutionWidth, align: 'center' });
        document.fillColor('#334155').font('Helvetica').fontSize(10)
          .text('“María Inmaculada Concepción”', institutionX, 40, { width: institutionWidth, align: 'center' });
        document.fontSize(9).text('Chancay', institutionX, 55, { width: institutionWidth, align: 'center' });
        document.fillColor('#991b1b').font('Helvetica-Bold').fontSize(8.5)
          .text('SISTEMA DE CONTROL DE PAGOS', institutionX, 69, { width: institutionWidth, align: 'center' });

        const dateX = contentRight - 172;
        document.roundedRect(dateX, 24, 172, 48, 3).fillAndStroke('#f8fafc', '#cbd5e1');
        document.fillColor('#64748b').font('Helvetica-Bold').fontSize(7.5)
          .text('REPORTE GENERADO EL:', dateX + 10, 32, { width: 152, align: 'center' });
        document.fillColor('#1e293b').font('Helvetica-Bold').fontSize(10)
          .text(`${generatedDate}  ${generatedTime}`, dateX + 10, 48, { width: 152, align: 'center' });

        document.moveTo(contentLeft, 88).lineTo(contentRight, 88).strokeColor('#991b1b').lineWidth(1.5).stroke();
        document.fillColor('#991b1b').font('Helvetica-Bold').fontSize(17)
          .text('REPORTE DE PAGOS INSTITUCIONALES', contentLeft, 98, { width: contentWidth, align: 'center' });
        document.fillColor('#64748b').font('Helvetica').fontSize(8.5)
          .text('Resumen de pagos de APAFA y Taller por estudiante.', contentLeft, 121, { width: contentWidth, align: 'center' });
        return 140;
      };
      let cursorY = header();
      const bandHeight = 70;
      const criteriaWidth = contentWidth * 0.6;
      const summaryX = contentLeft + criteriaWidth;
      const summaryWidth = contentWidth - criteriaWidth;
      document.roundedRect(contentLeft, cursorY, contentWidth, bandHeight, 4).fillAndStroke('#f8fafc', '#cbd5e1');
      document.moveTo(summaryX, cursorY).lineTo(summaryX, cursorY + bandHeight).strokeColor('#cbd5e1').lineWidth(0.7).stroke();
      document.fillColor('#991b1b').font('Helvetica-Bold').fontSize(9)
        .text('CRITERIOS DEL REPORTE', contentLeft + 10, cursorY + 7, { width: criteriaWidth - 20 });
      document.fillColor('#991b1b').font('Helvetica-Bold').fontSize(9)
        .text('RESUMEN CUANTITATIVO', summaryX + 10, cursorY + 7, { width: summaryWidth - 20 });

      const criterionWidth = (criteriaWidth - 30) / 2;
      criteria.forEach((criterion, index) => {
        const separator = criterion.indexOf(':');
        const label = separator >= 0 ? criterion.slice(0, separator) : criterion;
        const value = separator >= 0 ? criterion.slice(separator + 1).trim() : '';
        const column = index % 2;
        const row = Math.floor(index / 2);
        const x = contentLeft + 10 + column * (criterionWidth + 10);
        const y = cursorY + 24 + row * 11;
        document.fillColor('#475569').font('Helvetica-Bold').fontSize(7.2)
          .text(`${label}:`, x, y, { width: 76, lineBreak: false });
        document.fillColor('#1e293b').font('Helvetica').fontSize(7.2)
          .text(value, x + 78, y, { width: criterionWidth - 78, lineBreak: false });
      });

      const summaryColumns = paymentType === 'ALL' ? 3 : 2;
      const summaryColumnWidth = (summaryWidth - 20) / summaryColumns;
      const drawSummaryTotal = (x: number, width: number) => {
        document.fillColor('#64748b').font('Helvetica').fontSize(7.2)
          .text('Total estudiantes', x, cursorY + 25, { width, align: 'center' });
        document.fillColor('#0f172a').font('Helvetica-Bold').fontSize(17)
          .text(String(statistics.visibleStudents), x, cursorY + 39, { width, align: 'center' });
      };
      const drawPaymentSummary = (label: string, paid: number, unpaid: number, x: number, width: number) => {
        document.fillColor('#334155').font('Helvetica-Bold').fontSize(8)
          .text(label, x, cursorY + 24, { width, align: 'center' });
        document.fillColor('#15803d').font('Helvetica-Bold').fontSize(8)
          .text(`${paid} PAGO`, x, cursorY + 40, { width, align: 'center' });
        document.fillColor('#b91c1c').font('Helvetica-Bold').fontSize(8)
          .text(`${unpaid} DEBE`, x, cursorY + 53, { width, align: 'center' });
      };
      const summaryStartX = summaryX + 10;
      drawSummaryTotal(summaryStartX, summaryColumnWidth);
      if (paymentType !== 'TALLER') {
        drawPaymentSummary('APAFA', statistics.apafaPaid, statistics.apafaUnpaid, summaryStartX + summaryColumnWidth, summaryColumnWidth);
      }
      if (paymentType !== 'APAFA') {
        drawPaymentSummary('Taller', statistics.tallerPaid, statistics.tallerUnpaid, summaryStartX + summaryColumnWidth * (paymentType === 'ALL' ? 2 : 1), summaryColumnWidth);
      }

      cursorY += bandHeight + 5;
      document.fillColor('#991b1b').font('Helvetica-Bold').fontSize(10)
        .text('DETALLE DE ESTUDIANTES', horizontalLayout.studentsTitleX, cursorY, { width: contentWidth, align: 'left', continued: false });
      cursorY += 14;
      const drawTableHeader = (y: number) => {
        const groupHeight = 16;
        const tableHeaderHeight = 34;
        document.rect(horizontalLayout.tableX, y, tableWidth, tableHeaderHeight).fillAndStroke('#991b1b', '#7f1d1d');
        let x = horizontalLayout.tableX;
        const paymentColumns = layoutColumns.filter((column) => column.key === 'apafa' || column.key === 'taller');
        layoutColumns.filter((column) => column.key !== 'apafa' && column.key !== 'taller').forEach((column) => {
          document.rect(x, y, column.width, tableHeaderHeight).strokeColor('#fecaca').lineWidth(0.5).stroke();
          document.fillColor('#ffffff').font('Helvetica-Bold').fontSize(7.5)
            .text(column.title, x + 4, y + 12, { width: column.width - 8, align: 'center' });
          x += column.width;
        });
        const paymentsWidth = paymentColumns.reduce((sum, column) => sum + column.width, 0);
        if (paymentColumns.length === 1) {
          document.rect(x, y, paymentsWidth, tableHeaderHeight).strokeColor('#fecaca').lineWidth(0.5).stroke();
          document.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8)
            .text(paymentColumns[0].title, x + 4, y + 12, { width: paymentsWidth - 8, align: 'center' });
        } else {
          document.rect(x, y, paymentsWidth, groupHeight).strokeColor('#fecaca').lineWidth(0.5).stroke();
          document.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8)
            .text('PAGOS', x + 4, y + 4, { width: paymentsWidth - 8, align: 'center' });
          paymentColumns.forEach((column) => {
            document.rect(x, y + groupHeight, column.width, tableHeaderHeight - groupHeight)
              .fillAndStroke('#b91c1c', '#fecaca');
            document.fillColor('#ffffff').font('Helvetica-Bold').fontSize(7.5)
              .text(column.title, x + 4, y + groupHeight + 5, { width: column.width - 8, align: 'center' });
            x += column.width;
          });
        }
        document.y = y + tableHeaderHeight;
      };
      drawTableHeader(cursorY);
      rows.forEach((row) => {
        document.font('Helvetica').fontSize(7.5);
        const height = Math.max(23, ...layoutColumns.filter((column) => column.key !== 'apafa' && column.key !== 'taller')
          .map((column) => document.heightOfString(String(row[column.key] ?? '-'), { width: column.width - 8 }) + 8));
        if (document.y + height > contentBottom) { document.addPage(); drawTableHeader(contentTop); }
        const y = document.y;
        let x = contentLeft;
        layoutColumns.forEach((column) => {
          document.rect(x, y, column.width, height).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
          const isPayment = column.key === 'apafa' || column.key === 'taller';
          if (isPayment) {
            const payment = row[column.key] as { status: 'PAGO' | 'DEBE'; date: string };
            const badgeWidth = Math.min(38, column.width - 12);
            const badgeX = x + (column.width - badgeWidth) / 2;
            document.roundedRect(badgeX, y + 2.5, badgeWidth, 10.5, 2)
              .fill(payment.status === 'PAGO' ? '#dcfce7' : '#fee2e2');
            document.fillColor(payment.status === 'PAGO' ? '#166534' : '#991b1b')
              .font('Helvetica-Bold').fontSize(6.8)
              .text(payment.status, badgeX, y + 4.2, { width: badgeWidth, align: 'center', lineBreak: false });
            document.fillColor('#334155').font('Helvetica').fontSize(6.7)
              .text(payment.date, x + 4, y + 15, { width: column.width - 8, align: 'center', lineBreak: false });
          } else {
            document.fillColor('#334155').font('Helvetica').fontSize(7.5)
              .text(String(row[column.key] ?? '-'), x + 4, y + 7.5, { width: column.width - 8, align: column.key === 'number' ? 'center' : 'left' });
          }
          x += column.width;
        });
        document.y = y + height;
      });
      const range = document.bufferedPageRange();
      for (let index = 0; index < range.count; index += 1) {
        document.switchToPage(index);
        document.save();
        document.fillColor('#64748b').font('Helvetica').fontSize(7.5)
          .text('Documento generado automáticamente por el Sistema de Control de Pagos.', contentLeft, footerY, { width: 360, height: footerHeight, lineBreak: false })
          .text(`Página ${index + 1} de ${range.count}`, contentRight - 100, footerY, { width: 100, height: footerHeight, align: 'right', lineBreak: false });
        document.restore();
      }
      document.end();
    });
  }

  private createSimpleReportPdf(
    title: string,
    year: number,
    filters: string[],
    columns: Array<{ title: string; key: string; width: number }>,
    rows: Array<{
      sort: {
        cycleName: string;
        educationLevelName: string;
        classroomName: string;
        shiftName: string;
      };
      [key: string]: unknown;
    }>,
  ): Promise<Buffer> {
    const sorted = [...rows].sort((left, right) => {
      const compare = (a: string, b: string) => a.localeCompare(b, 'es', { sensitivity: 'base' });
      return compare(left.sort.cycleName, right.sort.cycleName)
        || compare(left.sort.educationLevelName, right.sort.educationLevelName)
        || compare(left.sort.classroomName, right.sort.classroomName)
        || compare(left.sort.shiftName, right.sort.shiftName)
        || compare(String(left.student), String(right.student));
    });
    return this.createPdf((document) => {
      const left = document.page.margins.left;
      const bottom = document.page.height - document.page.margins.bottom;
      document.font('Helvetica').fontSize(10).text('I.E.I. Cuna Jardín N.° 85 · María Inmaculada Concepción', { align: 'center' });
      document.moveDown(0.5).font('Helvetica-Bold').fontSize(15).text(title, { align: 'center' });
      const generatedOn = new Intl.DateTimeFormat('es-PE', {
        timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric',
      }).format(new Date());
      document.moveDown(0.5).font('Helvetica').fontSize(9)
        .text(`Período escolar: ${year}    ·    Generado el ${generatedOn}`);
      if (filters.length) {
        document.text(`Filtros: ${filters.join(' · ')}`);
      }
      document.moveDown();

      const drawHeader = () => {
        const y = document.y;
        document.rect(left, y, columns.reduce((sum, column) => sum + column.width, 0), 25).fill('#e2e8f0');
        let x = left;
        document.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9);
        for (const column of columns) {
          document.text(column.title, x + 5, y + 7, { width: column.width - 10, height: 16 });
          x += column.width;
        }
        document.y = y + 25;
      };
      drawHeader();

      if (!sorted.length) {
        document.moveDown().font('Helvetica').fontSize(10).text('No se encontraron estudiantes para los filtros aplicados.');
      }
      for (const row of sorted) {
        document.font('Helvetica').fontSize(9);
        const height = Math.max(25, ...columns.map((column) =>
          document.heightOfString(String(row[column.key] ?? '-'), { width: column.width - 10 }) + 12,
        ));
        if (document.y + height > bottom) {
          document.addPage();
          drawHeader();
        }
        const y = document.y;
        let x = left;
        for (const column of columns) {
          document.fillColor('#0f172a').font('Helvetica').fontSize(9)
            .text(String(row[column.key] ?? '-'), x + 5, y + 6, {
              width: column.width - 10,
              height: height - 12,
            });
          x += column.width;
        }
        document.moveTo(left, y + height).lineTo(x, y + height).strokeColor('#cbd5e1').stroke();
        document.y = y + height;
      }
    });
  }

  private calculatePercentage(
    value: number,
    total: number,
  ): number {
    if (
      total === 0
    ) {
      return 0;
    }

    return Number(
      (
        (value / total) *
        100
      ).toFixed(2),
    );
  }

  private createPdf(
    write:
      (
        document:
          PDFKit.PDFDocument,
      ) => void,
  ): Promise<Buffer> {
    return new Promise(
      (
        resolve,
        reject,
      ) => {
        const document =
          new PDFDocument({
            size: 'A4',
            layout: 'landscape',
            margin: 45,
            info: {
              Title:
                'Sistema de Control de Pagos - Reporte',
              Author:
                'Sistema de Control de Pagos',
            },
          });

        const chunks:
          Buffer[] =
          [];

        document.on(
          'data',
          (
            chunk:
              Buffer,
          ) => {
            chunks.push(
              chunk,
            );
          },
        );

        document.on(
          'end',
          () => {
            resolve(
              Buffer.concat(
                chunks,
              ),
            );
          },
        );

        document.on(
          'error',
          reject,
        );

        try {
          write(
            document,
          );

          document.end();
        } catch (error) {
          reject(error);
        }
      },
    );
  }

  private ensurePdfSpace(
    document:
      PDFKit.PDFDocument,

    requiredHeight:
      number,
  ): void {
    const bottom =
      document.page.height -
      document.page.margins
        .bottom;

    if (
      document.y +
        requiredHeight >
      bottom
    ) {
      document.addPage();
    }
  }
}
