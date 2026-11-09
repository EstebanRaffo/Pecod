import { IsString, IsUUID, MinLength, MaxLength, IsNotEmpty, Length } from 'class-validator';

// HU25: DTO para crear una consulta del foro
export class CreateForumThreadDto {
  @IsUUID()
  @IsNotEmpty({ message: 'El tema es obligatorio.' })
  topicId: string;

  @IsString({ message: 'El título debe ser texto.' })
  @IsNotEmpty({ message: 'El título es obligatorio.' })
  @Length(1, 120, { message: 'El título debe tener entre 1 y 120 caracteres.' })
  title: string;

  @IsString({ message: 'El contenido debe ser texto.' })
  @IsNotEmpty({ message: 'El contenido es obligatorio.' })
  @Length(1, 2000, { message: 'El contenido debe tener entre 1 y 2000 caracteres.' })
  body: string;
}
