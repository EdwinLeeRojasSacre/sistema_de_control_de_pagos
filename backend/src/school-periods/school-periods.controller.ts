import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

import type { AuthenticatedUser } from '../auth/jwt.strategy.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { CreateSchoolPeriodDto } from './dto/create-school-period.dto.js';
import { UpdateSchoolPeriodDto } from './dto/update-school-period.dto.js';
import { SchoolPeriodsService } from './school-periods.service.js';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

@Controller('school-periods')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMINISTRADOR', 'SECRETARIA')
export class SchoolPeriodsController {
  constructor(private readonly schoolPeriodsService: SchoolPeriodsService) {}

  @Get()
  @Roles('ADMINISTRADOR', 'SECRETARIA', 'DIRECCION')
  findAll() {
    return this.schoolPeriodsService.findAll();
  }

  @Get(':id')
  findById(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.schoolPeriodsService.findById(id);
  }

  @Post()
  create(
    @Body() dto: CreateSchoolPeriodDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.schoolPeriodsService.create(dto, this.getAuditContext(request));
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateSchoolPeriodDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.schoolPeriodsService.update(
      id,
      dto,
      this.getAuditContext(request),
    );
  }

  @Patch(':id/open')
  open(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.schoolPeriodsService.open(id, this.getAuditContext(request));
  }

  @Patch(':id/close')
  close(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.schoolPeriodsService.close(id, this.getAuditContext(request));
  }

  @Patch(':id/enable')
  enable(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.schoolPeriodsService.enable(id, this.getAuditContext(request));
  }

  @Patch(':id/disable')
  disable(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.schoolPeriodsService.disable(id, this.getAuditContext(request));
  }

  private getAuditContext(request: AuthenticatedRequest) {
    return {
      userId: request.user.sub,
      ipAddress: request.ip ?? null,
      deviceName: request.get('user-agent') ?? null,
    };
  }
}
