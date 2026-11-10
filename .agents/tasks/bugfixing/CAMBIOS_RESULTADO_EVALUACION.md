# Cambios en Pantalla de Resultado de Evaluación

## Resumen
Se ha actualizado la pantalla de resultados de evaluación para mostrar los intentos realizados e incluir un botón "Reintentar" que permite al usuario rehacer la evaluación.

## Archivo Modificado
- `frontend/src/pages/EvaluationPage.tsx`

## Cambios Realizados

### 1. **Información de Intentos Realizados**
- Se agregó una sección que muestra claramente:
  - Número de intentos realizados
  - Total de intentos permitidos (ej: "1 de 2")
  - Formato: "Intentos realizados: X de Y"

### 2. **Botón "Reintentar"**
- **Condición**: Solo aparece si aún hay intentos disponibles
  - Si `attemptsUsed < maxAttempts` → Botón "Reintentar" activo
  - Si `attemptsUsed >= maxAttempts` → Mensaje indicando límite alcanzado

- **Funcionalidad**: Al hacer clic en "Reintentar":
  - Limpia el resultado actual (`setResult(null)`)
  - Limpia las respuestas anteriores (`setAnswers({})`)
  - Limpia mensajes de error (`setError(null)`)
  - El usuario vuelve a la pantalla de evaluación para rehacer el examen

- **Estilos**:
  - Color azul: `bg-blue-600 dark:bg-blue-700`
  - Hover effect para mejor UX
  - Tema oscuro soportado

### 3. **Mejora en la Presentación de Resultados**
- Los resultados ahora se muestran en una tarjeta contenedora (card)
- Sección separada para "Detalle de respuestas"
- Mejor organización visual con espacios y bordes

## Estructura Visual de la Pantalla de Resultados

```
┌─────────────────────────────────────────┐
│ Resultado                               │
├─────────────────────────────────────────┤
│ Puntaje: 85 (mínimo: 70) — Aprobado   │
│                                         │
│ ┌─────────────────────────────────────┐│
│ │ Intentos realizados: 1 de 2         ││
│ └─────────────────────────────────────┘│
│                                         │
│ Detalle de respuestas:                  │
│ • Pregunta 1: Correcta ✓                │
│ • Pregunta 2: Incorrecta ✗              │
│ • Pregunta 3: Correcta ✓                │
│                                         │
│ [Botón "Reintentar"]                    │
└─────────────────────────────────────────┘
```

## Lógica de Control

```javascript
const canRetry = evaluation.attemptsUsed < evaluation.maxAttempts;

if (canRetry) {
  // Mostrar botón "Reintentar"
  // Onclick → Limpiar estado y volver a evaluación
} else {
  // Mostrar mensaje: "Has alcanzado el límite de intentos máximos."
}
```

## Compatibilidad
- ✅ Tema claro (light mode)
- ✅ Tema oscuro (dark mode)
- ✅ Responsive design
- ✅ TypeScript types correctos
- ✅ Estados React bien manejados

## Prueba Manual

1. Ir a una evaluación: `/evaluaciones/{evaluationId}`
2. Responder las preguntas
3. Hacer clic en "Enviar evaluación"
4. En la pantalla de resultados:
   - ✅ Verificar que se muestre "Intentos realizados: X de Y"
   - ✅ Verificar que aparezca el botón "Reintentar" (si hay intentos disponibles)
   - ✅ Hacer clic en "Reintentar"
   - ✅ Verificar que se limpien los datos y vuelva a la evaluación
   - ✅ Responder nuevamente y enviar

## Notas
- El endpoint `/evaluations/{evaluationId}/take` ya retorna `attemptsUsed` y `maxAttempts`
- No se requieren cambios en el backend
- El estado se reinicia correctamente al reintentar
