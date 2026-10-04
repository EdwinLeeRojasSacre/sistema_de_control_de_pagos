import {
  IsIn,
  IsOptional,
} from 'class-validator';

export class VoucherFileQueryDto {
  @IsOptional()
  @IsIn([
    'view',
    'download',
  ])
  mode?:
    | 'view'
    | 'download';
}