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
}

