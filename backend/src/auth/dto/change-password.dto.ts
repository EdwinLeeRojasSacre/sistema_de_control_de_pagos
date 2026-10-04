import { IsString, MaxLength, MinLength, Matches } from 'class-validator';

export class ChangePasswordDto {
  @IsString() @MaxLength(200) currentPassword: string;
  @IsString()
  @MinLength(10)
  @MaxLength(200)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, { message: 'La nueva contraseña debe incluir mayuscula, minuscula y numero' })
  newPassword: string;
}
