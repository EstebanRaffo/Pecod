import { useCallback, useRef, useState } from 'react';

const MAX_DURATION_SECONDS = 1800; // 30 min (HU6, mismo límite que HU5)

export function useScreenRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  const start = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      // HU6: "el Profesor puede iniciar una grabación de pantalla... previa
      // autorización de permisos del navegador"
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      chunksRef.current = [];
      cancelledRef.current = false;

      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      // Si el usuario corta el compartir pantalla desde el propio navegador,
      // tratamos eso como "finalizar grabación" (no como cancelación).
      stream.getVideoTracks()[0].onended = () => stop();

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);

      // HU6: límite de 30 minutos -> corta automáticamente y avisa el límite alcanzado.
      timeoutRef.current = setTimeout(() => {
        setError('Se alcanzó el límite de 30 minutos de grabación.');
        stop();
      }, MAX_DURATION_SECONDS * 1000);
    } catch {
      setError('No se pudo iniciar la grabación (permisos denegados o cancelados).');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stop = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        resolve(null);
        return;
      }
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      recorder.onstop = () => {
        recorder.stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
        // HU6: "si la grabación se cancela antes de finalizar, no se genera archivo"
        if (cancelledRef.current || chunksRef.current.length === 0) {
          resolve(null);
          return;
        }
        resolve(new Blob(chunksRef.current, { type: 'video/webm' }));
      };
      recorder.stop();
    });
  }, []);

  // Cancela sin generar ningún archivo (HU6).
  const cancel = useCallback(() => {
    cancelledRef.current = true;
    stop();
  }, [stop]);

  return { isRecording, error, start, stop, cancel };
}
