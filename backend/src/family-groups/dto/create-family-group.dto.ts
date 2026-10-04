import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { CreateFamilyAdultDto } from './create-family-adult.dto.js';
import { CreateFamilyStudentDto } from './create-family-student.dto.js';

export class CreateFamilyGroupDto {
  @IsUUID('4')
  schoolPeriodId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observations?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateFamilyStudentDto)
  students!: CreateFamilyStudentDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateFamilyAdultDto)
  adults!: CreateFamilyAdultDto[];
}