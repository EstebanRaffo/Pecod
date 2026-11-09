import { IsNotEmpty } from 'class-validator';

// HU23: Verificar email con token
export class VerifyEmailDto {
  @IsNotEmpty({ message: 'El token de verificación es obligatorio.' })
  token: string;
}
