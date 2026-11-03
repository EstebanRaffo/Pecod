# Prompt de implementación: HU-4: Detalle de curso

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
- **Quiero:** Ver el detalle de un curso que se compone de una descripción sintética, un temario, requerimientos académicos y aptitudes adquiridas.
- **Para:** Decidir con información suficiente si el curso se ajusta a lo que estoy buscando, antes de inscribirme en él.

### Criterios de aceptación

1. El detalle muestra descripción sintética, temario, herramientas necesarias y aptitudes a adquirir.
2. Si algún campo no fue cargado por el Profesor, la sección se muestra vacía o con un valor por defecto, sin errores de visualización.
3. Un Alumno no inscripto puede ver toda la información descriptiva, pero no acceder al contenido de las clases.
4. Un Alumno no inscripto puede ver en el detalle un botón para iniciar la inscripción a un curso.
5. Un Alumno ya inscripto ve una opción para ingresar directamente al contenido, en lugar de la opción de inscripción.

Cada criterio debe tener al menos un test que lo cubra.

## Ubicación en el código y estado actual

- `GET /courses/:id` → `CoursesService.findDetail(id, user)`. Devuelve datos descriptivos y el temario; para no inscriptos anula las URLs de video y archivos, y para inscriptos genera URLs firmadas de S3.
- Frontend: `pages/CourseDetailPage.tsx` (ruta `/cursos/:id`). Muestra el botón de inscripción o, si ya está inscripto, el acceso al contenido.
- **Defectos conocidos a corregir en esta HU** (verificalos primero): (1) `findDetail` no valida que el curso sea de la institución del usuario, contra HU-10; (2) para un Alumno no inscripto sigue devolviendo `contentText` (material de lectura) y la lista de materiales, contra el criterio de que no se accede al contenido de las clases.
- Tests: `courses.service.spec.ts`, `catalog-and-enrollment.cy.ts`.

## Decisiones de diseño y reglas de negocio

- Un Alumno no inscripto ve: descripción sintética, temario (solo títulos y orden), herramientas necesarias (campo `academicRequirements`) y aptitudes (`skills`). No ve videos, grabaciones, materiales ni `contentText`.
- Campos opcionales sin cargar: mostrar vacío o un valor por defecto, nunca un error ni "null"/"undefined".
- El botón de inscripción solo aparece para Alumnos no inscriptos; para inscriptos se muestra "Ingresar al contenido".
- Un usuario de otra institución recibe 403 o 404 (definí uno, aplicalo igual para todos los roles no ADMIN).

## Plan de implementación

**Backend**: agregar validación de institución en `findDetail`; recortar `contentText` y materiales para no inscriptos; mantener URLs firmadas solo para inscriptos y para el Profesor propietario.
**Frontend**: sección de detalle con valores por defecto, botón condicional por estado de inscripción.
**Tests**: Jest para no inscripto (sin contenido), inscripto (con URLs firmadas), otra institución, campos opcionales vacíos, Profesor propietario; Cypress del detalle con y sin inscripción.

## Casos borde y restricciones

- Un curso despublicado puede verse en detalle solo por sus inscriptos y por el Profesor propietario.
- No filtrar datos por la forma de la respuesta: el recorte debe hacerse en el servidor, no ocultarse en la UI.

## Fuera de alcance

Reseñas y calificaciones (HU-20) y precio (HU-26).

## Dependencias

Depende de HU-1 y HU-2. Habilita HU-15. Corrige un incumplimiento de HU-10.

## Definition of Done

- Cada criterio de aceptación tiene al menos un test que lo cubra (Jest, Cypress o Postman, según corresponda), y todos pasan.
- `npm test` en `backend/` y `npm run build` y `npm run lint` en `frontend/` pasan sin errores.
- No hay regresiones en las HU relacionadas (ver Dependencias).
- No hay secretos, credenciales ni datos sensibles hardcodeados ni en logs.
- Resumen final: criterios verificados, desvíos corregidos, tests agregados y lo que quedó pendiente.
