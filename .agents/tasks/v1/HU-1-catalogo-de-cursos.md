# Prompt de implementación: HU-1: Catálogo de cursos

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
- **Quiero:** Consultar el catálogo de cursos filtrando por área de conocimiento o tecnología.
- **Para:** Encontrar fácilmente cursos que se ajusten a mis intereses.

### Criterios de aceptación

1. El catálogo muestra por defecto todos los cursos publicados y activos.
2. Es posible filtrar por área de conocimiento y/o por tecnología.
3. Los filtros pueden combinarse, y el resultado respeta todos los criterios seleccionados simultáneamente.
4. Si no hay resultados, se muestra el mensaje “Sin resultados”.
5. Es posible limpiar los filtros aplicados y volver a ver el catálogo completo.

Cada criterio debe tener al menos un test que lo cubra.

## Ubicación en el código y estado actual

- `GET /courses` en `courses.controller.ts` → `CoursesService.catalog(user, query)`; filtros en `courses/dto/catalog-query.dto.ts` (`category`, `technology`).
- La categoría se compara por igualdad sin distinguir mayúsculas y la tecnología con "contiene" (verificalo). Solo cursos con `isPublished = true` de la institución del usuario. `Course` tiene índices por `(institutionId, isPublished)` y `category`.
- Frontend: `pages/CatalogPage.tsx`, ruta `/catalogo` para STUDENT y ADMIN.
- Tests: `courses.service.spec.ts`, `cypress/e2e/catalog-and-enrollment.cy.ts`.
- Alcance verificado en `catalog()`: el ADMIN (alcance global) ve los cursos publicados de **todas** las instituciones; los demás roles solo los de su `institutionId`.

## Decisiones de diseño y reglas de negocio

- El catálogo por defecto devuelve todos los cursos publicados y activos de la institución del usuario, sin filtros.
- Los filtros se combinan con AND. Normalizá espacios sobrantes en los filtros.
- Sin resultados: la API devuelve lista vacía (no 404) y la UI muestra exactamente "Sin resultados".
- "Limpiar filtros" restaura el listado completo sin recargar la página.
- El ADMIN conserva su alcance global (así está implementado); para el resto de los roles el filtro por institución es obligatorio y se toma del JWT.

## Plan de implementación

**Backend**: verificar `catalog()` (publicados, institución, filtros combinados, normalización) y el DTO.
**Frontend**: filtros por área y tecnología, mensaje "Sin resultados", botón de limpiar filtros, tarjetas con datos clave del curso.
**Tests**: Jest con filtros individuales y combinados, sin resultados, curso despublicado excluido, otra institución excluida, mayúsculas/minúsculas; Cypress con filtrar, combinar y limpiar; Postman del endpoint con y sin filtros.

## Casos borde y restricciones

- Cursos despublicados nunca aparecen, aunque coincidan con el filtro.
- `category` y `technology` son strings libres: "Programación" y "programacion" no coinciden por tildes; dejá anotado como mejora, no lo resuelvas aquí.

## Fuera de alcance

Búsqueda por texto libre, orden configurable, paginación y calificaciones (V3).

## Dependencias

Base para HU-2 y HU-4. Depende de HU-5 y HU-8 para los estados de publicación.

## Definition of Done

- Cada criterio de aceptación tiene al menos un test que lo cubra (Jest, Cypress o Postman, según corresponda), y todos pasan.
- `npm test` en `backend/` y `npm run build` y `npm run lint` en `frontend/` pasan sin errores.
- No hay regresiones en las HU relacionadas (ver Dependencias).
- No hay secretos, credenciales ni datos sensibles hardcodeados ni en logs.
- Resumen final: criterios verificados, desvíos corregidos, tests agregados y lo que quedó pendiente.
