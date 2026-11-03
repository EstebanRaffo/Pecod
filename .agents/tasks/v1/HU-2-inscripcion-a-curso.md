# Prompt de implementación: HU-2: Inscripción a curso

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
- **Quiero:** Inscribirme a un curso elegido.
- **Para:** Poder acceder a su contenido y comenzar a cursarlo.

### Criterios de aceptación

1. El Alumno puede inscribirse a un curso publicado.
2. No se permite la doble inscripción a un mismo curso.
3. No es posible inscribirse a un curso despublicado.
4. Se respetan las reglas de acceso institucional: el Alumno solo puede inscribirse a cursos de su institución.
5. Al confirmarse la inscripción, el sistema muestra una confirmación visual y el curso pasa a estar disponible en el menú “Mis cursos”.

Cada criterio debe tener al menos un test que lo cubra.

## Ubicación en el código y estado actual

- `POST /courses/:courseId/enroll` (rol STUDENT) en `enrollments.controller.ts` → `EnrollmentsService.enroll()`.
- Reglas y mensajes actuales: 404 "Curso no encontrado.", 400 "Este curso no está disponible para inscripción." (despublicado), 400 "Solo podés inscribirte a cursos de tu institución.", 409 "Ya estás inscripto en este curso.".
- `Enrollment` tiene `@@unique([studentId, courseId])`, que evita la doble inscripción a nivel base.
- Frontend: botón de inscripción en `pages/CourseDetailPage.tsx`, confirmación visual y alta en `pages/MyCoursesPage.tsx`.
- Tests: `enrollments.service.spec.ts`, `catalog-and-enrollment.cy.ts`.

## Decisiones de diseño y reglas de negocio

- La inscripción es inmediata y gratuita. Si más adelante se agregan cursos pagos (V3), este método será el punto a bloquear.
- Ante una condición de carrera (doble clic), la restricción única de la base debe traducirse en el mismo 409, no en un 500.
- Tras inscribirse, el curso debe aparecer en "Mis cursos" sin recargar manualmente.

## Plan de implementación

**Backend**: revisar `enroll()` (orden de validaciones y manejo del error de unicidad de Prisma).
**Frontend**: botón, estado de carga (deshabilitar mientras se procesa), mensaje de éxito, mensajes de error, y refresco de la vista.
**Tests**: Jest de cada rama (feliz, no existe, despublicado, otra institución, doble inscripción, doble envío simultáneo); Cypress del flujo; Postman con los cuatro errores.

## Casos borde y restricciones

- Un Profesor o Administrador no puede inscribirse (403 por rol).
- La validación de institución debe usar la institución del JWT.

## Fuera de alcance

Cursos pagos (HU-26), cupos, desinscripción.

## Dependencias

Depende de HU-1 y HU-4 (punto de entrada) y habilita HU-3, HU-15 y HU-16.

## Definition of Done

- Cada criterio de aceptación tiene al menos un test que lo cubra (Jest, Cypress o Postman, según corresponda), y todos pasan.
- `npm test` en `backend/` y `npm run build` y `npm run lint` en `frontend/` pasan sin errores.
- No hay regresiones en las HU relacionadas (ver Dependencias).
- No hay secretos, credenciales ni datos sensibles hardcodeados ni en logs.
- Resumen final: criterios verificados, desvíos corregidos, tests agregados y lo que quedó pendiente.
