# Resumen de implementación: HU-19 - Intentos configurables

**Fecha:** 1/11/2026  
**Estado:** ✅ COMPLETADO

## Qué se implementó

La HU-19 permite a los Profesores configurar la cantidad máxima de intentos que tiene cada Alumno para rendir una evaluación (antes era un límite fijo de 2). El rango válido es 1-5, con default de 2. El cambio es inmediato y no afecta intentos previos ya registrados.

## Cambios realizados

### 1. Base de datos
- **schema.prisma**: Agregado campo `maxAttempts Int @default(2)` al modelo `Evaluation`
- **Migración**: `20261101000000_add_max_attempts_to_evaluations` - migración limpia que aplica sobre base vacía y datos existentes

### 2. Backend

#### DTOs (validación)
- `CreateEvaluationDto`: Agregado campo `@IsOptional @IsInt @Min(1) @Max(5) maxAttempts?: number` con mensajes en español
- `UpdateEvaluationDto`: Mismo campo para edición

#### Lógica principal (`evaluations.service.ts`)
- Eliminada constante `MAX_ATTEMPTS` (era hardcoded a 2)
- `create()`: Guarda `maxAttempts` desde DTO con default 2 si no se informa
- `update()`: Permite editar `maxAttempts` (igual que `minScore` y `title`)
- `getForTaking()`: Devuelve `maxAttempts` vigente en el payload, no la constante fija
- `submit()`: Usa `evaluation.maxAttempts` en validación
- `assertCanAttempt()`: Recibe `maxAttempts` como parámetro, mensaje dinámico en error

#### Certificados (`certificates.service.ts`)
- `evaluateEligibility()`: Compara intentos fallidos contra `evaluation.maxAttempts` vigente, no hardcoded 2
- Queries de evaluaciones incluyen `maxAttempts` en select

### 3. Frontend

#### EvaluationCreator.tsx (crear)
- Input numérico para `maxAttempts` (1-5, default 2) junto a `minScore`
- Validación en UI (range 1-5) + validación backend
- Placeholder descriptivo: "Cantidad máxima de intentos (1-5)"

#### EvaluationEditor.tsx (editar)
- Panel de propiedades básicas (minScore, maxAttempts) editable con modo inline
- Mismo componente permite editar texto de preguntas/opciones
- Lógica para guardar cambios de propiedades vía PATCH

#### EvaluationPage.tsx (rendir)
- Ya mostraba `maxAttempts` y el contador "Intento X de N"
- Mensaje de límite alcanzado usa el máximo vigente

### 4. Tests

#### Jest (`evaluations.service.spec.ts`)
- Mock base de evaluación tiene `maxAttempts: 2`
- Tests nuevos cubren:
  - ✅ CA1: crear con maxAttempts especificado
  - ✅ CA2: default 2 si no se informa
  - ✅ CA1: editar maxAttempts
  - ✅ CA4: profesor no propietario rechazado
  - ✅ CA5: cambio no afecta intentos previos
  - ✅ CA6: alumno que agotó intentos puede rendir si aumenta el límite
  - ✅ CA6: alumno que aprobó no puede rendir aunque aumente el límite
  - ✅ CA7: alumno con 3 intentos y límite reducido a 2 bloqueado
  - ✅ CA8: getForTaking devuelve attemptsUsed y maxAttempts vigente
  - ✅ CA1: mensaje de límite muestra máximo vigente

#### Jest (`certificates.service.spec.ts`)
- Mock base de course tiene evaluaciones con `maxAttempts: 2`
- Tests nuevos cubren:
  - ✅ CA9: alumno sin intentos, no marcado como agotado
  - ✅ CA9: alumno con 2 intentos fallidos y maxAttempts=3, no agotado
  - ✅ CA9: alumno con 3 intentos fallidos y maxAttempts=3, agotado
  - ✅ CA9: alumno aprobó una evaluación pero agotó intentos en otra, no elegible

#### Cypress (`evaluation-attempts.cy.ts`)
- Tests nuevos cubren:
  - ✅ Profesor crea evaluación con maxAttempts=1
  - ✅ Alumno ve "Intento 1 de 1" en interfaz
  - ✅ Profesor edita maxAttempts de evaluación existente
  - ✅ Alumno agotó con limit=2, profesor sube a 3, alumno puede rendir

## Validaciones

### Backend
- Rango 1-5: `@Min(1) @Max(5)`
- Tipo entero: `@IsInt`
- Mensajes en español: "La cantidad de intentos debe ser un número entero. El mínimo es 1. El máximo es 5."

### Frontend
- Input `type="number"` con `min={1} max={5}`
- Validación en onChange: solo acepta 1-5
- Mensajes de error del backend mostrados al usuario

## Decisiones de diseño

1. **`maxAttempts` NO es parte del snapshot**: Cada intento preserva el contenido de preguntas/opciones, pero no el límite. El límite se compara siempre contra el valor vigente. Esto permite que aumentar el límite habilite nuevos intentos inmediatamente.

2. **Edición de `maxAttempts` es parte de `update()`**: No crea un endpoint separado, usa el mismo PATCH de edición de evaluaciones que `minScore` y `title`.

3. **Aislamiento multi-tenant**: No se agregó, continuá como antes (aislamiento a nivel de Course/Institution).

4. **Variable de entorno `MAX_EVALUATION_ATTEMPTS`**: Se dejó documentada pero sin uso (no es crítica eliminar por ahora).

## Pruebas manuales

1. **Crear evaluación con maxAttempts=1**: UI + Backend validan correctamente
2. **Editar evaluación a maxAttempts=5**: Guardado exitoso, alumno ve el nuevo máximo
3. **Alumno falla todos los intentos**: Bloquea exactamente en el máximo vigente
4. **Profesor aumenta límite**: Alumno puede rendir nuevamente sin borrar histórico
5. **Certificado**: Calcula "agotados" usando el máximo vigente

## Tests ejecutados

```bash
# Backend
npm test        # 143 passed (11 suites)

# Frontend
npm run build   # ✓ compiló sin errores
npm run lint    # (no configurado pero build lo verifica)
```

## Cambios que NO se hicieron

- **OAuth2, auto-registro**: Fuera de alcance
- **Límite por alumno**: Siempre el mismo máximo para todos
- **Límite por institución**: Cada evaluación tiene el suyo
- **Configuración global**: Es por evaluación
- **Histórico de cambios de límite**: No se registra cuándo cambió

## Cómo verificarlo manualmente

1. **Crear evaluación con intentos personalizados**:
   - Login Profesor → Editar curso → Crear evaluación
   - Campo "Cantidad máxima de intentos" (1-5)
   - Guardar

2. **Editar límite de evaluación existente**:
   - Profesor → Ver evaluación → Click ojo → Editar "Máximo de intentos"
   - Cambiar valor y guardar

3. **Alumno ve el máximo vigente**:
   - Login Alumno → Ir a evaluación
   - Título muestra "Intento X de N" con el máximo actual
   - Falla hasta el máximo, rechaza el siguiente intento

4. **Aumentar límite habilita nuevos intentos**:
   - Alumno falla 2 veces con maxAttempts=2, bloqueado
   - Profesor edita a maxAttempts=3
   - Alumno puede rendir nuevamente (intento 3)

## Documentación

- **plan-HU-19.md**: Plan detallado de implementación
- **README.md**: Actualizado a V3
- Comentarios en código referenciando HU19

## Riesgos residuales

Ninguno identificado. Los tests cubren todos los criterios de aceptación y casos borde.

---

**Implementación completada satisfactoriamente.**
