# Prompt de implementación: HU-12: Rendir Evaluaciones

Sos un desarrollador senior full-stack trabajando en el repositorio PECOD. Tu tarea es implementar (o auditar y completar) la historia de usuario descrita abajo de punta a punta: base de datos, backend, frontend y tests, siguiendo las convenciones del repositorio.

## Modo de trabajo

**Esta HU ya está implementada en el repositorio.** No dupliques código ni crees módulos paralelos. Usá este prompt de dos maneras:

1. **Para implementarla desde cero** (por ejemplo en una rama limpia o un proyecto nuevo con la misma arquitectura): seguí las decisiones de diseño y el plan, y respetá los nombres de rutas y modelos indicados.
2. **Para auditarla en el repo actual**: recorré uno por uno los criterios de aceptación contra el código y los tests, listá en tu plan qué criterios están cubiertos, cuáles parcialmente y cuáles no, corregí los desvíos y agregá los tests que falten. No cambies comportamiento que ya cumple un criterio.

Los nombres de archivos y rutas de abajo salen de una lectura del repo; si algo no coincide, priorizá lo que verifiques en el código y avisalo en el plan.

## Contexto del repositorio

PECOD es una plataforma educativa multi-institucional (multi-tenant) de cursos on-demand. Monorepo con:

- `backend/`: NestJS + Prisma + PostgreSQL. Módulos en `backend/src/<modulo>/` (controller, service, dto, `*.service.spec.ts`). Esquema en `backend/prisma/schema.prisma`, migraciones en `backend/prisma/migrations/`, seed en `backend/prisma/seed.ts`.
- `frontend/`: React + TypeScript + Tailwind. Páginas en `frontend/src/pages/`, componentes en `frontend/src/components/`, hooks en `frontend/src/hooks/`, cliente HTTP en `frontend/src/api/` (Axios con interceptor JWT en `client.ts`), contexto de sesión en `frontend/src/context/AuthContext`, rutas en `frontend/src/App.tsx` con `routes/ProtectedRoute.tsx`.
- Tests: Jest en backend (`npm test` en `backend/`) usando `createMockPrismaService()` de `backend/src/test-utils/mock-prisma.ts`; Cypress e2e en `frontend/cypress/e2e/` (helpers `cy.seedFullScenario` y `cy.apiLogin` en `frontend/cypress/support/commands.ts`); colección Postman en `postman/PECOD.postman_collection.json`.
- Archivos en S3 con subida directa desde el navegador mediante URLs prefirmadas (`UploadsService`). El código actual **no** integra Mux aunque el documento de herramientas lo mencione: no lo incorpores salvo que se pida.

### Convenciones que debés respetar

- Los comentarios del código referencian la HU (por ejemplo `// HU12: ...`) y los mensajes de error y de UI están en español.
- DTOs con `class-validator`/`class-transformer`, con mensajes en español.
- Aislamiento por institución: el JWT trae `role` e `institutionId`; todo acceso a datos filtra por la institución del usuario autenticado (salvo el Administrador de Sistema). Nunca tomes `institutionId` de un body o query para usuarios que no sean ADMIN.
- Roles con `@Roles(...)` y `RolesGuard`; endpoints protegidos con `JwtAuthGuard`.
- Si agregás un modelo de Prisma, agregalo también a `createMockPrismaService()`.
- Migraciones: carpeta con timestamp; deben aplicarse limpias sobre una base vacía.
- Antes de codificar, explorá los archivos indicados y escribí un plan breve en `.agents/tasks/plan-<hu>.md` (hallazgos, cambios por capa, riesgos). No pises el `plan.md` existente.

## Historia de usuario

- **Versión:** V1
- **Cómo:** Alumno
- **Quiero:** Rendir las evaluaciones de un curso y visualizar mi resultado y devolución.
- **Para:** Conocer mi nivel de comprensión sobre el contenido cursado y obtener una calificación.

### Criterios de aceptación

1. El Alumno puede acceder y responder una evaluación disponible de un curso en el que está inscripto.
2. Al enviar la evaluación, el sistema calcula automáticamente el puntaje y lo compara con el mínimo de aprobación.
3. El Alumno recibe su calificación junto con una devolución del resultado (correctas/incorrectas o comentarios, según alcance definido).
4. Un Alumno no inscripto no puede acceder a la evaluación del curso.
5. Si la evaluación ya fue aprobada, el sistema informa la restricción correspondiente.
6. El Alumno tiene hasta 2 intentos por evaluación en V1. Si desaprueba ambos intentos, el sistema informa que se alcanzó el límite y no permite un nuevo intento.

Cada criterio debe tener al menos un test que lo cubra.

## Ubicación en el código y estado actual

- Endpoints: `GET /courses/:courseId/evaluations` (PROFESSOR y STUDENT; el Alumno debe estar inscripto), `GET /evaluations/:evaluationId/take` y `POST /evaluations/:evaluationId/submit` (STUDENT, `submit-attempt.dto.ts`: `answers` con `questionId` y `selectedOptionId` UUID, al menos 1).
- `EvaluationsService` (verificado):
  - `assertEnrolled`: 403 "Necesitás estar inscripto en el curso para rendir esta evaluación.".
  - `assertCanAttempt` (se usa tanto en `take` como en `submit`): 400 "Ya aprobaste esta evaluación; no podés volver a rendirla." si algún intento fue aprobado, y 400 "Alcanzaste el límite de 2 intentos para esta evaluación." si ya hay 2 intentos. El límite es la constante `MAX_ATTEMPTS = 2`.
  - `submit`: corrige con el contenido del primer intento si existe (`evaluationSnapshot`) o con el vigente; `score = Math.round(correctas / total * 100)`; `passed = score >= minScore`; guarda el intento con `attemptNumber = intentosPrevios + 1`; responde `{ attempt, score, passed, feedback }` donde cada ítem de `feedback` trae `questionId`, `correct` y **`correctOptionId`**.
  - `take`: devuelve título, mínimo, `attemptsUsed`, `maxAttempts` y las preguntas sin `isCorrect`.
