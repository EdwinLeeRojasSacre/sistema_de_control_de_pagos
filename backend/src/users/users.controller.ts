import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/jwt.strategy.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserStatusDto } from './dto/update-user-status.dto.js';
import { PersonLookupQueryDto } from './dto/person-lookup-query.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UsersService } from './users.service.js';

interface AuthenticatedRequest extends Request { user: AuthenticatedUser }

@Controller('users')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMINISTRADOR', 'SECRETARIA')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(@Req() request: AuthenticatedRequest) { return this.usersService.findAll(request.user); }

  @Get('options')
  getOptions(@Req() request: AuthenticatedRequest) { return this.usersService.getOptions(request.user); }

  @Get('person-lookup')
  findPerson(@Query() query: PersonLookupQueryDto) {
    return this.usersService.findPersonByDocument(query.documentType, query.documentNumber);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Req() request: AuthenticatedRequest) {
    return this.usersService.findOne(id, request.user);
  }

  @Post()
  create(@Body() dto: CreateUserDto, @Req() request: AuthenticatedRequest) {
    return this.usersService.create(dto, request.user, this.auditContext(request));
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateUserDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.usersService.update(id, dto, request.user, this.auditContext(request));
  }

  @Patch(':id/status')
  updateStatus(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: UpdateUserStatusDto, @Req() request: AuthenticatedRequest) {
    return this.usersService.updateStatus(id, dto.isActive, request.user, this.auditContext(request));
  }

  @Post(':id/reset-password')
  resetPassword(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Req() request: AuthenticatedRequest) {
    return this.usersService.resetPassword(id, request.user, this.auditContext(request));
  }

  private auditContext(request: AuthenticatedRequest) {
    return { userId: request.user.sub, ipAddress: request.ip ?? null, deviceName: request.get('user-agent') ?? null };
  }
}
