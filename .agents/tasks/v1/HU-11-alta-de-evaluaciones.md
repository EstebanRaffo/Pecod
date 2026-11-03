# Prompt de implementación: HU-11: Alta de Evaluaciones

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
- **Cómo:** Profesor
- **Quiero:** Crear evaluaciones asociadas a un tema o al cierre del curso, definiendo preguntas, respuestas correctas y puntaje mínimo de aprobación.
- **Para:** Poder medir si el alumno comprendió el contenido dictado y determinar su calificación.

### Criterios de aceptación

1. Una evaluación puede crearse asociada a un tema específico o al cierre del curso, con preguntas, respuestas correctas y puntaje mínimo de aprobación.
2. No se permite guardar una evaluación sin al menos una pregunta o sin puntaje mínimo definido.
3. El tipo de pregunta es de “opción múltiple”, con una sola respuesta correcta por pregunta.
4. Editar una evaluación ya publicada no afecta los resultados de intentos ya rendidos por Alumnos.
5. El puntaje mínimo definido se usa automáticamente para determinar si un Alumno aprueba o no.
6. Si una evaluación ya tiene intentos registrados, su eliminación requiere confirmación adicional o queda restringida, para preservar la trazabilidad.

Cada criterio debe tener al menos un test que lo cubra.

## Ubicación en el código y estado actual

- `POST /courses/:courseId/evaluations` (PROFESSOR) con `create-evaluation.dto.ts`; `PATCH /evaluations/:evaluationId` (solo `title` y `minScore`); `PATCH /evaluations/:id/questions/:questionId` y `.../options/:optionId` (solo cambian el texto); `GET /evaluations/:id` para edición (valida propiedad); `GET /courses/:courseId/evaluations` (lista sin respuestas correctas). Modelos `Evaluation`, `Question`, `QuestionOption`, `EvaluationAttempt`.
- Validaciones actuales: título obligatorio; `minScore` entero entre 0 y 100; al menos 1 pregunta (`ArrayMinSize(1)`); cada pregunta con texto y al menos 2 opciones (`ArrayMinSize(2)`); en el service, **exactamente una** opción correcta por pregunta (400 con el texto de la pregunta); el profesor debe ser dueño del curso (403).
- El contenido de la evaluación se conserva por intento en `EvaluationAttempt.evaluationSnapshot` (el del primer intento rige para los siguientes), así que editar no altera intentos ya rendidos.
- No existe endpoint de eliminación de evaluaciones: el criterio de eliminación se cumple por restricción.
- **Desvíos detectados (verificalos y corregilos)**: (1) `create()` guarda `topicId` sin comprobar que el tema pertenezca al curso; (2) `listByCourse()` solo valida inscripción para el Alumno: para un PROFESSOR no valida propiedad ni institución, así que cualquier Profesor podría listar las evaluaciones (títulos y puntaje mínimo) de cursos ajenos.
- Frontend: `components/EvaluationCreator.tsx`. Tests: `evaluations.service.spec.ts`.

## Decisiones de diseño y reglas de negocio

- Una evaluación se asocia a un tema (`topicId`) o al cierre del curso (`topicId` nulo).
- Validaciones (ya implementadas): al menos una pregunta, puntaje mínimo definido (0 a 100), opción múltiple con **una sola** respuesta correcta y al menos 2 opciones por pregunta.
- Cierre de los desvíos: validar que `topicId` pertenezca al curso (400 si no) y restringir `listByCourse` para el Profesor al dueño del curso.
- Editar una evaluación publicada no modifica resultados ni contenido de intentos ya rendidos.
- El puntaje mínimo decide automáticamente aprobado o no (HU-12).
- Si se implementa la eliminación, debe bloquearse o exigir confirmación adicional cuando hay intentos registrados.
- Solo el Profesor propietario del curso crea y edita.

## Plan de implementación

**Backend**: validaciones de DTO anidado, creación transaccional, guardado del snapshot en el primer intento.
**Frontend**: creador de evaluaciones con alta dinámica de preguntas y opciones, marcado de la correcta y errores por campo.
**Tests**: Jest (sin preguntas, sin puntaje, cero o dos correctas, una sola opción, puntaje 0, 100 y 101), edición posterior con intentos previos, Profesor ajeno; Cypress del alta; Postman.

## Casos borde y restricciones

- Tema que no pertenece al curso: rechazar (hoy no se valida).
- Textos vacíos o solo espacios en preguntas y opciones: el DTO usa `@IsNotEmpty`, que no rechaza un texto de solo espacios; evaluá si corresponde `trim`.
- Un Profesor ajeno no debe poder listar ni ver evaluaciones de otro curso.

## Fuera de alcance

Otros tipos de pregunta, banco de preguntas, aleatorización y límite de tiempo.

## Dependencias

Depende de HU-5 (cursos y temas). Habilita HU-12 y la condición de certificado de HU-18. Su límite de intentos pasa a ser configurable en HU-19.

## Definition of Done

- Cada criterio de aceptación tiene al menos un test que lo cubra (Jest, Cypress o Postman, según corresponda), y todos pasan.
- `npm test` en `backend/` y `npm run build` y `npm run lint` en `frontend/` pasan sin errores.
- No hay regresiones en las HU relacionadas (ver Dependencias).
- No hay secretos, credenciales ni datos sensibles hardcodeados ni en logs.
- Resumen final: criterios verificados, desvíos corregidos, tests agregados y lo que quedó pendiente.
