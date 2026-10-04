import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class UpdateMyProfileDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(20) documentType?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(20) documentNumber?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(150) firstName?: string;
  @IsOptional() @IsString() @MaxLength(150) lastNameFather?: string | null;
  @IsOptional() @IsString() @MaxLength(150) lastNameMother?: string | null;
  @IsOptional() @IsIn(['', 'M', 'F', 'NO_ESPECIFICA']) gender?: string | null;
  @IsOptional() @IsString() @MaxLength(30) phone?: string | null;

  @IsOptional()
  @ValidateIf((_object, value) => value !== '')
  @IsEmail()
  @MaxLength(200)
  email?: string | null;
}
