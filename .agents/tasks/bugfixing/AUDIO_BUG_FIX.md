# Fix: Bug de Audio Faltante en Grabaciones de Pantalla (HU6)

## 🐛 Problema Identificado

**Síntoma:** Videos grabados por pantalla no tienen sonido, pero videos subidos sí.

**Causa Raíz:** El código en `useScreenRecorder.ts` solicitaba audio con `{ video: true, audio: true }`, pero no validaba si realmente se capturó audio del stream. Esto ocurre cuando:

1. El usuario rechaza los permisos de **audio** en el diálogo del navegador
2. El navegador no soporta ciertos codecs WebM con audio
3. No hay retroalimentación al usuario sobre la ausencia de audio

## 🔧 Cambios Implementados

### 1. **Mejora de `useScreenRecorder.ts`**

#### ✅ Validación de Audio
```typescript
hasAudioRef.current = stream.getAudioTracks().length > 0;
```
- Ahora verifica explícitamente si el stream contiene pistas de audio
- Retorna esta información junto con el blob

#### ✅ Soporte Múltiples MIME Types
```typescript
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
```
- Intenta múltiples MIME types en orden de preferencia
- Asegura compatibilidad con navegadores diferentes

#### ✅ Mensajes de Error Más Específicos
```typescript
if (err.name === 'NotAllowedError') {
  setError('Grabación cancelada. Asegúrate de autorizar los permisos de pantalla y audio.');
} else if (err.name === 'NotFoundError') {
  setError('No se encontró ninguna pantalla para grabar.');
}
```

#### ✅ Interfaz de Resultado
```typescript
interface RecordingResult {
  blob: Blob;
  hasAudio: boolean;
}
```
- El hook retorna tanto el blob como información sobre audio

### 2. **Mejora de `TopicMediaUploader.tsx`**

#### ✅ Diálogo de Confirmación para Sin Audio
```typescript
if (!hasAudio) {
  askConfirm(
    '⚠️ La grabación no tiene audio. Esto puede ocurrir si no autorizaste los permisos de audio en el navegador. ¿Querés continuar sin audio o volver a grabar?',
    async () => {
      await uploadRecording(blob);
    },
    { /* ... */ }
  );
  return;
}
```

#### ✅ Separación de Responsabilidades
- Creada nueva función `uploadRecording()` para reutilizar lógica
- `handleStopRecording()` ahora solo maneja la captura y validación
- Mejor mantenibilidad y legibilidad

## 📋 Flujo de Usuario Mejorado

```
1. Usuario inicia grabación
   ↓
2. Navegador solicita permisos (video + audio)
   ↓
3. Grabación captura video y audio (si permisos otorgados)
   ↓
4. Usuario finaliza grabación
   ↓
5. Hook valida si hay audio
   ├─ SÍ hay audio → Sube directamente
   └─ NO hay audio → Muestra diálogo:
      ├─ "Continuar sin audio" → Sube sin audio
      └─ "Volver a grabar" → Permite reintentar
```

## 🎯 Beneficios

- ✅ **Validación explícita:** El sistema sabe si hay audio o no
- ✅ **Control del usuario:** El profesor decide si continúa sin audio
- ✅ **Mejor UX:** Mensajes claros sobre qué salió mal
- ✅ **Compatibilidad:** Soporta múltiples navegadores y codecs
- ✅ **Debugging más fácil:** Errores específicos para cada escenario

## 🧪 Cómo Probar

1. Abre http://localhost:5173/profesor/cursos/[courseId]
2. En un tópico, inicia una grabación de pantalla
3. **Escenario A (Con Audio):**
   - Autoriza permisos de pantalla Y audio
   - Detén la grabación
   - ✓ Se sube sin diálogo adicional
   
4. **Escenario B (Sin Audio):**
   - Rechaza los permisos de audio (pero autoriza pantalla)
   - Detén la grabación
   - ⚠️ Verás el diálogo advirtiendo sobre audio faltante
   - Elige "Continuar sin audio" para confirmar
   - ✓ Se sube sin audio

## 🔍 Archivos Modificados

- `frontend/src/hooks/useScreenRecorder.ts` - Hook de grabación mejorado
- `frontend/src/components/TopicMediaUploader.tsx` - Componente con validación de audio

## 📌 Notas Técnicas

- `MediaRecorder.isTypeSupported()` es necesario verificar antes de pasar el mimeType
- `stream.getAudioTracks()` retorna un array vacío si no hay pistas de audio
- El tipo MIME del blob debe coincidir con lo usado en el MediaRecorder
- Los navegadores modernos (Chrome, Firefox, Edge, Safari) soportan al menos `video/webm`
