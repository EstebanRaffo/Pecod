import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

// HU5: "el curso solo se guarda si están completos los campos obligatorios
// (nombre, descripción, área/categoría, temario)"
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
  skills?: string; // aptitudes que se adquieren (HU4)

  @IsOptional()
  @IsString()
  tools?: string; // herramientas necesarias (HU4)
}
