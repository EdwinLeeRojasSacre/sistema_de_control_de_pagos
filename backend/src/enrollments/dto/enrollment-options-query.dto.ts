import { IsOptional, IsUUID } from 'class-validator';

export class EnrollmentOptionsQueryDto {
  @IsOptional()
  @IsUUID('4')
  schoolPeriodId?: string;
}
