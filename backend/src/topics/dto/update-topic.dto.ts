import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateTopicDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsInt()
  order?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50000)
  contentText?: string;
}

