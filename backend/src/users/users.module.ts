import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller.js';
import { SupportController } from './support.controller.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  controllers: [SupportController, ProfileController, UsersController],
  providers: [UsersService],
})
export class UsersModule {}
