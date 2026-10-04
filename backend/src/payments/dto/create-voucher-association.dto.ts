import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsUUID,
} from 'class-validator';

export class CreateVoucherAssociationDto {
  @IsBoolean()
  includeApafa!: boolean;

  @IsArray()
  @ArrayUnique()
  @IsUUID('4', {
    each: true,
  })
  studentIds!: string[];
}