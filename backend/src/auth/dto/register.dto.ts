import { IsNotEmpty, IsEmail, MinLength, MaxLength, Matches } from 'class-validator';

// HU23: Registro de Alumno (auto-registro)
export class RegisterDto {
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres.' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres.' })
  name: string;

  @IsNotEmpty({ message: 'El email es obligatorio.' })
  @IsEmail({}, { message: 'El email debe ser válido.' })
  email: string;

  @IsNotEmpty({ message: 'La contraseña es obligatoria.' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  @MaxLength(100, { message: 'La contraseña no puede exceder 100 caracteres.' })
  password: string;

  @IsNotEmpty({ message: 'La confirmación de contraseña es obligatoria.' })
  passwordConfirm: string;
}
