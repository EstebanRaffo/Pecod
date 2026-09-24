import { IsOptional, IsString } from 'class-validator';

// HU1: filtrar por área de conocimiento y/o tecnología; ambos filtros son combinables.
export class CatalogQueryDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  technology?: string;
}
