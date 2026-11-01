# Prompt de implementación: HU-19: Configuración de intentos en evaluaciones

Sos un desarrollador senior full-stack trabajando en el repositorio PECOD. Implementá la historia de usuario descrita abajo de punta a punta (base de datos, backend, frontend y tests), siguiendo las convenciones del repositorio. Si algo de este prompt contradice lo que encontrás en el código, priorizá lo que verifiques en el código, avisalo en tu plan y avanzá con la opción más conservadora.

## Contexto del repositorio

PECOD es una plataforma educativa multi-institucional (multi-tenant) de cursos on-demand. Monorepo con:

- `backend/`: NestJS + Prisma + PostgreSQL. Módulos en `backend/src/<modulo>/` (controller, service, dto, `*.service.spec.ts`). Esquema en `backend/prisma/schema.prisma`, migraciones en `backend/prisma/migrations/`, seed en `backend/prisma/seed.ts`.
- `frontend/`: React + TypeScript + Tailwind (sin librería de componentes). Páginas en `frontend/src/pages/`, componentes en `frontend/src/components/`, cliente HTTP en `frontend/src/api/` (Axios con interceptor JWT en `client.ts`), rutas en `frontend/src/App.tsx` con `routes/ProtectedRoute.tsx`.
- Tests: Jest en backend (`npm test` en `backend/`) usando `createMockPrismaService()` de `backend/src/test-utils/mock-prisma.ts`; Cypress e2e en `frontend/cypress/e2e/` (helpers `cy.seedFullScenario` y `cy.apiLogin` en `frontend/cypress/support/commands.ts`); colección Postman en `postman/PECOD.postman_collection.json`.
- Ya están implementadas las HU-1 a HU-18 (V1 y V2, incluido el certificado en PDF con pdf-lib). El README todavía dice "V1": actualizalo al terminar.

### Convenciones que debés respetar

- Los comentarios del código referencian la HU (por ejemplo `// HU12: ...`) y los mensajes de error y de UI están en español.
- DTOs con `class-validator`/`class-transformer`; las validaciones devuelven mensajes en español.
- Aislamiento por institución: el JWT trae `role` e `institutionId`; todo acceso a datos debe filtrar por la institución del usuario autenticado (salvo el Administrador de Sistema). Nunca tomes `institutionId` de un body o query para usuarios que no sean ADMIN.
- Roles con `@Roles(...)` y `RolesGuard`; endpoints protegidos con `JwtAuthGuard`.
- Para agregar un modelo de Prisma también hay que agregarlo a `createMockPrismaService()` en `mock-prisma.ts`, porque esa lista de modelos es explícita.
- Migraciones nuevas: carpeta con timestamp posterior a `20261025000000_add_certificates`. Deben aplicarse limpias sobre una base vacía y sobre una base con datos existentes.
- Antes de codificar, explorá los archivos indicados y escribí un plan breve en `.agents/tasks/plan-<hu>.md` (secciones: hallazgos de exploración, cambios por capa, riesgos). No pises el `plan.md` existente.

## Historia de usuario

- **Cómo:** Profesor
- **Quiero:** Definir la cantidad máxima de intentos que tienen los Alumnos para rendir cada evaluación de mis cursos.
- **Para:** Adaptar el nivel de exigencia de cada evaluación al contenido y al grupo de Alumnos.

### Criterios de aceptación

1. El Profesor puede definir la cantidad máxima de intentos de una evaluación al crearla (HU-11) y modificarla luego desde la edición de la evaluación (HU-8). Este valor reemplaza el límite fijo de 2 intentos de HU-12.
2. El valor es un número entero entre 1 y 5. Si no se informa, se aplica 2 por defecto; las evaluaciones ya existentes conservan 2.
3. Un valor vacío, no entero o fuera del rango 1 a 5 se rechaza con un mensaje de validación y no se guarda.
4. Solo el Profesor propietario del curso puede configurar el límite de sus evaluaciones (HU-8).
5. El cambio de límite se aplica de inmediato y no modifica el contenido de la evaluación (preguntas, respuestas ni puntaje mínimo) ni los intentos ya rendidos, sus puntajes o su resultado (HU-11).
6. Si el Profesor aumenta el límite, el Alumno que agotó sus intentos sin aprobar puede volver a rendir hasta alcanzar el nuevo máximo. El Alumno que ya aprobó la evaluación sigue sin poder rendirla nuevamente (HU-12).
7. Si el Profesor reduce el límite y un Alumno ya registró igual o más intentos sin aprobar que el nuevo máximo, no puede rendir nuevamente; sus intentos registrados se conservan.
8. El Alumno ve en la evaluación cuántos intentos usó sobre el máximo vigente (por ejemplo, “Intento 1 de 3”). Al alcanzar el límite, el mensaje de HU-12 informa el máximo vigente.
9. La condición de intentos agotados de HU-18 (certificado de finalización) se evalúa con el límite vigente al momento de la consulta.

Cada criterio debe tener al menos un test que lo cubra.

## Estado actual del código relevante

