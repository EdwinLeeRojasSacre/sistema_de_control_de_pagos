import { AuthService } from './auth.service.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { LoginDto } from './dto/login.dto.js';

import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';

import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

import type { AuthenticatedUser } from './jwt.strategy.js';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto.username, loginDto.password);
  }

  @Get('profile')
  @UseGuards(AuthGuard('jwt'))
  async profile(@Req() request: AuthenticatedRequest) {
    return request.user;
  }

  @Post('change-password')
  @UseGuards(AuthGuard('jwt'))
  changePassword(@Body() dto: ChangePasswordDto, @Req() request: AuthenticatedRequest) {
    return this.authService.changePassword(
      request.user.sub, dto.currentPassword, dto.newPassword,
      { userId: request.user.sub, ipAddress: request.ip ?? null, deviceName: request.get('user-agent') ?? null },
    );
  }
}
