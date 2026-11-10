import { IsEmail, IsNotEmpty, Matches } from 'class-validator';

// HU9: "nombre, dominio/subdominio único, dirección, teléfono y email de contacto"
export class CreateInstitutionDto {
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  name: string;

  @IsNotEmpty({ message: 'El dominio/subdominio es obligatorio.' })
  @Matches(/^[a-z0-9-]+(\.[a-z0-9-]+)*$/, {
    message: 'El dominio debe tener un formato válido (ej: mi-instituto.pecod.com).',
  })
  domain: string;

  @IsNotEmpty({ message: 'La dirección es obligatoria.' })
  address: string;

  @IsNotEmpty({ message: 'El teléfono es obligatorio.' })
  phone: string;

  @IsEmail({}, { message: 'El email de contacto no tiene un formato válido.' })
  contactEmail: string;
}
