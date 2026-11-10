# Testing Manual - Audio Bug Fix

## Requisitos Previos

- Frontend corriendo en http://localhost:5173
- Backend corriendo en http://localhost:3000
- Estar autenticado como Profesor
- Tener al menos un curso creado

## Casos de Prueba

### Test 1: Grabación CON Audio (Esperado: ✅ éxito)

**Precondiciones:**
- Ir a un tópico en modo edición
- Navegador: Chrome, Firefox, Edge o Safari moderno

**Pasos:**
1. Click en "Grabar pantalla"
2. En el diálogo de permisos:
   - ✅ Autorizar acceso a pantalla
   - ✅ Autorizar acceso a micrófono
3. Hablar algo mientras grabas (para capturar audio)
4. Click en "Finalizar grabación"
5. Esperar a que se suba a S3

**Resultado Esperado:**
- ✓ No aparece diálogo de advertencia
- ✓ Mensaje: "Grabación guardada correctamente"
- ✓ Video aparece en la página
- ✓ Al reproducir, se escucha el audio

---

### Test 2: Grabación SIN Audio (Esperado: ⚠️ advertencia)

**Precondiciones:**
- Ir a un tópico en modo edición

**Pasos:**
1. Click en "Grabar pantalla"
2. En el diálogo de permisos:
   - ✅ Autorizar acceso a pantalla
   - ❌ Rechazar acceso a micrófono (o no autorizarlo)
3. Grabar algo (aunque sea silencio)
4. Click en "Finalizar grabación"

**Resultado Esperado:**
- ⚠️ Aparece diálogo: "La grabación no tiene audio..."
- Opciones:
  - "Continuar sin audio" - sube igual
  - "Cancelar" o clic fuera - permite reintentar
- Si elige "Continuar sin audio":
  - ✓ Mensaje: "Grabación guardada correctamente"
  - ✓ Video aparece sin sonido

---

### Test 3: Cancelación de Grabación (Esperado: ✅ sin cambios)

**Pasos:**
1. Click en "Grabar pantalla"
2. Autorizar permisos
3. Click en "Cancelar"

**Resultado Esperado:**
- ✓ No se genera archivo
- ✓ No aparece diálogo de confirmación
- ✓ Página sigue igual (sin video agregado)

---

### Test 4: Diferencia Video Subido vs Grabado

**Pasos para Video Subido:**
1. Click en "Subir video (archivo)"
2. Seleccionar un archivo .mp4 con audio (ej: video descargado de YouTube)
3. Verificar que se sube

**Pasos para Grabación:**
1. Click en "Grabar pantalla"
2. Autorizar permisos (SIN audio)
3. Finalizar
4. Elegir "Continuar sin audio"

**Resultado Esperado:**
- ✓ Video subido tiene audio al reproducir
- ✓ Video grabado sin audio no tiene sonido
- ⚠️ El diálogo permitió al usuario ser consciente de la diferencia

---

### Test 5: Compatibilidad de Navegadores

**Para cada navegador (Chrome, Firefox, Edge):**

1. Grabar pantalla CON audio
2. Verificar que se sube sin problemas
3. Reproducir y confirmar sonido

**Resultado Esperado:**
- ✓ Todos los navegadores modernos funcionan
- ✓ Se detecta correctamente presencia/ausencia de audio
- ✓ MIME type apropiado se selecciona automáticamente

---

### Test 6: Reintento de Grabación (UX)

**Pasos:**
1. Grabar sin audio (rechazar permisos)
2. Finalizar y ver diálogo
3. Click "Cancelar" en el diálogo (para NO continuar)
4. Click en "Volver a grabar pantalla" (botón debe cambiar de texto)

**Resultado Esperado:**
- ✓ Diálogo cierra
- ✓ Vuelve a permitir grabar
- ✓ Se pueden autorizar permisos en el segundo intento
- ✓ Si autoriza audio esta vez, no aparece diálogo de advertencia

---

## Validación Técnica

### Verificar en DevTools Console

Cuando termines una grabación sin audio, deberías ver:

```javascript
// En el componente, verificar que:
// - result.hasAudio === false (si no hay audio)
// - result.hasAudio === true (si hay audio)
// - result.blob es un Blob válido
```

### Verificar en Red (Network Tab)

```
POST /api/topics/{topicId}/screen-recording
Request Body:
{
  "screenRecordingUrl": "https://s3.../grabacion-1234567890.webm",
  "videoDurationSeconds": 15
}

Response: 200 OK
```

### Verificar Archivo en S3

- Archivo debe estar con nombre: `grabacion-{timestamp}.webm`
- Tamaño debe ser > 0 bytes
- Content-Type debe ser `video/webm`

---

## Checklist de Regresión

- [ ] Videos subidos (HU5) siguen funcionando
- [ ] Grabaciones con audio funcionan (HU6)
- [ ] Grabaciones sin audio muestran advertencia
- [ ] Materiales (HU7) siguen funcionando
- [ ] Material de lectura sigue funcionable
- [ ] No hay errores en la consola del navegador
- [ ] No hay cambios no esperados en la BD

---

## Notas Importantes

1. **Audio rechazado:** En algunos navegadores/sistemas, el usuario puede olvidar que rechazó audio la primera vez. El diálogo lo advierte explícitamente.

2. **Sin micrófono:** En casos donde la máquina no tiene micrófono, el navegador automáticamente rechaza el permiso. El diálogo aún se mostrará como "sin audio".

3. **Audio del sistema (Mac/Windows):** 
   - En Mac con Chrome/Safari, a veces requiere permisos adicionales
   - En Windows con algunos navegadores, puede haber limitaciones

4. **Navegadores antiguos:** Si un navegador no soporta WebM, ahora muestra error claro en lugar de fallar silenciosamente.

---

## Rollback (si es necesario)

Para revertir los cambios:
```bash
git checkout frontend/src/hooks/useScreenRecorder.ts
git checkout frontend/src/components/TopicMediaUploader.tsx
```

Los cambios son completamente retrocompatibles, así que no hay riesgo.
