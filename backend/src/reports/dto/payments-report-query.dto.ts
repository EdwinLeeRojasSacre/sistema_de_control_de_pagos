import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { REPORT_STATUSES, type ReportStatus } from './report-status.enum.js';

export class PaymentsReportQueryDto {
  @IsUUID('4')
  schoolPeriodId!: string;

  @IsOptional() @IsUUID('4') cycleId?: string;
  @IsOptional() @IsUUID('4') educationLevelId?: string;
  @IsOptional() @IsUUID('4') classroomId?: string;
  @IsOptional() @IsUUID('4') shiftId?: string;
  @IsOptional() @IsIn(REPORT_STATUSES) apafaStatus?: ReportStatus;
  @IsOptional() @IsIn(REPORT_STATUSES) tallerStatus?: ReportStatus;
  @IsOptional() @IsIn(['ALL', 'APAFA', 'TALLER']) paymentType?: 'ALL' | 'APAFA' | 'TALLER';
  @IsOptional() @IsIn(REPORT_STATUSES) status?: ReportStatus;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
