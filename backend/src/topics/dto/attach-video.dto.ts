import { IsInt, IsNotEmpty, IsPositive, Max } from 'class-validator';

// HU5: video cargado desde archivo del dispositivo (MP4/MOV/WebM ya validados en UploadsService).
// HU6: video generado por grabación de pantalla en la plataforma.
// En ambos casos, una vez subido a S3/Mux, el frontend llama a este endpoint con la URL resultante.
export class AttachVideoDto {
  @IsNotEmpty({ message: 'La URL del video es obligatoria.' })
  videoUrl: string;

  @IsInt()
  @IsPositive()
  @Max(1800, { message: 'La duración máxima del video es de 30 minutos (1800 segundos).' })
  videoDurationSeconds: number;
}
