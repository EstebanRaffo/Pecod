import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Por favor ingresa un email válido.' })
  email: string;
}
