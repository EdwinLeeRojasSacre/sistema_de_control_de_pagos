import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

import type { AuthenticatedUser } from '../auth/jwt.strategy.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { AcademicStructureService } from './academic-structure.service.js';
import { CreateClassroomDto } from './dto/create-classroom.dto.js';
import { FindAcademicStructureQueryDto } from './dto/find-academic-structure-query.dto.js';
import { UpdateClassroomDto } from './dto/update-classroom.dto.js';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

@Controller('academic-structure')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMINISTRADOR', 'SECRETARIA')
export class AcademicStructureController {
  constructor(private readonly service: AcademicStructureService) {}

  @Get()
  @Roles('ADMINISTRADOR', 'SECRETARIA', 'DIRECCION')
  findByPeriod(@Query() query: FindAcademicStructureQueryDto) {
    return this.service.findByPeriod(query.schoolPeriodId);
  }

  @Get('options')
  getOptions() {
    return this.service.getOptions();
  }

  @Post('classrooms')
  create(
    @Body() dto: CreateClassroomDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createClassroom(dto, this.auditContext(request));
  }

  @Patch('classrooms/:id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateClassroomDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.updateClassroom(id, dto, this.auditContext(request));
  }

  @Patch('classrooms/:id/enable')
  enable(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.enableClassroom(id, this.auditContext(request));
  }

  @Patch('classrooms/:id/disable')
  disable(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.disableClassroom(id, this.auditContext(request));
  }

  private auditContext(request: AuthenticatedRequest) {
    return {
      userId: request.user.sub,
      ipAddress: request.ip ?? null,
      deviceName: request.get('user-agent') ?? null,
    };
  }
}
