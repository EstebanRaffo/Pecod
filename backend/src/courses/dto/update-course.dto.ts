import { PartialType } from '@nestjs/mapped-types';
import { CreateCourseDto } from './create-course.dto';

// HU8: editar contenido de un curso ya existente. Todos los campos son opcionales
// (se actualiza solo lo que el Profesor modifique).
export class UpdateCourseDto extends PartialType(CreateCourseDto) {}
