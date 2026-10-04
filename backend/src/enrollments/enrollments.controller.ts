import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import type { Request } from 'express';

import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { ChangeEnrollmentClassroomDto } from './dto/change-enrollment-classroom.dto.js';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto.js';
import { EnrollmentOptionsQueryDto } from './dto/enrollment-options-query.dto.js';
import { FindEnrollmentsQueryDto } from './dto/find-enrollments-query.dto.js';
import { EnrollmentsService } from './enrollments.service.js';
import { EnrollmentsImportService } from './enrollments-import.service.js';
import { createImportTemplate, ENROLLMENT_HEADERS, IMPORT_FILE_LIMIT, type ImportFile } from '../imports/import-file.js';

interface AuthenticatedRequest extends Request {
  user: { sub: string; username: string; role: string };
}

@Controller('enrollments')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class EnrollmentsController {
  constructor(
    private readonly enrollmentsService: EnrollmentsService,
    private readonly imports: EnrollmentsImportService,
  ) {}

  @Get('import/template')
  @Roles('ADMINISTRADOR', 'SECRETARIA')
  async importTemplate(@Res() response: Response) {
    const file = await createImportTemplate(ENROLLMENT_HEADERS, 'Plantilla de matrículas SGPE');
    response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.setHeader('Content-Disposition', 'attachment; filename="SGPE_Plantilla_Matriculas.xlsx"');
    response.end(file);
  }

  @Post('import/preview')
  @HttpCode(200)
  @Roles('ADMINISTRADOR', 'SECRETARIA')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: IMPORT_FILE_LIMIT } }))
  importPreview(@UploadedFile() file: ImportFile) {
    return this.imports.preview(file);
  }

  @Post('import/confirm')
  @HttpCode(200)
  @Roles('ADMINISTRADOR', 'SECRETARIA')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: IMPORT_FILE_LIMIT } }))
  importConfirm(@UploadedFile() file: ImportFile, @Req() request: AuthenticatedRequest) {
    return this.imports.confirm(file, this.auditContext(request));
  }

  @Get()
  @Roles('ADMINISTRADOR', 'SECRETARIA')
  findAll(@Query() query: FindEnrollmentsQueryDto) {
    return this.enrollmentsService.findAll(query);
  }

  @Get('options')
  @Roles('ADMINISTRADOR', 'SECRETARIA')
  getOptions(@Query() query: EnrollmentOptionsQueryDto) {
    return this.enrollmentsService.getOptions(query);
  }

  @Get('students/:studentId')
  @Roles('ADMINISTRADOR', 'SECRETARIA')
  findByStudent(
    @Param('studentId', new ParseUUIDPipe({ version: '4' })) studentId: string,
  ) {
    return this.enrollmentsService.findByStudent(studentId);
  }

  @Get(':id')
  @Roles('ADMINISTRADOR', 'SECRETARIA')
  findById(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.enrollmentsService.findById(id);
  }

  @Post()
  @Roles('ADMINISTRADOR', 'SECRETARIA')
  create(
    @Body() dto: CreateEnrollmentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.enrollmentsService.create(dto, this.auditContext(request));
  }

  @Patch(':id/classroom')
  @Roles('ADMINISTRADOR', 'SECRETARIA')
  changeClassroom(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ChangeEnrollmentClassroomDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.enrollmentsService.changeClassroom(
      id,
      dto,
      this.auditContext(request),
    );
  }

  private auditContext(request: AuthenticatedRequest) {
    return {
      userId: request.user.sub,
      ipAddress: request.ip ?? null,
      deviceName: request.get('user-agent') ?? null,
    };
  }
}
