# Plan de implementación: HU-19 - Intentos configurables

## Hallazgos de exploración

### Base de datos (schema.prisma)
- Modelo `Evaluation` actual: id, courseId, topicId, title, minScore, createdAt, updatedAt
- Modelo `EvaluationAttempt`: id, evaluationId, studentId, attemptNumber (1 o 2 en V1), score, passed, evaluationSnapshot, createdAt
- Restricción única: `(evaluationId, studentId, attemptNumber)`
- **No existe** columna `maxAttempts` en `Evaluation`

### Backend (evaluations.service.ts)
- Constante `MAX_ATTEMPTS = 2` hardcoded (línea 13)
- Usada en:
  - `getForTaking()`: devuelve `maxAttempts: MAX_ATTEMPTS`
  - `submit()`: verifica `attempts.length >= MAX_ATTEMPTS` en `assertCanAttempt()`
  - `assertCanAttempt()`: valida límite con mensaje fijo
- Variable de entorno `MAX_EVALUATION_ATTEMPTS` existe pero **no se usa** (código muerto)
- `getForTaking()` ya devuelve `maxAttempts` al frontend (buen punto de partida)

### Backend (certificates.service.ts)
- `evaluateEligibility()` línea 207: hardcodea `if (evalAttempts.length >= 2)` para determinar si intentos agotados
- **Crítico**: debe cambiar a comparar contra `evaluation.maxAttempts`

### DTOs actuales
- `CreateEvaluationDto`: no tiene campo `maxAttempts`
- `UpdateEvaluationDto`: no tiene campo `maxAttempts`
- Ambos necesitan validación: entero, 1-5, opcional, default 2 en creación

### Frontend (EvaluationCreator.tsx, EvaluationEditor.tsx)
- No tienen campo "Cantidad máxima de intentos"
- Necesitan campo numérico, validación, mensajes en español

### Frontend (EvaluationPage.tsx)
- Probablemente muestra `attemptsUsed` y `maxAttempts` ya (verificar)
- Mensaje de límite alcanzado en HU-12 debe mostrar el máximo vigente

### Tests
- `evaluations.service.spec.ts`: asume MAX_ATTEMPTS = 2
- `evaluation-attempts.cy.e2e.ts` (Cypress): asume 2 intentos
- `certificates.service.spec.ts`: asume 2 intentos

### Migraciones
- Última: `20261025000000_add_certificates`
- Nueva debe: `20261101000000_add_max_attempts_to_evaluations`
- Agregar `maxAttempts Int @default(2)` a `Evaluation`

---

## Cambios por capa

### 1. Base de datos
**Archivo**: `backend/prisma/schema.prisma`
- Agregar `maxAttempts Int @default(2)` a modelo `Evaluation`

**Archivo**: `backend/prisma/migrations/20261101000000_add_max_attempts_to_evaluations/migration.sql`
- Crear migración: `ALTER TABLE "evaluations" ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 2;`

### 2. DTOs Backend
**Archivo**: `backend/src/evaluations/dto/create-evaluation.dto.ts`
- Agregar campo:
  ```typescript
  @IsOptional()
  @IsInt({ message: 'La cantidad de intentos debe ser un número entero.' })
  @Min(1, { message: 'El mínimo de intentos es 1.' })
  @Max(5, { message: 'El máximo de intentos es 5.' })
  maxAttempts?: number;
  ```

**Archivo**: `backend/src/evaluations/dto/update-evaluation.dto.ts`
- Agregar campo (mismo que create, pero también opcional)

### 3. Lógica Backend (evaluations.service.ts)
**Cambios principales**:
- Eliminar constante `MAX_ATTEMPTS = 2`
- En `create()`: pasar `maxAttempts: dto.maxAttempts ?? 2` al crear
- En `update()`: permitir cambiar `maxAttempts` (si está en DTO)
- En `getForTaking()`: devolver `maxAttempts: evaluation.maxAttempts` (ya trae evaluation)
- En `submit()`: usar `evaluation.maxAttempts` en lugar de `MAX_ATTEMPTS`
- En `assertCanAttempt()`: recibir `maxAttempts` como parámetro, comparar contra él
  - Mensaje dinámico: `Alcanzaste el límite de ${maxAttempts} intentos para esta evaluación.`

**Cambios en el interfaz**:
- Actualizar `EvaluationSnapshot` para incluir `maxAttempts` (opcional para backward-compat, pero mejor incluirlo)

### 4. Certificados (certificates.service.ts)
**Cambio crítico en `evaluateEligibility()`**:
- Línea ~207: cambiar de `if (evalAttempts.length >= 2)` a consultar cada `evaluation` y comparar contra su `maxAttempts` vigente
- **Lógica**: para cada evaluación no aprobada, obtener su `maxAttempts` actual y comparar
- Acceso a `evaluation.maxAttempts` necesita incluir en la query de evaluaciones

### 5. Frontend (Componentes)

**EvaluationCreator.tsx**:
- Agregar campo input type="number" para "Cantidad máxima de intentos"
- Placeholder: "2" (default)
- Validación: 1-5, entero, mensaje en español si inválido
- Enviar en payload de POST

**EvaluationEditor.tsx**:
- Agregar mismo campo numérico
- Pre-llenar con valor vigente (del state de evaluación)
- Enviar en payload de PATCH

**EvaluationPage.tsx**:
- Verificar que ya muestre "Intento X de N" (probable que ya lo haga con `maxAttempts`)
- Mensaje de límite alcanzado: usar el máximo vigente, no un "2" fijo

### 6. Tests Backend (Jest)

