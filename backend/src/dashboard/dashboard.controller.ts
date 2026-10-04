import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '@nestjs/passport';

import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';

import { DashboardService } from './dashboard.service.js';

@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
  ) {}

  @Get('summary')
  @UseGuards(
    AuthGuard('jwt'),
    RolesGuard,
  )
  @Roles(
    'ADMINISTRADOR',
    'SECRETARIA',
  )
  summary() {
    return this.dashboardService.summary();
  }
}
