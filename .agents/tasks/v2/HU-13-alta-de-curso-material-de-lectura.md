# Prompt de implementación: HU-13: Alta de Curso. Material de Lectura

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
- **Quiero:** Agregar información adicional como contenido teórico escribiéndolo en una sección de Material de lectura.
- **Para:** Complementar el video de la clase con material de lectura o consulta sin necesidad de adjuntar archivo externo.

### Criterios de aceptación

1. Se puede escribir contenido teórico directamente en la sección “Material de Lectura” y esta queda visible al guardar. El contenido puede ser texto y links relacionados.
2. Los links relacionados se abren en una pestaña nueva.

Cada criterio debe tener al menos un test que lo cubra.

## Ubicación en el código y estado actual

- `Topic.contentText` (texto del material de lectura) se carga y edita con `create-topic.dto.ts` y `update-topic.dto.ts` (`POST /courses/:courseId/topics` y `PATCH /topics/:topicId`).
- Frontend: edición en `pages/CourseEditorPage.tsx` y `components/TopicMediaUploader.tsx`; visualización con el componente de lectura usado en `pages/CourseLearningPage.tsx` (`ReadingMaterial`).
- Tests: `cypress/e2e/reading-material.cy.ts`, `topics.service.spec.ts`.

## Decisiones de diseño y reglas de negocio

- El Profesor escribe el contenido en la sección "Material de Lectura"; queda visible al guardar.
- El contenido admite texto y links; los links se abren en una pestaña nueva (`target="_blank"` con `rel="noopener noreferrer"`).
- Seguridad: renderizar como texto y convertir solo URLs `http`/`https` en enlaces; **no** usar `dangerouslySetInnerHTML` con contenido ingresado.
- Un Alumno no inscripto no accede a este contenido (ver HU-4).

## Plan de implementación

**Backend**: validar longitud razonable de `contentText` y propiedad del curso.
**Frontend**: editor de texto simple, detección de enlaces, componente de lectura seguro.
**Tests**: Jest de guardado y edición; Cypress (`reading-material.cy.ts`): texto con links, apertura en pestaña nueva y un texto con `<script>` mostrado como texto.

## Casos borde y restricciones

- URLs con esquemas peligrosos (`javascript:`) no deben convertirse en enlaces.
- Saltos de línea y párrafos deben conservarse al mostrar.

## Fuera de alcance

Formato enriquecido (negritas, imágenes) y edición colaborativa.

## Dependencias

Depende de HU-5. Se muestra en HU-15 y notifica según HU-17.

## Definition of Done

- Cada criterio de aceptación tiene al menos un test que lo cubra (Jest, Cypress o Postman, según corresponda), y todos pasan.
- `npm test` en `backend/` y `npm run build` y `npm run lint` en `frontend/` pasan sin errores.
- No hay regresiones en las HU relacionadas (ver Dependencias).
- No hay secretos, credenciales ni datos sensibles hardcodeados ni en logs.
- Resumen final: criterios verificados, desvíos corregidos, tests agregados y lo que quedó pendiente.
