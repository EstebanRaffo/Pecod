import { useCallback, useRef, useState } from 'react';

const MAX_DURATION_SECONDS = 1800; // 30 min (HU6, mismo límite que HU5)

interface RecordingResult {
  blob: Blob;
  hasAudio: boolean;
}

export function useScreenRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);
  const hasAudioRef = useRef(false);

  const getPreferredMimeType = (): string => {
    const mimeTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=h264,opus',
      'video/webm',
    ];
    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType;
      }
    }
    return '';
  };

  const start = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      // HU6: "el Profesor puede iniciar una grabación de pantalla... previa
      // autorización de permisos del navegador"
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      chunksRef.current = [];
      cancelledRef.current = false;
      hasAudioRef.current = stream.getAudioTracks().length > 0;

      const mimeType = getPreferredMimeType();
      if (!mimeType) {
        setError('Tu navegador no soporta la grabación de video.');
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      stream.getVideoTracks()[0].onended = () => stop();

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);

      timeoutRef.current = setTimeout(() => {
        setError('Se alcanzó el límite de 30 minutos de grabación.');
        stop();
      }, MAX_DURATION_SECONDS * 1000);
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError('Grabación cancelada. Asegúrate de autorizar los permisos de pantalla y audio.');
      } else if (err.name === 'NotFoundError') {
        setError('No se encontró ninguna pantalla para grabar.');
      } else {
        setError('No se pudo iniciar la grabación (permisos denegados o cancelados).');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stop = useCallback((): Promise<RecordingResult | null> => {
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

        if (cancelledRef.current || chunksRef.current.length === 0) {
          resolve(null);
          return;
        }

        const mimeType = recorder.mimeType || 'video/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        resolve({ blob, hasAudio: hasAudioRef.current });
      };
      recorder.stop();
    });
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    stop();
  }, [stop]);

  return { isRecording, error, start, stop, cancel };
}
