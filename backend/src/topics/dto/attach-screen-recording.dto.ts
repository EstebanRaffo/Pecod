import { IsInt, IsNotEmpty, IsPositive, Max } from 'class-validator';

// HU6: video generado por grabación de pantalla en la plataforma.
// El frontend sube el blob a S3 y luego llama a este endpoint con la URL resultante.
export class AttachScreenRecordingDto {
  @IsNotEmpty({ message: 'La URL del video de grabación es obligatoria.' })
  screenRecordingUrl: string;

  @IsInt()
  @IsPositive()
  @Max(1800, { message: 'La duración máxima del video es de 30 minutos (1800 segundos).' })
  videoDurationSeconds: number;
}
