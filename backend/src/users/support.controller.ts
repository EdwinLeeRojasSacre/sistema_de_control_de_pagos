import { Controller, Get } from '@nestjs/common';
import { PublicSupportResponseDto } from './dto/public-support-response.dto.js';
import { UsersService } from './users.service.js';

@Controller('support')
export class SupportController {
  constructor(private readonly usersService: UsersService) {}

  @Get('public')
  getPublicSupport(): Promise<PublicSupportResponseDto> {
    return this.usersService.getPublicSupport();
  }
}
