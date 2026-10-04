import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { NewUserPersonDto } from './new-user-person.dto.js';

export class CreateUserDto {
  @IsOptional() @IsUUID('4') personId?: string;
  @IsOptional() @ValidateNested() @Type(() => NewUserPersonDto) person?: NewUserPersonDto;
  @IsIn(['SECRETARIA', 'DIRECCION']) role: 'SECRETARIA' | 'DIRECCION';
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  @Matches(/^[a-zA-Z0-9._-]+$/, { message: 'El username contiene caracteres no permitidos' })
  username: string;
}
