import {
  IsDateString,
  IsNotEmpty,
  IsString,
  MaxLength,
  IsUUID,
} from 'class-validator';

export class CreateFamilyStudentDto {
  @IsUUID('4')
  classroomId!: string;

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

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  lastNameFather!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  lastNameMother!: string;

  @IsDateString()
  birthDate!: string;
}
