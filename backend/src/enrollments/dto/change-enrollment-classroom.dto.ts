import { IsUUID } from 'class-validator';

export class ChangeEnrollmentClassroomDto {
  @IsUUID('4')
  classroomId!: string;
}
