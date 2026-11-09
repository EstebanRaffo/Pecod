import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

// HU26: DTO para procesar pago con tarjeta de prueba
export class CreatePaymentDto {
  @IsNotEmpty({ message: 'El número de tarjeta es obligatorio.' })
  @IsString()
  cardNumber: string; // 16 dígitos; espacios serán normalizados

  @IsNotEmpty({ message: 'El titular es obligatorio.' })
  @IsString()
  @Length(1, 60, { message: 'El titular debe tener entre 1 y 60 caracteres.' })
  holderName: string;

  @IsNotEmpty({ message: 'El vencimiento es obligatorio.' })
  @IsString()
  @Matches(/^\d{2}\/\d{2}$/, { message: 'El vencimiento debe tener formato MM/AA.' })
  expiry: string; // MM/AA

  @IsNotEmpty({ message: 'El código de seguridad es obligatorio.' })
  @IsString()
  @Length(3, 3, { message: 'El CVV debe tener exactamente 3 dígitos.' })
  cvv: string;
}
