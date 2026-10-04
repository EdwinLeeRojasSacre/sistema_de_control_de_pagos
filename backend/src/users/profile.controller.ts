import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/jwt.strategy.js';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto.js';
import { UsersService } from './users.service.js';

interface AuthenticatedRequest extends Request { user: AuthenticatedUser }

@Controller('users/me')
@UseGuards(AuthGuard('jwt'))
export class ProfileController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  getMyProfile(@Req() request: AuthenticatedRequest) {
    return this.usersService.getMyProfile(request.user);
  }

  @Patch()
  updateMyProfile(@Body() dto: UpdateMyProfileDto, @Req() request: AuthenticatedRequest) {
    return this.usersService.updateMyProfile(request.user, dto, {
      userId: request.user.sub,
      ipAddress: request.ip ?? null,
      deviceName: request.get('user-agent') ?? null,
    });
  }
}
