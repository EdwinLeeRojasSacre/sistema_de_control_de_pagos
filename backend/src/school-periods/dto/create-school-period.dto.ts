import {
  IsDateString,
  IsInt,
  Max,
  Min,
} from 'class-validator';

export class CreateSchoolPeriodDto {
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}
