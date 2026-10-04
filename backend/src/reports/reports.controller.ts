import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';

import {
  AuthGuard,
} from '@nestjs/passport';

import type {
  Response,
} from 'express';

import {
  Roles,
} from '../auth/roles.decorator.js';

import {
  RolesGuard,
} from '../auth/roles.guard.js';

import {
  ApafaReportQueryDto,
} from './dto/apafa-report-query.dto.js';

import {
  ReportSummaryQueryDto,
} from './dto/report-summary-query.dto.js';

import {
  TallerReportQueryDto,
} from './dto/taller-report-query.dto.js';

import { PaymentsReportQueryDto } from './dto/payments-report-query.dto.js';

import {
  ReportsService,
} from './reports.service.js';

@Controller('reports')
@UseGuards(
  AuthGuard('jwt'),
  RolesGuard,
)
@Roles(
  'ADMINISTRADOR',
  'SECRETARIA',
  'DIRECCION',
)
export class ReportsController {
  constructor(
    private readonly reportsService:
      ReportsService,
  ) {}

  @Get('summary')
  async getSummary(
    @Query()
    query:
      ReportSummaryQueryDto,
  ) {
    return this.reportsService
      .getSummary(
        query,
      );
  }

  @Get('apafa')
  async getApafaReport(
    @Query()
    query:
      ApafaReportQueryDto,
  ) {
    return this.reportsService
      .getApafaReport(
        query,
      );
  }

  @Get('taller')
  async getTallerReport(
    @Query()
    query:
      TallerReportQueryDto,
  ) {
    return this.reportsService
      .getTallerReport(
        query,
      );
  }

  @Get('payments')
  getPaymentsReport(@Query() query: PaymentsReportQueryDto) {
    return this.reportsService.getPaymentsReport(query);
  }

  @Get('payments/export/xlsx')
  async exportPaymentsXlsx(@Query() query: PaymentsReportQueryDto, @Res() response: Response) {
    this.sendFile(response, await this.reportsService.exportPaymentsXlsx(query));
  }

  @Get('payments/export/pdf')
  async exportPaymentsPdf(@Query() query: PaymentsReportQueryDto, @Res() response: Response) {
    this.sendFile(response, await this.reportsService.exportPaymentsPdf(query));
  }

  @Get('apafa/export/xlsx')
  async exportApafaXlsx(
    @Query()
    query:
      ApafaReportQueryDto,

    @Res()
    response:
      Response,
  ) {
    const result =
      await this.reportsService
        .exportApafaXlsx(
          query,
        );

    this.sendFile(
      response,
      result,
    );
  }

  @Get('apafa/export/pdf')
  async exportApafaPdf(
    @Query()
    query:
      ApafaReportQueryDto,

    @Res()
    response:
      Response,
  ) {
    const result =
      await this.reportsService
        .exportApafaPdf(
          query,
        );

    this.sendFile(
      response,
      result,
    );
  }

  @Get('taller/export/xlsx')
  async exportTallerXlsx(
    @Query()
    query:
      TallerReportQueryDto,

    @Res()
    response:
      Response,
  ) {
    const result =
      await this.reportsService
        .exportTallerXlsx(
          query,
        );

    this.sendFile(
      response,
      result,
    );
  }

  @Get('taller/export/pdf')
  async exportTallerPdf(
    @Query()
    query:
      TallerReportQueryDto,

    @Res()
    response:
      Response,
  ) {
    const result =
      await this.reportsService
        .exportTallerPdf(
          query,
        );

    this.sendFile(
      response,
      result,
    );
  }

  private sendFile(
    response:
      Response,

    result: {
      buffer: Buffer;
      contentType: string;
      filename: string;
    },
  ): void {
    response.setHeader(
      'Content-Type',
      result.contentType,
    );

    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );

    response.setHeader(
      'Content-Length',
      result.buffer.length,
    );

    response.end(
      result.buffer,
    );
  }
}