**evaluations.service.spec.ts**:
- Tests nuevos para cada criterio de aceptación:
  - ✅ CA1: crear con maxAttempts = 3, verificar se guarda
  - ✅ CA1: editar maxAttempts = 4, verificar se actualiza
  - ✅ CA2: crear sin maxAttempts, debe ser 2
  - ✅ CA3: intentar crear con maxAttempts = 0, rechazar con mensaje
  - ✅ CA3: intentar crear con maxAttempts = 6, rechazar
  - ✅ CA3: intentar crear con maxAttempts = "abc", rechazar (class-validator lo valida)
  - ✅ CA4: profesor ajeno intenta editar, 403
  - ✅ CA5: editar maxAttempts no cambia intentos previos ni snapshot
  - ✅ CA6: alumno agotó con limit=2, subir a limit=3, puede rendir nuevamente
  - ✅ CA6: alumno aprobó, no puede rendir aunque suba el límite
  - ✅ CA7: alumno hizo 3 intentos sin aprobar con limit=3, se reduce a limit=2, no puede rendir (3 >= 2)
  - ✅ CA8: `getForTaking()` devuelve "attemptsUsed: 1, maxAttempts: 3"

**certificates.service.spec.ts**:
- ✅ CA9: alumno sin intentos, eligiendo, no marca "intentos agotados"
- ✅ CA9: alumno con 2 intentos fallidos y maxAttempts=3, **no** está agotado (puede rendir)
- ✅ CA9: alumno con 3 intentos fallidos y maxAttempts=3, **sí** está agotado
- ✅ CA9: alumno aprobó 1 evaluación pero otra con intentos agotados, no es elegible

### 7. Tests Frontend (Cypress)

**evaluation-attempts.cy.ts** (adaptar/expandir):
- Escenario 1: profesor crea evaluación con maxAttempts=1, alumno intenta renderirla 2 veces, rechaza en el intento 2
- Escenario 2: profesor crea evaluación con maxAttempts=3, alumno falla 2 veces, puede rendir 3 veces
- Escenario 3: profesor crea evaluación con maxAttempts=2 (default), alumno aprueba, no puede rendir nuevamente
- Escenario 4: profesor crea con maxAttempts=2, alumno falla 2 veces, profesor sube a maxAttempts=3, alumno intenta rendir nuevamente con éxito

### 8. Postman
- POST `/evaluations` con `maxAttempts: 3` (válido)
- POST `/evaluations` con `maxAttempts: 0` (rechaza con 400)
- POST `/evaluations` con `maxAttempts: 6` (rechaza con 400)
- PATCH `/evaluations/:id` con `maxAttempts: 1` (solo profesor propietario del curso)

### 9. Documentación
- README: actualizar de V1 a V3, mencionar HU-19
- Eliminar o documentar `MAX_EVALUATION_ATTEMPTS` en `.env.example` (era unused)

---

## Riesgos y consideraciones

| Riesgo | Mitigación |
|--------|-----------|
| Cambiar `MAX_ATTEMPTS` constante afecta otros tests | Buscar todas referencias, actualizar/parametrizar |
| Certificados calculan "agotados" con hardcoded 2 | Incluir `maxAttempts` en query de evaluaciones en `evaluateEligibility()` |
| Frontend muestra "2" fijo si aún no hemos pasado `maxAttempts` | Verificar que `getForTaking()` ya devuelve el campo (dice que sí) |
| Migraciones no aplican limpias | Probar `prisma migrate dev` desde zero y con datos existentes |
| Tests asumen `MAX_ATTEMPTS = 2` explícita o implícitamente | Actualizar todas las aserciones |
| Campo `maxAttempts` en `EvaluationSnapshot` para backward-compat | Decidir: incluir (recomendado) o no; snapshot es JSON y puede variar |

---

## Orden de implementación (dependencias mínimas)

1. **schema.prisma + migración** ← prerequisito para todo
2. **DTOs** ← validación, no toca DB aún
3. **evaluations.service** ← lógica core
4. **certificates.service** ← usa lógica de evaluations
5. **Frontend** ← consume endpoints backend
6. **Tests Jest** ← valida backend
7. **Tests Cypress** ← valida UI
8. **Postman + README** ← documentación

---

## Definition of Done checklist

- [ ] schema.prisma tiene `maxAttempts Int @default(2)` en Evaluation
- [ ] Migración `20261101000000_add_max_attempts_to_evaluations` creada y aplica limpia
- [ ] DTOs tienen campo `maxAttempts` con validación 1-5
- [ ] `evaluations.service`:
  - [ ] `MAX_ATTEMPTS` constante eliminada o documentada como default unused
  - [ ] `create()` guarda `maxAttempts` desde DTO (default 2)
  - [ ] `update()` permite cambiar `maxAttempts`
  - [ ] `getForTaking()` devuelve `maxAttempts` vigente
  - [ ] `submit()` usa `evaluation.maxAttempts`, no constante
  - [ ] `assertCanAttempt()` recibe `maxAttempts`, mensaje dinámico
- [ ] `certificates.service.evaluateEligibility()` compara contra `evaluation.maxAttempts` vigente
- [ ] Frontend: campos en Creator y Editor
- [ ] Frontend: UI muestra "Intento X de N" con máximo vigente
- [ ] Jest tests cubren CA1-CA9
- [ ] Cypress tests: 4 escenarios (default, 1, 3, aumentar)
- [ ] `npm test` pasa en backend
- [ ] `npm run build && npm run lint` pasa en frontend
- [ ] Migraciones aplican clean y con datos existentes
- [ ] Postman collection actualizada
- [ ] README actualizado a V3
- [ ] No hay `MAX_ATTEMPTS` constante ni configuración dead code

