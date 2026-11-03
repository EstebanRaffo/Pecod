# Prompt de implementación: HU-3: Mis cursos

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
- **Quiero:** Ver en el menú "Mis cursos" los cursos en los que estoy inscripto.
- **Para:** Acceder a mis cursos activos sin tener que buscarlos en el catálogo.

### Criterios de aceptación

1. Se listan únicamente los cursos en los que el Alumno está inscripto.
2. Si no tiene inscripciones, se muestra el mensaje “Sin cursos en progreso”, con acceso directo al catálogo.
3. Al seleccionar un curso desde esta vista, se accede directamente a su contenido.
4. Si un curso fue despublicado luego de la inscripción, se identifica visualmente como no disponible, sin desaparecer del menú “Mis cursos” del Alumno.

Cada criterio debe tener al menos un test que lo cubra.

## Ubicación en el código y estado actual

- `GET /enrollments/my-courses` → `EnrollmentsService.myCourses()` (rol STUDENT). Hoy también devuelve datos de V2: avance (HU-16) y si el curso está finalizado con certificado (HU-18).
- Frontend: `pages/MyCoursesPage.tsx` (ruta `/mis-cursos`; mensaje "Sin cursos en progreso.") y `CourseProgressBar`.
- Al seleccionar un curso se navega a `/mis-cursos/:id` (`CourseLearningPage`).
- Tests: `enrollments.service.spec.ts`, `catalog-and-enrollment.cy.ts`.

## Decisiones de diseño y reglas de negocio

- Solo se listan los cursos del Alumno autenticado. El `studentId` sale siempre del JWT.
- Un curso despublicado luego de la inscripción **no desaparece**: se muestra identificado como "no disponible" visualmente, y el Alumno mantiene el acceso al contenido (HU-8).
- Sin inscripciones: mensaje con acceso directo al catálogo.
- Esta HU debe seguir funcionando sin depender de las columnas de V2: si implementás solo V1, el avance y el certificado son opcionales.

## Plan de implementación

**Backend**: revisar `myCourses()` (filtro por alumno, incluye despublicados, no incluye datos de otros).
**Frontend**: listado, estado vacío con enlace al catálogo, distintivo de "no disponible", navegación al contenido.
**Tests**: Jest (sin inscripciones, con inscripciones, curso despublicado después de inscribirse, aislamiento entre alumnos); Cypress del estado vacío y del curso no disponible.

## Casos borde y restricciones

- La consulta no debe hacer una consulta por curso (evitá N+1 al calcular progreso).
- Un curso no disponible sigue siendo clickeable para su contenido.

## Fuera de alcance

Ordenamientos, filtros y búsqueda dentro de Mis cursos.

## Dependencias

Depende de HU-2. Se relaciona con HU-8 (despublicación), HU-16 y HU-18.

## Definition of Done

- Cada criterio de aceptación tiene al menos un test que lo cubra (Jest, Cypress o Postman, según corresponda), y todos pasan.
- `npm test` en `backend/` y `npm run build` y `npm run lint` en `frontend/` pasan sin errores.
- No hay regresiones en las HU relacionadas (ver Dependencias).
- No hay secretos, credenciales ni datos sensibles hardcodeados ni en logs.
- Resumen final: criterios verificados, desvíos corregidos, tests agregados y lo que quedó pendiente.
