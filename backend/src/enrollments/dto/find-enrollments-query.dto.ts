import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class FindEnrollmentsQueryDto {
  @IsOptional()
  @IsUUID('4')
  schoolPeriodId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  search?: string;

  @IsOptional()
  @IsIn(['ACTIVE'])
  status?: string;
}
