import { useState, type ReactNode } from 'react';
import { api } from '../api/client';
import {
  getVideoDurationSeconds,
  uploadFileToS3,
  deleteTopicVideo,
  deleteTopicScreenRecording,
  deleteMaterial,
} from '../api/uploads';
import { useScreenRecorder } from '../hooks/useScreenRecorder';

// ── Modal de confirmación ─────────────────────────────────────────────────────
interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Título del diálogo. Por defecto: "Confirmar eliminación" */
  title?: string;
  /** Etiqueta del botón de confirmación. Por defecto: "Eliminar" */
  confirmLabel?: string;
  /** Si es true, el botón de confirmación se muestra con estilo destructivo (rojo). Por defecto: true */
  destructive?: boolean;
}

function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
  title = 'Confirmar eliminación',
  confirmLabel = 'Eliminar',
  destructive = true,
}: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-sm mx-4 p-6 space-y-4">
        <h3 className="text-base font-semibold text-slate-800">{title}</h3>
        <p className="text-sm text-slate-600">{message}</p>
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-sm rounded text-white ${
              destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-700 hover:bg-slate-800'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

interface Props {
  topicId: string;
  videoUrl: string | null;
  screenRecordingUrl: string | null;
  materials: Array<{ id: string; fileName: string; fileUrl: string; fileType: string }>;
  contentText: string | null;
  onChanged: () => void;
}

const MAX_VIDEO_DURATION_SECONDS = 1800; // 30 min
const MAX_MATERIAL_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const SUPPORTED_MATERIAL_EXT = ['pdf', 'xlsx', 'xls', 'docx', 'doc', 'txt'];

// ── Ícono de papelera (Heroicons trash, 20×20 solid) ─────────────────────────
function TrashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-3 w-3"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/**
 * Detecta URLs en `text` y las envuelve en <a target="_blank">.
 * Regex: http(s):// seguido de caracteres no-espacio.
 */
function ReadingMaterialDisplay({ text }: { text: string }) {
  const urlRegex = /https?:\/\/[^\s]+/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const url = match[0];
    parts.push(
      <a
        key={match.index}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 underline break-all"
      >
        {url}
      </a>,
    );
    lastIndex = match.index + url.length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return <>{parts}</>;
}

export default function TopicMediaUploader({
  topicId,
  videoUrl,
  screenRecordingUrl,
  materials,
  contentText,
  onChanged,
}: Props) {
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { isRecording, start, stop, cancel, error: recordError } = useScreenRecorder();

  // ── Confirm dialog state ──────────────────────────────────────────────────
  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    onConfirm: () => Promise<void>;
    title?: string;
    confirmLabel?: string;
    destructive?: boolean;
  } | null>(null);

  function askConfirm(
    message: string,
    action: () => Promise<void>,
    options?: { title?: string; confirmLabel?: string; destructive?: boolean },
  ) {
    setConfirmDialog({ message, onConfirm: action, ...options });
  }

  async function handleConfirm() {
    if (!confirmDialog) return;
    const action = confirmDialog.onConfirm;
    setConfirmDialog(null);
    await action();
  }

  function handleCancel() {
    setConfirmDialog(null);
  }

  // ── Estado del editor de Material de Lectura ──────────────────────────────
  const [readingOpen, setReadingOpen] = useState(false);
  const [draftReading, setDraftReading] = useState('');
  const [savingReading, setSavingReading] = useState(false);

  async function handleSaveReading() {
    setSavingReading(true);
    setError(null);
    try {
      await api.patch(`/topics/${topicId}`, { contentText: draftReading });
      setReadingOpen(false);
      onChanged();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'No se pudo guardar el material de lectura.');
    } finally {
      setSavingReading(false);
    }
  }

  function handleCancelReading() {
    const saved = contentText ?? '';
    if (draftReading !== saved) {
      askConfirm(
        '¿Descartás los cambios en el Material de Lectura?',
        async () => { setReadingOpen(false); },
        { title: 'Descartar cambios', confirmLabel: 'Descartar', destructive: false },
      );
    } else {
      setReadingOpen(false);
    }
  }

  // ── Upload helpers ────────────────────────────────────────────────────────

  async function attachVideo(file: File | Blob, fileName: string) {
    setError(null);
    setStatus('Subiendo video...');
    try {
      const durationSeconds = await getVideoDurationSeconds(file);
      // HU5: "duración máxima del video: 30 minutos"
      if (durationSeconds > MAX_VIDEO_DURATION_SECONDS) {
        setError('El video supera la duración máxima de 30 minutos.');
        setStatus(null);
        return;
      }
      const url = await uploadFileToS3(file, 'video', fileName);
      await api.post(`/topics/${topicId}/video`, { videoUrl: url, videoDurationSeconds: durationSeconds });
      setStatus('Video cargado correctamente.');
      onChanged();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'No se pudo subir el video.');
    } finally {
      setStatus(null);
    }
  }

  // HU5 (carga de un video ya existente desde un archivo del dispositivo)
  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await attachVideo(file, file.name);
    e.target.value = '';
  }

  // HU6: grabación de pantalla — persiste en screenRecordingUrl (endpoint separado)
  async function handleStopRecording() {
    const blob = await stop();
    if (!blob) return;
    setError(null);
    setStatus('Subiendo grabación...');
    try {
      const durationSeconds = await getVideoDurationSeconds(blob);
      if (durationSeconds > MAX_VIDEO_DURATION_SECONDS) {
        setError('La grabación supera la duración máxima de 30 minutos.');
        setStatus(null);
        return;
      }
      const url = await uploadFileToS3(blob, 'video', `grabacion-${Date.now()}.webm`);
      await api.post(`/topics/${topicId}/screen-recording`, {
        screenRecordingUrl: url,
        videoDurationSeconds: durationSeconds,
      });
      setStatus('Grabación guardada correctamente.');
      onChanged();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'No se pudo guardar la grabación.');
    } finally {
      setStatus(null);
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

  // ── Delete handlers ───────────────────────────────────────────────────────

  async function handleDeleteVideo() {
    askConfirm(
      '¿Estás seguro de que querés eliminar el video? Esta acción no se puede deshacer.',
      async () => {
        try {
          await deleteTopicVideo(topicId);
          onChanged();
        } catch {
          setError('No se pudo eliminar el video.');
        }
      },
    );
  }

  async function handleDeleteScreenRecording() {
    askConfirm(
      '¿Estás seguro de que querés eliminar la grabación? Esta acción no se puede deshacer.',
      async () => {
        try {
          await deleteTopicScreenRecording(topicId);
          onChanged();
        } catch {
          setError('No se pudo eliminar la grabación.');
        }
      },
    );
  }

  async function handleDeleteMaterial(materialId: string) {
    askConfirm(
      '¿Estás seguro de que querés eliminar el archivo? Esta acción no se puede deshacer.',
      async () => {
        try {
          await deleteMaterial(topicId, materialId);
          onChanged();
        } catch {
          setError('No se pudo eliminar el material.');
        }
      },
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mt-2 space-y-2 text-sm">
      {/* ── Modal de confirmación ─────────────────────────────────────────── */}
      {confirmDialog && (
        <ConfirmDialog
          message={confirmDialog.message}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          title={confirmDialog.title}
          confirmLabel={confirmDialog.confirmLabel}
          destructive={confirmDialog.destructive}
        />
      )}
      {/* ── Botones de acción ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* HU5 */}
        <label className="cursor-pointer text-slate-700 underline">
          {videoUrl ? 'Reemplazar video (archivo)' : 'Subir video (archivo)'}
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
            {screenRecordingUrl ? 'Volver a grabar pantalla' : 'Grabar pantalla'}
          </button>
        )}

        {/* HU7 */}
        <label className="cursor-pointer text-slate-700 underline">
          Agregar material
          <input type="file" accept=".pdf,.xlsx,.xls,.docx,.doc,.txt" onChange={handleMaterialSelected} hidden />
        </label>

        {/* HU nueva: Material de Lectura */}
        <button
          type="button"
          onClick={() => {
            setDraftReading(contentText ?? '');
            setReadingOpen(true);
          }}
          className="text-slate-700 underline"
        >
          Material de Lectura
        </button>
      </div>

      {/* ── Editor de Material de Lectura ────────────────────────────────── */}
      {readingOpen && (
        <div className="mt-2 border rounded p-3 space-y-2">
          <p className="text-xs font-medium text-slate-600">Material de Lectura</p>
          <textarea
            autoFocus
            rows={6}
            value={draftReading}
            onChange={(e) => setDraftReading(e.target.value)}
            placeholder="Escribí el texto del material de lectura. Podés pegar links externos (ej: https://docs.example.com)."
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm resize-y"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSaveReading}
              disabled={savingReading}
              className="bg-slate-800 text-white px-3 py-2 rounded text-sm disabled:opacity-50"
            >
              {savingReading ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={handleCancelReading}
              disabled={savingReading}
              className="border border-slate-300 px-3 py-2 rounded text-sm disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── Visualización del Material de Lectura guardado ───────────────── */}
      {!readingOpen && contentText && (
        <div className="mt-2 border rounded p-3 space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-600">Material de Lectura</p>
            <button
              type="button"
              onClick={() => { setDraftReading(contentText ?? ''); setReadingOpen(true); }}
              className="text-xs text-slate-500 underline"
            >
              Editar
            </button>
          </div>
          <div className="text-sm text-slate-700 whitespace-pre-wrap break-words">
            <ReadingMaterialDisplay text={contentText} />
          </div>
        </div>
      )}

      {/* ── Vista previa: video subido (HU5) ─────────────────────────────── */}
      {videoUrl && (
        <div className="border rounded p-2 space-y-1">
          <p className="text-xs text-slate-500">Vista previa — video subido</p>
          <video
            src={videoUrl}
            controls
            className="w-full rounded"
            style={{ maxHeight: '240px' }}
          />
          <button
            type="button"
            onClick={handleDeleteVideo}
            className="flex items-center gap-1 text-xs text-red-600 underline"
          >
            <TrashIcon /> Eliminar video
          </button>
        </div>
      )}

      {/* ── Vista previa: grabación de pantalla (HU6) ────────────────────── */}
      {screenRecordingUrl && (
        <div className="border rounded p-2 space-y-1">
          <p className="text-xs text-slate-500">Vista previa — grabación de pantalla</p>
          <video
            src={screenRecordingUrl}
            controls
            className="w-full rounded"
            style={{ maxHeight: '240px' }}
          />
          <button
            type="button"
            onClick={handleDeleteScreenRecording}
            className="flex items-center gap-1 text-xs text-red-600 underline"
          >
            <TrashIcon /> Eliminar video grabado
          </button>
        </div>
      )}

      {/* ── Vista previa: materiales adjuntos (HU7) ──────────────────────── */}
      {materials.length > 0 && (
        <div className="border rounded p-2 space-y-1">
          <p className="text-xs text-slate-500">Material adjunto</p>
          {materials.map((m) => (
            <div key={m.id} className="flex items-center justify-between">
              <a
                href={m.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-slate-700 underline truncate max-w-[70%]"
              >
                {m.fileName}
              </a>
              <button
                type="button"
                onClick={() => handleDeleteMaterial(m.id)}
                className="flex items-center gap-1 text-xs text-red-600 underline ml-2 shrink-0"
              >
                <TrashIcon /> Eliminar archivo
              </button>
            </div>
          ))}
        </div>
      )}

      {status && <p className="text-slate-500">{status}</p>}
      {(error || recordError) && <p className="text-red-600">{error ?? recordError}</p>}
    </div>
  );
}
