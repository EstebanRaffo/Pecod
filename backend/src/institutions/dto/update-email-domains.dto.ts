import { IsArray, IsNotEmpty, ArrayMinSize } from 'class-validator';

// HU23: Actualizar dominios de email permitidos para auto-registro
export class UpdateInstitutionEmailDomainsDto {
  @IsNotEmpty({ message: 'Los dominios de email son obligatorios.' })
  @IsArray({ message: 'Los dominios de email deben ser un array.' })
  @ArrayMinSize(0, { message: 'Debe proporcionar al menos 0 dominios.' })
  emailDomains: string[]; // array de dominios normalizados (lowercase, sin @)
}
