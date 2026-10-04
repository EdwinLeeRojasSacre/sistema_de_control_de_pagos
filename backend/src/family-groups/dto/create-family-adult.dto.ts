import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export const FAMILY_RELATIONSHIP_TYPES = [
  'PADRE',
  'MADRE',
  'PADRASTRO',
  'MADRASTRA',
  'ABUELO',
  'ABUELA',
  'TIO',
  'TIA',
  'HERMANO',
  'HERMANA',
  'OTRO',
] as const;

export type FamilyRelationshipType =
  (typeof FAMILY_RELATIONSHIP_TYPES)[number];

export class CreateFamilyAdultDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  documentType!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  documentNumber!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  firstName!: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  lastNameFather?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  lastNameMother?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsString()
  @IsIn(FAMILY_RELATIONSHIP_TYPES)
  relationshipType!: FamilyRelationshipType;

  @IsBoolean()
  isGuardian!: boolean;
}