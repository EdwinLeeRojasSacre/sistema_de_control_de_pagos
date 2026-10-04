import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class UpdateFamilyGroupStudentDto {
  @IsUUID('4')
  memberId!: string;

  @IsString()
  @MaxLength(150)
  firstName!: string;

  @IsString()
  @MaxLength(150)
  lastNameFather!: string;

  @IsString()
  @MaxLength(150)
  lastNameMother!: string;

  @IsDateString()
  birthDate!: string;
}

export class UpdateFamilyGroupAdultDto {
  @IsOptional()
  @IsUUID('4')
  memberId?: string;

  @IsString()
  @MaxLength(20)
  documentType!: string;

  @IsString()
  @MaxLength(20)
  documentNumber!: string;

  @IsString()
  @MaxLength(150)
  firstName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  lastNameFather?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  lastNameMother?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsString()
  @MaxLength(50)
  relationshipType!: string;

  @IsBoolean()
  isGuardian!: boolean;
}

export class UpdateFamilyGroupDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observations?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateFamilyGroupStudentDto)
  students!: UpdateFamilyGroupStudentDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateFamilyGroupAdultDto)
  adults!: UpdateFamilyGroupAdultDto[];
}