import { IsNotEmpty, IsEmail } from 'class-validator';

// HU23: Reenviar enlace de verificación de email
export class ResendVerificationDto {
  @IsNotEmpty({ message: 'El email es obligatorio.' })
  @IsEmail({}, { message: 'El email debe ser válido.' })
  email: string;
}
