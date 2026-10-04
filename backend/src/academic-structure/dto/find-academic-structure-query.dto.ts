import { IsUUID } from 'class-validator';

export class FindAcademicStructureQueryDto {
  @IsUUID('4')
  schoolPeriodId!: string;
}
