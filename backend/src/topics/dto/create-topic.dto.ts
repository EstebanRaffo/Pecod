import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateTopicDto {
  @IsNotEmpty({ message: 'El título del tema es obligatorio.' })
  title: string;

  @IsInt()
  @Min(1)
  order: number;

  @IsOptional()
  @IsString()
  contentText?: string; // HU7: material teórico escrito
}
