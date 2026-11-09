import { IsString, IsNotEmpty, Length } from 'class-validator';

// HU25: DTO para crear una respuesta en el foro
export class CreateForumPostDto {
  @IsString({ message: 'El contenido debe ser texto.' })
  @IsNotEmpty({ message: 'El contenido es obligatorio.' })
  @Length(1, 2000, { message: 'El contenido debe tener entre 1 y 2000 caracteres.' })
  body: string;
}
