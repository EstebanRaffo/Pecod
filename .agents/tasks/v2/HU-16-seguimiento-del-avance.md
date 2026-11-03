# Prompt de implementación: HU-16: Seguimiento del Avance de un curso

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

- **Versión:** V2
- **Cómo:** Alumno.
- **Quiero:** Marcar los temas de un curso como vistos y ver mi porcentaje de avance.
- **Para:** Saber cuánto me falta para terminar el curso.

### Criterios de aceptación

1. En la cursada, cada tema tiene la acción "Marcar como visto"; al marcarlo se identifica como visto y puede desmarcarse.
2. La cursada muestra el avance: temas vistos sobre total y porcentaje, con barra de progreso.
3. Porcentaje = 100 x vistos / total con Math.round. Porcentaje = 0% sin vistos marcados. Curso sin temas: 0%, sin errores.
4. "Mis cursos" muestra el avance de cada curso.
5. El progreso es individual y persistente.
6. Solo un Alumno inscripto puede registrar el progreso y solo ve el propio.
7. Si el Profesor agrega temas, el porcentaje se recalcula; si se elimina un tema, su progreso se elimina (onDelete: Cascade) y se recalcula.
8. Las evaluaciones no cuentan para el porcentaje.

Cada criterio debe tener al menos un test que lo cubra.

## Ubicación en el código y estado actual

- `GET /courses/:courseId/progress`, `PUT|DELETE /courses/:courseId/topics/:topicId/viewed` (STUDENT) en `enrollments.controller.ts`; lógica en `EnrollmentsService.getProgress` y `setTopicViewed`.
- Modelo `TopicProgress` con clave `(enrollmentId, topicId)` y `onDelete: Cascade` en ambas relaciones.
- Frontend: acción "Marcar como visto" en `pages/CourseLearningPage.tsx`, `components/CourseProgressBar.tsx` y avance en `pages/MyCoursesPage.tsx`.
- Tests: `enrollments.service.spec.ts`, `cypress/e2e/progress.cy.ts`.

## Decisiones de diseño y reglas de negocio

- Porcentaje = `Math.round(vistos / totales * 100)`; 0% sin vistos; un curso sin temas da 0% sin error.
- Marcar como visto es reversible (desmarcar).
- El progreso es individual y persistente; solo un Alumno inscripto registra y consulta el suyo (403 si no está inscripto; 404 si el tema no es del curso).
- Si el Profesor agrega temas, el porcentaje se recalcula; si elimina un tema, su progreso se elimina por cascada y se recalcula.
- Las evaluaciones no cuentan para el porcentaje.
- `PUT` y `DELETE` deben ser idempotentes.

## Plan de implementación

**Backend**: revisar el cálculo y los endpoints, y el comportamiento al eliminar temas.
**Frontend**: botón de marcar y desmarcar, barra de progreso con "vistos sobre total" y porcentaje, y avance en Mis cursos.
**Tests**: Jest (0%, 1 de 3 = 33%, 2 de 3 = 67%, 100%, sin temas, curso ajeno, tema ajeno, idempotencia, cascada), Cypress (`progress.cy.ts`).

## Casos borde y restricciones

- Redondeo: 1/3 → 33 y 2/3 → 67; probá también .5 exacto (por ejemplo 1/8).
- Un Alumno nunca ve el progreso de otro.

## Fuera de alcance

Reanudar donde quedó, logros y analíticas para el Profesor (HU-21).

## Dependencias

Depende de HU-2 y HU-15. Alimenta HU-18 y HU-20 y HU-21.

## Definition of Done

- Cada criterio de aceptación tiene al menos un test que lo cubra (Jest, Cypress o Postman, según corresponda), y todos pasan.
- `npm test` en `backend/` y `npm run build` y `npm run lint` en `frontend/` pasan sin errores.
- No hay regresiones en las HU relacionadas (ver Dependencias).
- No hay secretos, credenciales ni datos sensibles hardcodeados ni en logs.
- Resumen final: criterios verificados, desvíos corregidos, tests agregados y lo que quedó pendiente.