- Frontend `pages/EvaluationPage.tsx` (ruta `/evaluaciones/:evaluationId`): muestra "Intento X de N", deshabilita el botón de enviar hasta responder todas las preguntas y, tras enviar, muestra el puntaje, el mínimo, "Aprobado" o "Desaprobado" y "Correcta" o "Incorrecta" por pregunta. No usa `correctOptionId`.
- Tests: `evaluations.service.spec.ts` y `cypress/e2e/evaluation-attempts.cy.ts`.
- **Desvíos y puntos a resolver (verificalos y corregilos)**:
  1. La API devuelve `correctOptionId` después de **cada** intento, incluso uno desaprobado: quien llame a la API ve las respuestas correctas antes de su segundo intento. El criterio 3 pide "correctas/incorrectas o comentarios, según alcance definido".
  2. El backend acepta envíos incompletos o con ids ajenos (solo exige 1 respuesta); las preguntas sin responder cuentan como incorrectas. La UI exige responder todas.
  3. `attemptNumber` se calcula sin transacción: dos envíos simultáneos chocan con la restricción única `(evaluationId, studentId, attemptNumber)` y el error de Prisma no se traduce (probablemente 500).
  4. El límite de 2 está duplicado: `certificates.service.ts` usa `evalAttempts.length >= 2` por separado de `MAX_ATTEMPTS`.

## Decisiones de diseño y reglas de negocio

- **Criterio 1 y 4**: solo un Alumno inscripto en el curso accede (403 si no). Esto aplica a `take` y a `submit`.
- **Criterios 2 y 3**: el puntaje y la aprobación se calculan siempre en el servidor. Alcance de la devolución definido para esta HU: puntaje, mínimo, aprobado o no, y correcta/incorrecta por pregunta; **no** se revela cuál era la opción correcta. En consecuencia, sacá `correctOptionId` de la respuesta de `submit` (la UI actual no lo usa).
- **Criterio 5**: si ya aprobó, `take` y `submit` responden con el mensaje de restricción y no registran un intento; la UI debe mostrar ese mensaje en lugar de la evaluación.
- **Criterio 6**: hasta 2 intentos por evaluación en V1. Al desaprobar los dos, el sistema informa que se alcanzó el límite y no permite otro. Centralizá el límite en **una sola constante** compartida por `EvaluationsService` y `CertificatesService` (HU-19 la volverá configurable por evaluación).
- Validación del envío: cada `questionId` debe pertenecer a la evaluación (la versión del intento), sin repetidos, y deben venir respondidas todas las preguntas (400 en caso contrario), alineado con la UI.
- Concurrencia: resolvé el cálculo del número de intento dentro de una transacción o capturá el error de unicidad (`P2002`) y respondé 400/409 con el mensaje que corresponda, sin registrar un intento duplicado.
- Aislamiento: la evaluación se obtiene por id; la pertenencia al curso inscripto es la que garantiza el acceso.

## Plan de implementación

**Backend**
1. Quitar `correctOptionId` del `feedback` y ajustar el tipo de retorno.
2. Validar el envío (ids de preguntas válidos, sin repetidos, todas respondidas).
3. Hacer atómico el registro del intento y traducir `P2002`.
4. Unificar la constante del límite de intentos con `CertificatesService`.

**Frontend**
5. `EvaluationPage`: mostrar el mensaje de restricción (ya aprobada o límite alcanzado) en lugar del formulario, mantener "Intento X de N", el botón deshabilitado hasta responder todo y el resultado con "Correcta/Incorrecta".

**Tests**
6. Jest: aprobar en el primer intento; desaprobar y reintentar; agotar 2 intentos (tercer intento rechazado con el mensaje exacto); ya aprobada; no inscripto (403); puntaje en el borde del mínimo (por ejemplo 2 de 3 correctas = 67 con mínimo 67 y con mínimo 68); envío incompleto, con pregunta ajena y con respuestas repetidas; edición de la evaluación entre dos intentos (el segundo se corrige con el contenido del primero); doble envío simultáneo (un solo intento registrado); el `feedback` no contiene `correctOptionId`.
7. Cypress (`evaluation-attempts.cy.ts`): aprobar, desaprobar dos veces y ver el límite, intentar rendir una evaluación aprobada.
8. Postman: `take` y `submit` con los casos de error (403, 400 por aprobada, 400 por límite).

## Casos borde y restricciones

- Evaluación con un puntaje mínimo de 0: se aprueba siempre; verificá que el cálculo y los mensajes sigan siendo coherentes.
- Una evaluación sin preguntas no debería existir (la valida HU-11), pero el cálculo no debe dividir por cero.
- No registres el contenido de las respuestas en logs.

## Fuera de alcance

Límite configurable de intentos (HU-19), temporizador, revisión posterior de respuestas y comentarios por pregunta.

## Dependencias

Depende de HU-11 y HU-2. Alimenta la condición de certificado de HU-18. HU-19 modifica el límite de intentos definido acá.

## Definition of Done

- Cada criterio de aceptación tiene al menos un test que lo cubra (Jest, Cypress o Postman, según corresponda), y todos pasan.
- `npm test` en `backend/` y `npm run build` y `npm run lint` en `frontend/` pasan sin errores.
- No hay regresiones en las HU relacionadas (ver Dependencias).
- No hay secretos, credenciales ni datos sensibles hardcodeados ni en logs.
- Resumen final: criterios verificados, desvíos corregidos, tests agregados y lo que quedó pendiente.
