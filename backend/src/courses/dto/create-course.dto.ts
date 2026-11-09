import { IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

// HU5: "el curso solo se guarda si están completos los campos obligatorios
// (nombre, descripción, área/categoría, tecnología, temario)"
// El temario en sí se maneja como Topics (ver módulo topics), asociados al curso ya creado.
export class CreateCourseDto {
  @IsNotEmpty({ message: 'El nombre del curso es obligatorio.' })
  name: string;

  @IsNotEmpty({ message: 'La descripción es obligatoria.' })
  description: string;

  @IsNotEmpty({ message: 'El área/categoría es obligatoria.' })
  category: string;

  @IsOptional()
  @IsString()
  academicRequirements?: string;

  @IsOptional()
  @IsString()
  skills?: string;

  @IsOptional()
  @IsString()
  technology?: string;

  // HU26: Precio opcional en pesos argentinos (null o ausente = gratuito)
  @IsOptional()
  @Type(() => Number)
  @Min(0.01, { message: 'El precio debe ser mayor a 0.' })
  price?: number;
}

