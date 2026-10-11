import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Matches, Max, Min } from 'class-validator';

// HU5: video cargado desde archivo del dispositivo (MP4/MOV/WebM ya validados en UploadsService).
// HU6: video generado por grabación de pantalla en la plataforma.
// En ambos casos, una vez subido a S3/Mux, el frontend llama a este endpoint con la URL resultante.
export class AttachVideoDto {
  @IsNotEmpty({ message: 'La URL del video es obligatoria.' })
  @IsString()
  @Matches(/^https?:\/\/.+/, { message: 'La URL del video no es válida.' })
  videoUrl: string;

  // Guard against NaN/string/Infinity coming from the browser's video.duration
  @Transform(({ value }) => (value !== undefined && value !== null ? Number(value) : value))
  @IsInt()
  @Min(0)
  @Max(1800, { message: 'La duración máxima del video es de 30 minutos (1800 segundos).' })
  videoDurationSeconds: number;
}
