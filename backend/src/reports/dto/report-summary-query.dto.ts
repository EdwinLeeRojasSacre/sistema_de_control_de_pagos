import {
  IsIn,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class ReportSummaryQueryDto {
  @IsUUID('4')
  schoolPeriodId!: string;
  @IsOptional() @IsUUID('4') cycleId?: string;
  @IsOptional() @IsUUID('4') educationLevelId?: string;
  @IsOptional() @IsUUID('4') classroomId?: string;
  @IsOptional() @IsUUID('4') shiftId?: string;
  @IsOptional() @IsIn(['ALL', 'APAFA', 'TALLER']) paymentType?: 'ALL' | 'APAFA' | 'TALLER';
}
