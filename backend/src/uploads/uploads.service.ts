import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { RequestUploadUrlDto, UploadKind } from './dto/request-upload-url.dto';

const VIDEO_CONTENT_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']; // MP4, MOV, WebM (HU5)
const MATERIAL_CONTENT_TYPES = [
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]; // PDF, Excel, Word, TXT (HU7)

const MAX_VIDEO_BYTES = 500 * 1024 * 1024; // 500 MB (HU5/HU6)
const MAX_MATERIAL_BYTES = 10 * 1024 * 1024; // 10 MB (HU7)

@Injectable()
export class UploadsService {
  private s3: S3Client;
  private bucket: string;

  constructor(private config: ConfigService) {
    this.s3 = new S3Client({ region: this.config.get<string>('AWS_REGION') });
    this.bucket = this.config.get<string>('AWS_S3_BUCKET') ?? 'pecod-uploads';
  }

  // HU5/HU6/HU7: valida formato y tamaño ANTES de generar la URL, y el mismo
  // contentType queda "fijado" en la URL prefirmada (S3 rechaza si no coincide).
  async requestUploadUrl(dto: RequestUploadUrlDto) {
    this.validate(dto);

    const key = `${dto.kind}/${randomUUID()}-${dto.fileName}`;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: dto.contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: 300 }); // 5 min

    return {
      uploadUrl, // el frontend hace PUT directo acá con el archivo
      fileUrl: `https://${this.bucket}.s3.amazonaws.com/${key}`, // URL final a guardar en el tema
      key,
    };
  }

  private validate(dto: RequestUploadUrlDto) {
    if (dto.kind === UploadKind.VIDEO) {
      if (!VIDEO_CONTENT_TYPES.includes(dto.contentType)) {
        throw new BadRequestException(
          `Formato de video no soportado. Formatos válidos: MP4, MOV, WebM.`,
        );
      }
      if (dto.sizeBytes > MAX_VIDEO_BYTES) {
        throw new BadRequestException('El video supera el tamaño máximo de 500 MB.');
      }
    } else {
      if (!MATERIAL_CONTENT_TYPES.includes(dto.contentType)) {
        throw new BadRequestException(
          'Formato de archivo no soportado. Formatos válidos: PDF, Excel, Word, TXT.',
        );
      }
      if (dto.sizeBytes > MAX_MATERIAL_BYTES) {
        throw new BadRequestException('El archivo supera el tamaño máximo de 10 MB.');
      }
    }
  }
}
