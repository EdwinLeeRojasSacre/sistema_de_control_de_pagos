import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class UpdateVoucherLinksDto {
  @IsOptional()
  @IsBoolean()
  includeApafa?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', {
    each: true,
  })
  studentIds?: string[];
}