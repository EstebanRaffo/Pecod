import { IsInt, IsOptional, Max, MaxLength, Min } from 'class-validator';

export class CreateReviewDto {
  @IsInt({ message: 'La calificación debe ser un número entero.' })
  @Min(1, { message: 'La calificación mínima es 1 estrella.' })
  @Max(5, { message: 'La calificación máxima es 5 estrellas.' })
  rating: number;

  @IsOptional()
  @MaxLength(1000, { message: 'El comentario no debe exceder 1000 caracteres.' })
  comment?: string;
}
