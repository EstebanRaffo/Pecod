# Prompt de implementación: HU-15: Consumo de Curso

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
- **Cómo:** Alumno
- **Quiero:** Acceder y reproducir todos los videos del curso y visualizar todo el material adjunto.
- **Para:** Completar la visualización de todas las clases y su material adjunto antes de rendir las evaluaciones.

### Criterios de aceptación

1. El Alumno puede acceder al contenido del curso.
2. El Alumno puede reproducir los videos adjuntos.
3. El Alumno puede abrir el material adicional.
4. El Alumno puede acceder al material de lectura.

Cada criterio debe tener al menos un test que lo cubra.

## Ubicación en el código y estado actual

- Frontend: `pages/CourseLearningPage.tsx` (ruta `/mis-cursos/:id`, solo STUDENT) con reproducción de video y de grabación de pantalla, lista de materiales, material de lectura y evaluaciones por tema.
- Backend: `GET /courses/:id` devuelve URLs firmadas de S3 para los inscriptos (video, grabación y materiales); `EnrollmentsService` verifica inscripción para progreso.
- Tests: `cypress/e2e/progress.cy.ts` y `reading-material.cy.ts` recorren partes de la pantalla.
- Existe además `GET /topics/:topicId` (`TopicsService.getContent`), que devuelve el contenido de un tema con URLs firmadas para quien corresponda; verificá que valide inscripción o propiedad antes de firmar.

## Decisiones de diseño y reglas de negocio

- Solo un Alumno inscripto accede al contenido (también si el curso fue despublicado, según HU-8).
- Los videos se reproducen con el reproductor del navegador usando URLs firmadas con vencimiento; si una URL vence, la pantalla debe poder renovarla recargando.
- Los materiales se abren o descargan con URLs firmadas; el material de lectura se muestra en la misma pantalla.
- Un tema sin contenido muestra un estado vacío claro, no un error.

## Plan de implementación

**Backend**: asegurar que solo inscriptos reciban URLs firmadas y que expiren.
**Frontend**: layout de tema con video, materiales, lectura y evaluaciones; manejo de URL vencida y de errores de reproducción.
**Tests**: Jest (inscripto recibe URLs, no inscripto no), Cypress (reproducir video con stub, abrir material, ver lectura, acceso denegado sin inscripción).

## Casos borde y restricciones

- Cursos con muchos temas: evitar cargar todos los videos a la vez (usar `preload="metadata"`).
- Accesibilidad básica: controles del reproductor accesibles por teclado.

## Fuera de alcance

Reproducción con velocidad adaptativa, subtítulos y descarga de videos.

## Dependencias

Depende de HU-2, HU-4, HU-5, HU-7 y HU-13. Se relaciona con HU-16.

## Definition of Done

- Cada criterio de aceptación tiene al menos un test que lo cubra (Jest, Cypress o Postman, según corresponda), y todos pasan.
- `npm test` en `backend/` y `npm run build` y `npm run lint` en `frontend/` pasan sin errores.
- No hay regresiones en las HU relacionadas (ver Dependencias).
- No hay secretos, credenciales ni datos sensibles hardcodeados ni en logs.
- Resumen final: criterios verificados, desvíos corregidos, tests agregados y lo que quedó pendiente.
