import { IsInt, IsOptional, IsString } from 'class-validator';

export class UpdateTopicDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsInt()
  order?: number;
}

