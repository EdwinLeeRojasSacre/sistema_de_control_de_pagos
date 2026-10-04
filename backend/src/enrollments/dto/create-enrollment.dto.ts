import { IsUUID } from 'class-validator';

export class CreateEnrollmentDto {
  @IsUUID('4')
  studentId!: string;

  @IsUUID('4')
  schoolPeriodId!: string;

  @IsUUID('4')
  classroomId!: string;
}
