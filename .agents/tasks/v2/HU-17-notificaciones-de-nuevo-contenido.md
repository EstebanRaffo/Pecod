# Prompt de implementación: HU-17: Notificaciones de nuevo contenido

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
- **Quiero:** Recibir notificaciones dentro de la plataforma cuando se publique o actualice contenido del temario del curso en el que estoy inscripto.
- **Para:** Mantenerme informado de novedades y acceder rápidamente al contenido nuevo o modificado.

### Criterios de aceptación

1. Cuando el Profesor crea o modifica contenido dentro del Temario de un curso el Alumno recibe una notificación en su sesión de la plataforma.
2. Las notificaciones se visualizan mediante un icono “campana” en la parte superior derecha en el header en la sesión como Alumno.
3. Al clickear en el ícono se despliega un listado de notificaciones ordenadas de la más reciente a la más antigua.
4. Cada notificación se puede marcar como leída.
5. El ícono tiene color rojo mientras haya notificaciones no leídas.
6. No hay notificaciones para el Alumno si el Profesor elimina contenido del Temario. Tampoco, si modifica datos generales que no son del Temario, como Nombre, Descripción, Área, Tecnología, Requerimientos y Aptitudes.
7. Cada notificación informa los siguientes datos: Nombre del curso, Tipo de evento (contenido nuevo o contenido actualizado), Nombre del tema afectado, Fecha y hora de generación.
8. El Alumno solo puede visualizar notificaciones correspondientes a cursos en los que se encuentra inscripto.

Cada criterio debe tener al menos un test que lo cubra.

## Ubicación en el código y estado actual

- Modelo `Notification` (`studentId`, `courseId`, `topicId?`, `courseName`, `topicTitle`, `event`, `createdAt`, `readAt`) con enum `ContentEvent { NEW_CONTENT, UPDATED_CONTENT }`.
- Endpoints `GET /notifications` y `PATCH /notifications/:id/read` (STUDENT) en `notifications/`.
- Las notificaciones se crean en `TopicsService` dentro de la transacción al crear o modificar contenido del temario (tema, video, grabación, materiales).
- Frontend: `components/NotificationBell.tsx` (ícono campana en el header solo para STUDENT, `data-testid="notification-bell"`) y `api/notifications.ts`.
- Tests: `notifications.service.spec.ts`, `topics.service.spec.ts`, `cypress/e2e/notifications.cy.ts`.
- Puntos de disparo verificados en `TopicsService`: `createTopic` (NEW_CONTENT), `updateTopic` (NEW_CONTENT o UPDATED_CONTENT), `attachVideo` y `attachScreenRecording` (NEW_CONTENT si el tema no tenía ese contenido, UPDATED_CONTENT si ya lo tenía) y `addMaterial` (NEW_CONTENT). `deleteVideo`, `deleteScreenRecording` y `deleteMaterial` **no** notifican, tal como pide el criterio.

## Decisiones de diseño y reglas de negocio

- Se notifica a los Alumnos inscriptos cuando el Profesor crea o modifica contenido del temario; **no** al eliminar contenido ni al editar datos generales del curso.
- Cada notificación informa: nombre del curso, tipo de evento (contenido nuevo o actualizado), nombre del tema y fecha y hora.
- El listado se ordena de la más reciente a la más antigua y cada notificación se marca como leída; el ícono está en rojo mientras haya no leídas.
- Un Alumno solo ve notificaciones de sus cursos y las suyas.
- La creación de notificaciones no debe romper la operación principal: si falla, la transacción debe resolverse de forma consistente (definí y documentá).

## Plan de implementación

**Backend**: revisar los puntos de disparo en `TopicsService` y la consulta paginada o acotada del listado.
**Frontend**: campana con desplegable, estado de carga, marcar como leída y contador o color.
**Tests**: Jest (cada acción que notifica, eliminar no notifica, datos generales no notifican, solo inscriptos, marcar leída ajena → 403), Cypress (`notifications.cy.ts`).

## Casos borde y restricciones

- Muchas ediciones seguidas generan muchas notificaciones: se acepta en V2, pero dejalo documentado como mejora.
- Un curso con muchos inscriptos: crear las notificaciones en lote (`createMany`).

## Fuera de alcance

Emails o push, preferencias de notificación y agrupación de eventos.

## Dependencias

Depende de HU-5, HU-7, HU-13 y HU-14 (disparadores) y de HU-2. Se amplía en HU-24.

## Definition of Done

- Cada criterio de aceptación tiene al menos un test que lo cubra (Jest, Cypress o Postman, según corresponda), y todos pasan.
- `npm test` en `backend/` y `npm run build` y `npm run lint` en `frontend/` pasan sin errores.
- No hay regresiones en las HU relacionadas (ver Dependencias).
- No hay secretos, credenciales ni datos sensibles hardcodeados ni en logs.
- Resumen final: criterios verificados, desvíos corregidos, tests agregados y lo que quedó pendiente.
