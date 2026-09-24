import axios from 'axios';
import { api } from './client';

type UploadKind = 'video' | 'material';

interface PresignedUrlResponse {
  uploadUrl: string;
  fileUrl: string;
  key: string;
}

// HU5/HU6/HU7: el archivo NO pasa por nuestro backend — se sube directo a S3
// con la URL prefirmada, para no sobrecargar el servidor con archivos grandes (hasta 500 MB).
export async function uploadFileToS3(file: File | Blob, kind: UploadKind, fileName: string) {
  const contentType = file instanceof File ? file.type : 'video/webm';

  const { data } = await api.post<PresignedUrlResponse>('/uploads/presigned-url', {
    fileName,
    contentType,
    sizeBytes: file.size,
    kind,
  });

  // PUT directo a S3: sin el interceptor de /api (no lleva JWT ni pasa por nuestro backend).
  await axios.put(data.uploadUrl, file, {
    headers: { 'Content-Type': contentType },
  });

  return data.fileUrl;
}

// Extrae la duración de un archivo de video en el navegador, antes de subirlo,
// para validar el límite de 30 minutos (HU5) sin depender solo del backend.
export function getVideoDurationSeconds(file: File | Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(Math.round(video.duration));
    };
    video.onerror = () => reject(new Error('No se pudo leer la duración del video.'));
    video.src = URL.createObjectURL(file);
  });
}
