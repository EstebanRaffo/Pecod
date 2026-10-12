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
  try {
    await axios.put(data.uploadUrl, file, {
      headers: { 'Content-Type': contentType },
    });
  } catch (error) {
    if (axios.isAxiosError(error) && !error.response) {
      throw new Error(
        'No se pudo conectar con S3. Verificá que el bucket permita CORS desde el origen del frontend.',
      );
    }
    if (axios.isAxiosError(error) && error.response?.status === 403) {
      throw new Error(
        'S3 rechazó la carga (403). Verificá el permiso s3:PutObject, la región del bucket y la configuración CORS.',
      );
    }
    throw error;
  }

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
      const duration = video.duration;
      // Algunos MP4 reportan Infinity hasta que se carga el archivo completo
      if (!isFinite(duration) || isNaN(duration)) {
        resolve(0); // sin duración legible: el backend no valida límite de duración
      } else {
        resolve(Math.round(duration));
      }
    };
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      resolve(0); // si no se pueden leer metadatos, continuar sin duración
    };
    video.src = URL.createObjectURL(file);
  });
}

// ── Delete helpers ───────────────────────────────────────────────────────────

export async function deleteTopicVideo(topicId: string): Promise<void> {
  await api.delete(`/topics/${topicId}/video`);
}

export async function deleteTopicScreenRecording(topicId: string): Promise<void> {
  await api.delete(`/topics/${topicId}/screen-recording`);
}

export async function deleteMaterial(topicId: string, materialId: string): Promise<void> {
  await api.delete(`/topics/${topicId}/materials/${materialId}`);
}