- `backend/src/evaluations/evaluations.service.ts` define una constante `MAX_ATTEMPTS = 2` y la usa para limitar los intentos al rendir. Las variables de entorno incluyen `MAX_EVALUATION_ATTEMPTS`, pero **no se usa en ningún lado** (configuración muerta).
- `getForTaking` ya devuelve `maxAttempts` al frontend, así que `EvaluationPage.tsx` probablemente ya lo muestra; verificalo.
- El modelo `Evaluation` no tiene columna de límite. Los intentos se guardan en una tabla de intentos con restricción única `(evaluationId, studentId, attemptNumber)` y se conserva una copia del contenido de la evaluación desde el primer intento (migración `preserve_evaluation_attempt_content`).
- `backend/src/certificates/certificates.service.ts` informa "intentos agotados" (HU-18): revisá cómo calcula el límite.
- DTOs: `backend/src/evaluations/dto/create-evaluation.dto.ts` y `update-evaluation.dto.ts`.
- Frontend: `components/EvaluationCreator.tsx`, `components/EvaluationEditor.tsx`, `pages/EvaluationPage.tsx`.
- Test existente que asume 2 intentos: `frontend/cypress/e2e/evaluation-attempts.cy.ts` y `evaluations.service.spec.ts`.

## Decisiones de diseño (ya tomadas)

- Columna nueva `Evaluation.maxAttempts Int @default(2)`. La migración deja todas las evaluaciones existentes en 2.
- Rango válido: entero entre 1 y 5 (`@IsInt @Min(1) @Max(5) @IsOptional`). Si no se informa al crear, queda 2.
- El límite es una política, no contenido: **no** forma parte de la copia del contenido que se conserva por intento. Siempre se compara contra el valor vigente.
- Regla única en el service: un Alumno puede rendir si no aprobó y `intentosRegistrados < maxAttempts` vigente. Aumentar el límite habilita nuevos intentos a quien los agotó; reducirlo nunca borra ni modifica intentos ya registrados.
- Eliminá la constante `MAX_ATTEMPTS` y la variable de entorno `MAX_EVALUATION_ATTEMPTS` (y su mención en `.env.example` y README), o dejá la variable documentada como default si preferís; no debe quedar configuración sin uso.

## Plan de implementación sugerido

**Base de datos**
1. Agregar `maxAttempts` a `Evaluation` y crear la migración.

**Backend**
2. Agregar `maxAttempts` opcional a los DTOs de creación y edición, con mensajes de validación en español.
3. En `EvaluationsService`: guardar el valor al crear y permitir cambiarlo al editar (solo el Profesor propietario del curso, igual que el resto de la edición, HU-8); reemplazar `MAX_ATTEMPTS` por `evaluation.maxAttempts` en `submit`, `getForTaking` y donde se calcule el estado de intentos.
4. Revisar `CertificatesService` para que "intentos agotados" use el límite vigente de cada evaluación.
5. Asegurar que editar `maxAttempts` no toca intentos ya registrados ni el contenido preservado.

**Frontend**
6. Campo numérico "Cantidad máxima de intentos" (1 a 5, default 2) en `EvaluationCreator` y `EvaluationEditor`, con validación y mensaje de error.
7. En `EvaluationPage` mostrar "Intento X de N" con el máximo vigente, y el mensaje de límite alcanzado con ese N.

**Tests**
8. Jest: valores límite (0, 1, 5, 6, no entero, vacío), aumentar el límite con alumno que lo agotó, reducir el límite por debajo de los intentos ya hechos, alumno que ya aprobó, Profesor que no es dueño del curso, certificado con límite modificado.
9. Cypress: adaptar `evaluation-attempts.cy.ts` (hoy asume 2) y agregar un escenario con límite 3 y otro con límite 1.
10. Postman: requests para crear/editar con `maxAttempts` válido e inválido.

## Casos borde y restricciones

- Evaluación sin intentos previos y con intentos previos: ambos casos al cambiar el límite.
- Alumno de otra institución o no inscripto: sigue sin poder rendir (HU-12).
- Profesor ajeno al curso: 403 al intentar cambiar el límite.
- El mensaje de HU-12 "límite alcanzado" debe mostrar el máximo vigente, no un 2 fijo.

## Fuera de alcance

Límite por institución, límites distintos por Alumno, y cualquier cambio en cómo se calcula el puntaje o la aprobación.

## Dependencias y orden

Ninguna. Es la HU más simple de V3; conviene empezar por acá.

## Definition of Done

- `npm test` en `backend/` pasa, con tests nuevos para toda la lógica de negocio agregada (caminos felices, validaciones y accesos no autorizados).
- `npm run build` y `npm run lint` en `frontend/` pasan sin errores.
- Hay un spec de Cypress nuevo (o ampliado) que cubre los criterios de aceptación observables en la UI.
- La colección Postman tiene los requests nuevos o modificados, con tests de status y de cuerpo.
- Las migraciones aplican limpias (`prisma migrate dev` desde cero) y el seed sigue funcionando.
- Los tests de las HU anteriores que tocaste siguen pasando; si un test cambia porque cambia el comportamiento esperado, justificalo en el plan.
- No hay secretos, credenciales ni datos sensibles hardcodeados ni en logs.
- README actualizado (HU implementada, variables de entorno nuevas, cómo probarla).
- Resumen final: qué cambiaste, qué decisiones tomaste, qué quedó fuera y cómo verificarlo manualmente.
