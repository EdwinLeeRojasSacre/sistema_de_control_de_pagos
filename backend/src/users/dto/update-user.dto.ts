import { Type } from 'class-transformer';
import { IsDateString, IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateNested } from 'class-validator';

export class UpdateUserPersonDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(20) documentType?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(20) documentNumber?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(150) firstName?: string;
  @IsOptional() @IsString() @MaxLength(150) lastNameFather?: string;
  @IsOptional() @IsString() @MaxLength(150) lastNameMother?: string;
  @IsOptional() @IsDateString() birthDate?: string | null;
  @IsOptional() @IsIn(['', 'M', 'F', 'NO_ESPECIFICA']) gender?: string | null;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsEmail() @MaxLength(200) email?: string;
  @IsOptional() @IsString() @MaxLength(500) address?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  @Matches(/^[a-zA-Z0-9._-]+$/, { message: 'El username contiene caracteres no permitidos' })
  username?: string;

  @IsOptional() @ValidateNested() @Type(() => UpdateUserPersonDto)
  person?: UpdateUserPersonDto;
}
