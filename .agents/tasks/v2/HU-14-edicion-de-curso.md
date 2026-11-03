# Prompt de implementación: HU-14: Edición de Curso

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
- **Cómo:** Profesor
- **Quiero:** Editar todo el contenido ya existente.
- **Para:** Mantener actualizado y vigente el catálogo de cursos que ofrece la Institución.

### Criterios de aceptación

1. Cada sección del contenido del curso dispone de una acción para editar que al clickear en dicha acción habilitará el modo edición que le permite al Profesor modificar el contenido y guardar los cambios. Los datos que se pueden editar son: Nombre, Descripción, Área, Tecnología, Requerimientos académicos y Aptitudes Adquiridas y el contenido del Temario.

Cada criterio debe tener al menos un test que lo cubra.

## Ubicación en el código y estado actual

- `PATCH /courses/:id` (PROFESSOR, `update-course.dto.ts`) → `CoursesService.update` con verificación de propiedad; temas con `PATCH /topics/:topicId` (`update-topic.dto.ts`).
- Frontend: modo edición por sección en `pages/CourseEditorPage.tsx`.
- Tests: `courses.service.spec.ts`, `topics.service.spec.ts`.

## Decisiones de diseño y reglas de negocio

- Cada sección tiene una acción "Editar" que habilita el modo edición con Guardar y Cancelar (Cancelar descarta los cambios).
- Datos editables: nombre, descripción, área, tecnología, requerimientos académicos, aptitudes adquiridas y el contenido del temario.
- Aplican las mismas validaciones de obligatoriedad que en el alta (HU-5).
- Los cambios se reflejan en el catálogo y en el detalle.
- Los cambios del temario notifican a los Alumnos inscriptos (HU-17); los cambios en datos generales **no**.
- Un Profesor no edita cursos ajenos.

## Plan de implementación

**Backend**: revisar `update` (campos permitidos, validación parcial, propiedad).
**Frontend**: edición por sección con estados de carga y error.
**Tests**: Jest (cada campo, vacíos no permitidos, curso ajeno, actualización parcial), Cypress de edición y verificación en catálogo/detalle, y que editar datos generales no genere notificaciones.

## Casos borde y restricciones

- Edición concurrente de dos pestañas: última escritura gana; documentalo.
- Cambiar categoría o tecnología cambia en qué filtros del catálogo aparece el curso.

## Fuera de alcance

Historial de versiones del curso y precio (HU-26).

## Dependencias

Depende de HU-5 y HU-8. Interactúa con HU-17.

## Definition of Done

- Cada criterio de aceptación tiene al menos un test que lo cubra (Jest, Cypress o Postman, según corresponda), y todos pasan.
- `npm test` en `backend/` y `npm run build` y `npm run lint` en `frontend/` pasan sin errores.
- No hay regresiones en las HU relacionadas (ver Dependencias).
- No hay secretos, credenciales ni datos sensibles hardcodeados ni en logs.
- Resumen final: criterios verificados, desvíos corregidos, tests agregados y lo que quedó pendiente.
