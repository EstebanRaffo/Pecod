# Cambios: Indicadores Visuales de Estado de Evaluaciones

## Resumen
Se ha implementado un sistema de indicadores visuales para mostrar el estado de aprobación de las evaluaciones en la pantalla de "Mis Cursos" (/mis-cursos/{courseId}). Las evaluaciones aprobadas se muestran con un indicador verde claro, y las desaprobadas con un indicador rojo claro.

## Archivos Modificados

### Backend
- `backend/src/evaluations/evaluations.service.ts`

### Frontend
- `frontend/src/pages/CourseLearningPage.tsx`

## Cambios Detallados

### 1. Backend: `evaluations.service.ts`

#### Modificación: Método `listByCourse()`
Se mejoró el método para incluir información del estado de aprobación del estudiante cuando es estudiante quien consulta.

**Lógica:**
- Para estudiantes: Se consulta si el estudiante ha aprobado cada evaluación (`passed: true`)
- Se retornan los campos adicionales:
  - `passed`: boolean (indica si está aprobada)
  - `score`: number | null (puntaje obtenido, si existe)
  - `attemptNumber`: number | null (intento en que se aprobó, si existe)
- Para profesores: Se devuelven solo los datos básicos (sin información de aprobación de estudiantes)

**Código:**
```typescript
async listByCourse(courseId: string, user: AuthenticatedUser) {
  if (user.role === Role.STUDENT) {
    await this.assertEnrolled(courseId, user);
  }
  const evaluations = await this.prisma.evaluation.findMany({
    where: { courseId },
    select: { id: true, title: true, minScore: true, topicId: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  // Si es estudiante, incluir estado de aprobación
  if (user.role === Role.STUDENT) {
    const evaluationsWithStatus = await Promise.all(
      evaluations.map(async (evaluation) => {
        const attempt = await this.prisma.evaluationAttempt.findFirst({
          where: {
            evaluationId: evaluation.id,
            studentId: user.userId,
            passed: true,
          },
          select: { passed: true, score: true, attemptNumber: true },
        });
        return {
          ...evaluation,
          passed: attempt?.passed ?? false,
          score: attempt?.score ?? null,
          attemptNumber: attempt?.attemptNumber ?? null,
        };
      }),
    );
    return evaluationsWithStatus;
  }

  return evaluations;
}
```

### 2. Frontend: `CourseLearningPage.tsx`

#### Cambio 1: Actualización de interfaz `Evaluation`
Se agregaron campos opcionales para almacenar el estado de aprobación:

```typescript
interface Evaluation {
  id: string;
  title: string;
  minScore: number;
  topicId: string | null;
  passed?: boolean;           // ← Nuevo
  score?: number | null;      // ← Nuevo
  attemptNumber?: number | null; // ← Nuevo
}
```

#### Cambio 2: Indicadores en "Evaluaciones de esta clase"
Se agregó un indicador visual junto al título de cada evaluación:

**Para evaluaciones aprobadas:**
```jsx
{evaluation.passed && (
  <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs rounded-md font-medium">
    ✓ Aprobada
  </span>
)}
```

**Para evaluaciones desaprobadas (que tienen intento registrado):**
```jsx
{!evaluation.passed && evaluation.score !== null && evaluation.score !== undefined && (
  <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 text-xs rounded-md font-medium">
    ✗ Desaprobada
  </span>
)}
```

#### Cambio 3: Indicadores en "Evaluaciones de cierre"
Se aplicaron los mismos indicadores visuales en la sección de evaluaciones de cierre.

## Estilos Aplicados

### Indicador de Aprobación (Verde Claro)
- Fondo: `bg-emerald-100` (light) / `dark:bg-emerald-900` (dark)
- Texto: `text-emerald-700` (light) / `dark:text-emerald-300` (dark)
- Símbolo: ✓
- Etiqueta: "Aprobada"

### Indicador de Desaprobación (Rojo Claro)
- Fondo: `bg-red-100` (light) / `dark:bg-red-900` (dark)
- Texto: `text-red-700` (light) / `dark:text-red-300` (dark)
- Símbolo: ✗
- Etiqueta: "Desaprobada"

### Características visuales
- Padding: `px-2 py-1`
- Border radius: `rounded-md`
- Font weight: `font-medium`
- Size: `text-xs`
- Flexbox con gap para los símbolos

## Visualización

### Pantalla de Mis Cursos - Evaluaciones de tema

```
Temario
├─ 1. Introducción a JavaScript
│  ├─ Video: ...
│  └─ Evaluaciones de esta clase
│     ├─ Introducción (prueba corta)     [✓ Aprobada]
│     ├─ Conceptos básicos              [✗ Desaprobada]
│     └─ Reto: variables                (sin intentos)

├─ 2. Funciones en JavaScript
│  └─ Evaluaciones de esta clase
│     └─ Funciones avanzadas           [✓ Aprobada]

Evaluaciones de cierre
├─ Examen final                         [✓ Aprobada]
├─ Proyecto integrador                 [✗ Desaprobada]
└─ Evaluación práctica                  (sin intentos)
```

## Compatibilidad

- ✅ Tema claro y oscuro
- ✅ Responsive design
- ✅ TypeScript tipado correctamente
- ✅ Sin cambios en la lógica de negocio
- ✅ Backward compatible (profesores no ven cambios)
- ✅ Solo aplica a estudiantes

## Prueba Manual

1. Ir a `/mis-cursos/{courseId}` como estudiante
2. En el temario, buscar "Evaluaciones de esta clase"
3. Verificar:
   - ✅ Evaluaciones aprobadas muestren badge verde con "✓ Aprobada"
   - ✅ Evaluaciones desaprobadas muestren badge rojo con "✗ Desaprobada"
   - ✅ Evaluaciones sin intentos no muestren badge
   - ✅ Los indicadores se muestren correctamente en tema claro y oscuro
4. Repetir en "Evaluaciones de cierre"

## Base de Datos

**Tabla utilizada:** `evaluation_attempts`

Los campos consultados son:
- `evaluationId`: ID de la evaluación
- `studentId`: ID del estudiante
- `passed`: Booleano indicando si fue aprobada
- `score`: Puntaje obtenido
- `attemptNumber`: Número del intento

## Performance

- Se realiza una consulta por evaluación para obtener el estado
- Se usa `Promise.all()` para paralelizar las consultas
- Se filtra por `passed: true` para obtener solo el intento aprobado (si existe)
- No afecta a profesores (no ejecuta la lógica de búsqueda de status)

## Notas de Implementación

- El indicador solo aparece si hay datos (`passed` o `score` definidos)
- Para evaluaciones sin intentos, no se muestra ningún indicador
- La lógica de visualización es:
  - Si `passed === true` → Mostrar "Aprobada" en verde
  - Si `passed === false` Y hay score → Mostrar "Desaprobada" en rojo
  - Si no hay intento → No mostrar nada
