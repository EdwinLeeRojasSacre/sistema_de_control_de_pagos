import { IsUUID } from 'class-validator';

export class FamilyPaymentStatusQueryDto {
  @IsUUID('4')
  schoolPeriodId!: string;
}