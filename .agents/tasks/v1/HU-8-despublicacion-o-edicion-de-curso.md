# Prompt de implementación: HU-8: Despublicación o Edición de Curso

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
- **Quiero:** Despublicar un curso o editar contenido ya existente.
- **Para:** Mantener actualizado y vigente el catálogo de cursos que ofrece la Institución.

### Criterios de aceptación

1. Un Profesor no puede editar cursos que no le pertenecen.
2. Cada sección del contenido del curso dispone de una acción para editarla que al clickear en dicha acción habilitará el modo edición que le permite al Profesor modificar el contenido y guardar los cambios. Los Datos que se pueden editar son las Evaluaciones.
3. Los cambios guardados sobre un curso publicado se reflejan tanto en el catálogo como en su detalle.
4. Al despublicar un curso, deja de estar disponible para nuevas inscripciones.
5. Se puede despublicar un curso con alumnos inscriptos.
6. Los alumnos ya inscriptos en un curso despublicado mantienen el acceso a su contenido, identificado como no disponible en "Mis cursos".
7. La despublicación requiere una confirmación previa para evitar bajas accidentales. El Profesor debe confirmar la acción mediante un Popup con los botones Confirmar y Cancelar.
8. Un curso despublicado puede volver a publicarse y reaparecer en el catálogo con la información vigente.
9. Cada Evaluación dispone de una acción Ver que despliega el detalle de la evaluación y a su vez, cada Pregunta y Respuesta tiene su acción de Editar.
10. Cuando el Profesor clickea en Editar se habilita el modo edición para ingresar texto. Este modo contiene los botones Guardar y Cancelar.

Cada criterio debe tener al menos un test que lo cubra.

## Ubicación en el código y estado actual

- Publicación: `PATCH /courses/:id/publish` y `PATCH /courses/:id/unpublish` → `CoursesService.setPublished()`; propiedad verificada por `getOwnedCourseOrThrow` (403 "No podés modificar un curso que no te pertenece.").
- Despublicación con popup de confirmación (Confirmar/Cancelar) en `pages/CourseEditorPage.tsx` ("Confirmar despublicación del curso").
- Evaluaciones: `GET /evaluations/:evaluationId` (acción "Ver"), `PATCH /evaluations/:id/questions/:questionId` y `PATCH /evaluations/:id/options/:optionId`; UI en `components/EvaluationEditor.tsx` con modo edición, Guardar y Cancelar.
- La edición de los datos del curso (nombre, descripción, etc.) corresponde a HU-14 (V2).
- Tests: `courses.service.spec.ts`, `evaluations.service.spec.ts`, `cypress/e2e/catalog-and-enrollment.cy.ts`.

## Decisiones de diseño y reglas de negocio

- Un Profesor no puede editar ni despublicar cursos ajenos.
- Despublicar es posible con alumnos inscriptos: no se pueden inscribir nuevos, pero los inscriptos conservan el acceso, identificado como "no disponible" en Mis cursos (HU-3).
- La despublicación exige confirmación explícita en un popup con "Confirmar" y "Cancelar"; "Cancelar" no cambia nada.
- Un curso despublicado puede republicarse y reaparece en el catálogo con la información vigente.
- Editar una pregunta o respuesta habilita un modo de edición con texto, Guardar y Cancelar; los cambios guardados se reflejan en el catálogo y el detalle.
- Editar una evaluación no altera los intentos ya rendidos (ver HU-11).

## Plan de implementación

**Backend**: revisar `setPublished` y los endpoints de edición de evaluaciones (propiedad y validaciones de texto no vacío).
**Frontend**: popup de despublicación, republicación, edición inline de preguntas y respuestas con Guardar y Cancelar.
**Tests**: Jest (propietario, ajeno, despublicar con inscriptos, republicar), Cypress del popup (confirmar y cancelar) y de la edición de una pregunta, Postman de publish y unpublish.

## Casos borde y restricciones

- El criterio sobre qué datos son editables menciona solo Evaluaciones porque la edición del resto del curso es HU-14.
- Idempotencia: despublicar un curso ya despublicado no debe fallar ni duplicar efectos.

## Fuera de alcance

Eliminación definitiva de cursos.

## Dependencias

Depende de HU-5, HU-11 y HU-3. Se amplía con HU-14.

## Definition of Done

- Cada criterio de aceptación tiene al menos un test que lo cubra (Jest, Cypress o Postman, según corresponda), y todos pasan.
- `npm test` en `backend/` y `npm run build` y `npm run lint` en `frontend/` pasan sin errores.
- No hay regresiones en las HU relacionadas (ver Dependencias).
- No hay secretos, credenciales ni datos sensibles hardcodeados ni en logs.
- Resumen final: criterios verificados, desvíos corregidos, tests agregados y lo que quedó pendiente.
