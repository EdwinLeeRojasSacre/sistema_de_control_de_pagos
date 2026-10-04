import { IsDateString, IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class NewUserPersonDto {
  @IsString() @IsNotEmpty() @MaxLength(20) documentType: string;
  @IsString() @IsNotEmpty() @MaxLength(20) documentNumber: string;
  @IsString() @IsNotEmpty() @MaxLength(150) firstName: string;
  @IsOptional() @IsString() @MaxLength(150) lastNameFather?: string;
  @IsOptional() @IsString() @MaxLength(150) lastNameMother?: string;
  @IsOptional() @IsDateString() birthDate?: string;
  @IsOptional() @IsIn(['', 'M', 'F', 'NO_ESPECIFICA']) gender?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsEmail() @MaxLength(200) email?: string;
  @IsOptional() @IsString() @MaxLength(500) address?: string;
}
