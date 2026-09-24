import { useState } from 'react';
import { api } from '../api/client';
import { getVideoDurationSeconds, uploadFileToS3 } from '../api/uploads';
import { useScreenRecorder } from '../hooks/useScreenRecorder';

interface Props {
  topicId: string;
  hasVideo: boolean;
  onChanged: () => void;
}

const MAX_VIDEO_DURATION_SECONDS = 1800; // 30 min
const MAX_MATERIAL_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const SUPPORTED_MATERIAL_EXT = ['pdf', 'xlsx', 'xls', 'docx', 'doc', 'txt'];

export default function TopicMediaUploader({ topicId, hasVideo, onChanged }: Props) {
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { isRecording, start, stop, cancel, error: recordError } = useScreenRecorder();

  async function attachVideo(file: File | Blob, fileName: string) {
    setError(null);
    setStatus('Subiendo video...');
    try {
      const durationSeconds = await getVideoDurationSeconds(file);
      // HU5/HU6: "duración máxima del video: 30 minutos"
      if (durationSeconds > MAX_VIDEO_DURATION_SECONDS) {
        setError('El video supera la duración máxima de 30 minutos.');
        setStatus(null);
        return;
      }
      const videoUrl = await uploadFileToS3(file, 'video', fileName);
      await api.post(`/topics/${topicId}/video`, { videoUrl, videoDurationSeconds: durationSeconds });
      setStatus('Video cargado correctamente.');
      onChanged();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'No se pudo subir el video.');
    } finally {
      setStatus(null);
    }
  }

  // HU5: carga de un video ya existente desde un archivo del dispositivo
  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await attachVideo(file, file.name);
    e.target.value = '';
  }

  // HU6: grabación de pantalla dentro de la plataforma
  async function handleStopRecording() {
    const blob = await stop();
    if (blob) {
      await attachVideo(blob, `grabacion-${Date.now()}.webm`);
    }
  }

  // HU7: material teórico adicional
  async function handleMaterialSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!SUPPORTED_MATERIAL_EXT.includes(ext)) {
      setError(`Formato no soportado. Formatos válidos: ${SUPPORTED_MATERIAL_EXT.join(', ')}.`);
      return;
    }
    if (file.size > MAX_MATERIAL_SIZE_BYTES) {
      setError('El archivo supera el tamaño máximo de 10 MB.');
      return;
    }

    setStatus('Subiendo material...');
    try {
      const fileUrl = await uploadFileToS3(file, 'material', file.name);
      await api.post(`/topics/${topicId}/materials`, {
        fileName: file.name,
        fileUrl,
        fileType: ext,
        sizeBytes: file.size,
      });
      setStatus('Material agregado correctamente.');
      onChanged();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'No se pudo subir el material.');
    } finally {
      setStatus(null);
    }
  }

  return (
    <div className="mt-2 space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        {/* HU5 */}
        <label className="cursor-pointer text-slate-700 underline">
          {hasVideo ? 'Reemplazar video (archivo)' : 'Subir video (archivo)'}
          <input type="file" accept="video/mp4,video/quicktime,video/webm" onChange={handleFileSelected} hidden />
        </label>

        {/* HU6 */}
        {isRecording ? (
          <>
            <button onClick={handleStopRecording} className="text-red-600 underline">
              Finalizar grabación
            </button>
            <button onClick={cancel} className="text-slate-500 underline">
              Cancelar
            </button>
          </>
        ) : (
          <button onClick={start} className="text-slate-700 underline">
            Grabar pantalla
          </button>
        )}

        {/* HU7 */}
        <label className="cursor-pointer text-slate-700 underline">
          Agregar material
          <input type="file" accept=".pdf,.xlsx,.xls,.docx,.doc,.txt" onChange={handleMaterialSelected} hidden />
        </label>
      </div>

      {status && <p className="text-slate-500">{status}</p>}
      {(error || recordError) && <p className="text-red-600">{error ?? recordError}</p>}
    </div>
  );
}
