import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class PersonLookupQueryDto {
  @IsString() @IsNotEmpty() @MaxLength(20) documentType: string;
  @IsString() @IsNotEmpty() @MaxLength(20) documentNumber: string;
}
