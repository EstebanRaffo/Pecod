import { IsString, MinLength, Validate } from 'class-validator';

export class ResetPasswordDto {
  @IsString({ message: 'El token es requerido.' })
  token: string;

  @IsString({ message: 'La contraseña es requerida.' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  password: string;

  @IsString({ message: 'La confirmación de contraseña es requerida.' })
  @MinLength(8, { message: 'La confirmación debe tener al menos 8 caracteres.' })
  confirmPassword: string;
}

// Validador personalizado para verificar que password y confirmPassword coincidan
export class ResetPasswordValidator {
  static validate(dto: ResetPasswordDto): boolean {
    return dto.password === dto.confirmPassword;
  }
}
