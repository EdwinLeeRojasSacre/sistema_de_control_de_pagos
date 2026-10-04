import {
  Type,
} from 'class-transformer';

import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  REPORT_STATUSES,
  type ReportStatus,
} from './report-status.enum.js';

export class ApafaReportQueryDto {
  @IsUUID('4')
  schoolPeriodId!: string;

  @IsOptional()
  @IsIn(REPORT_STATUSES)
  status?: ReportStatus;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}