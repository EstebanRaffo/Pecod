import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Matches, Max, Min } from 'class-validator';

// HU6: video generado por grabación de pantalla en la plataforma.
// El frontend sube el blob a S3 y luego llama a este endpoint con la URL resultante.
export class AttachScreenRecordingDto {
  @IsNotEmpty({ message: 'La URL del video de grabación es obligatoria.' })
  @IsString()
  @Matches(/^https?:\/\/.+/, { message: 'La URL del video de grabación no es válida.' })
  screenRecordingUrl: string;

  @Transform(({ value }) => (value !== undefined && value !== null ? Number(value) : value))
  @IsInt()
  @Min(0)
  @Max(1800, { message: 'La duración máxima del video es de 30 minutos (1800 segundos).' })
  videoDurationSeconds: number;
}
