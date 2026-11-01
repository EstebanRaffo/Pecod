import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateEvaluationDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  minScore?: number;

  // HU19: intentos configurables
  @IsOptional()
  @IsInt({ message: 'La cantidad de intentos debe ser un número entero.' })
  @Min(1, { message: 'El mínimo de intentos es 1.' })
  @Max(5, { message: 'El máximo de intentos es 5.' })
  maxAttempts?: number;
}


