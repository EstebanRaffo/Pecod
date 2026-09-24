import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

// HU11: "el tipo de pregunta es de opción múltiple, con una sola respuesta correcta por pregunta"
export class QuestionOptionInputDto {
  @IsNotEmpty()
  text: string;

  @IsBoolean()
  isCorrect: boolean;
}

export class QuestionInputDto {
  @IsNotEmpty({ message: 'El texto de la pregunta es obligatorio.' })
  text: string;

  @ValidateNested({ each: true })
  @Type(() => QuestionOptionInputDto)
  @ArrayMinSize(2, { message: 'Cada pregunta debe tener al menos 2 opciones.' })
  options: QuestionOptionInputDto[];
}

// HU11: "no se permite guardar una evaluación sin al menos una pregunta o sin puntaje mínimo definido"
export class CreateEvaluationDto {
  @IsOptional()
  @IsUUID('4')
  topicId?: string; // null/omitido = evaluación de cierre de curso

  @IsNotEmpty({ message: 'El título de la evaluación es obligatorio.' })
  title: string;

  @IsInt()
  @Min(0)
  @Max(100)
  minScore: number;

  @ValidateNested({ each: true })
  @Type(() => QuestionInputDto)
  @ArrayMinSize(1, { message: 'La evaluación debe tener al menos una pregunta.' })
  questions: QuestionInputDto[];
}
