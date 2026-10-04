import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '@nestjs/passport';

import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';

import { StudentsService } from './students.service.js';

import { Param } from '@nestjs/common';

import { Body, Post } from '@nestjs/common';
import { CreateStudentDto } from './dto/create-student.dto.js';

@Controller('students')
export class StudentsController {
  constructor(
    private readonly studentsService: StudentsService,
  ) {}

  @Get()
  @UseGuards(
    AuthGuard('jwt'),
    RolesGuard,
  )
  @Roles(
    'ADMINISTRADOR',
    'SECRETARIA',
  )
  async findAll() {
    return this.studentsService.findAll();
  }

    @Get(':id')
    @UseGuards(
    AuthGuard('jwt'),
    RolesGuard,
    )
    @Roles(
    'ADMINISTRADOR',
    'SECRETARIA',
    )
    async findById(
    @Param('id') id: string,
    ) {
    return this.studentsService.findById(id);
    }

    @Post()
    @UseGuards(
    AuthGuard('jwt'),
    RolesGuard,
    )
    @Roles(
    'ADMINISTRADOR',
    'SECRETARIA',
    )
    async create(
    @Body()
    createStudentDto: CreateStudentDto,
    ) {
    return this.studentsService.create(
        createStudentDto,
    );
    }

}
