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

import { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';

import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';

import { CreateFamilyGroupDto } from './dto/create-family-group.dto.js';
import { AddFamilyStudentDto } from './dto/add-family-student.dto.js';
import { FindFamilyGroupsQueryDto } from './dto/find-family-groups-query.dto.js';
import { PersonLookupQueryDto } from './dto/person-lookup-query.dto.js';
import { UpdateFamilyGroupDto } from './dto/update-family-group.dto.js';

import { FamilyGroupsService } from './family-groups.service.js';
import { FamilyGroupsImportService } from './family-groups-import.service.js';
import { createImportTemplate, FAMILY_HEADERS, IMPORT_FILE_LIMIT, type ImportFile } from '../imports/import-file.js';

interface AuthenticatedRequest extends Request {
  user: {
    sub: string;
    username: string;
    role: string;
  };
}

@Controller('family-groups')
@UseGuards(
  AuthGuard('jwt'),
  RolesGuard,
)
export class FamilyGroupsController {
  constructor(
    private readonly familyGroupsService: FamilyGroupsService,
    private readonly imports: FamilyGroupsImportService,
  ) {}

  @Get('import/template')
  @Roles('ADMINISTRADOR', 'SECRETARIA')
  async importTemplate(@Res() response: Response) {
    const file = await createImportTemplate(FAMILY_HEADERS, 'Plantilla de familias SGPE');
    response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.setHeader('Content-Disposition', 'attachment; filename="SGPE_Plantilla_Familias.xlsx"');
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
    return this.imports.confirm(file, {
      userId: request.user.sub,
      ipAddress: this.getClientIp(request),
      deviceName: request.get('user-agent') ?? null,
    });
  }

  @Get()
  @Roles(
    'ADMINISTRADOR',
    'SECRETARIA',
  )
  async findAll(
    @Query() query: FindFamilyGroupsQueryDto,
  ) {
    return this.familyGroupsService.findAll(
      query,
    );
  }

  @Get('create-options')
  @Roles(
    'ADMINISTRADOR',
    'SECRETARIA',
  )
  async getCreateOptions() {
    return this.familyGroupsService.getCreateOptions();
  }

  @Get('person-lookup')
  @Roles(
    'ADMINISTRADOR',
    'SECRETARIA',
  )
  async findPersonByDocument(
    @Query() query: PersonLookupQueryDto,
  ) {
    return this.familyGroupsService.findPersonByDocument(
      query.documentType,
      query.documentNumber,
    );
  }

  @Get(':id')
  @Roles(
    'ADMINISTRADOR',
    'SECRETARIA',
  )
  async findById(
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    id: string,
  ) {
    return this.familyGroupsService.findById(
      id,
    );
  }

  @Post()
  @Roles(
    'ADMINISTRADOR',
    'SECRETARIA',
  )
  async create(
    @Body()
    createFamilyGroupDto: CreateFamilyGroupDto,
    @Req()
    request: AuthenticatedRequest,
  ) {
    return this.familyGroupsService.create(
      createFamilyGroupDto,
      {
        userId: request.user.sub,
        ipAddress:
          this.getClientIp(request),
        deviceName:
          request.get('user-agent') ??
          null,
      },
    );
  }

  @Post(':id/students')
  @Roles(
    'ADMINISTRADOR',
    'SECRETARIA',
  )
  async addStudent(
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    id: string,
    @Body()
    addFamilyStudentDto: AddFamilyStudentDto,
    @Req()
    request: AuthenticatedRequest,
  ) {
    return this.familyGroupsService.addStudent(
      id,
      addFamilyStudentDto,
      {
        userId: request.user.sub,
        ipAddress:
          this.getClientIp(request),
        deviceName:
          request.get('user-agent') ??
          null,
      },
    );
  }

  @Patch(':id')
  @Roles(
    'ADMINISTRADOR',
    'SECRETARIA',
  )
  async update(
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    id: string,
    @Body()
    updateFamilyGroupDto: UpdateFamilyGroupDto,
    @Req()
    request: AuthenticatedRequest,
  ) {
    return this.familyGroupsService.update(
      id,
      updateFamilyGroupDto,
      {
        userId: request.user.sub,
        ipAddress:
          this.getClientIp(request),
        deviceName:
          request.get('user-agent') ??
          null,
      },
    );
  }

  private getClientIp(
    request: Request,
  ): string | null {
    return request.ip ?? null;
  }
}
