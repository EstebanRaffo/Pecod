# Prompt de implementación: HU-9: Alta de Institución

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
- **Cómo:** Administrador de Sistema
- **Quiero:** Dar de alta manualmente una institución y sus usuarios (Profesores y Alumnos), sin requerir que estos se autoregistren.
- **Para:** Habilitar a una nueva institución para operar dentro de la plataforma, con control centralizado de qué usuarios pueden acceder a ella en esta primera versión.

### Criterios de aceptación

1. Se puede registrar una nueva institución completando los datos obligatorios definidos: nombre, dominio/subdominio único, dirección, teléfono y email de contacto.
2. Los usuarios (Profesores y Alumnos) son dados de alta exclusivamente por el Administrador de Sistema (no existe auto-registro en V1), completando nombre, email y rol (Profesor o Alumno), y quedan vinculados a la institución correspondiente.
3. No se permite dar de alta una institución con datos duplicados (nombre o dominio ya existentes).
4. Si los datos son inválidos o incompletos, el sistema informa los errores correspondientes antes de guardar.
5. Al completarse el alta de un usuario, este recibe el medio de acceso inicial definido (credenciales, invitación, etc.).

Cada criterio debe tener al menos un test que lo cubra.

## Ubicación en el código y estado actual

- `POST /institutions`, `GET /institutions`, `GET /institutions/:id` (rol ADMIN) con `create-institution.dto.ts` (nombre, dominio/subdominio único, dirección, teléfono, email de contacto); duplicados → 409 (`ConflictException`).
- `POST /users` y `GET /users` (rol ADMIN) con `create-user.dto.ts` (nombre, email, rol PROFESSOR o STUDENT, institución); email duplicado → 409 "Ya existe un usuario con ese email."; institución inexistente → 404.
- Medio de acceso inicial (verificado en `users.service.ts`): se genera una contraseña temporal aleatoria, se guarda hasheada con bcrypt y se devuelve **una única vez** en la respuesta de `POST /users` (`temporaryPassword`) para que el Administrador se la entregue al usuario; no hay envío por email.
- Frontend: `pages/AdminInstitutionsPage.tsx` y `pages/AdminUsersPage.tsx` (rutas `/admin/instituciones` y `/admin/usuarios`).
- Tests: `institutions.service.spec.ts`, `users.service.spec.ts`.

## Decisiones de diseño y reglas de negocio

- No existe auto-registro en V1: solo el Administrador de Sistema crea instituciones y usuarios (Profesores y Alumnos), vinculados a una institución.
- Unicidad de nombre y de dominio de la institución, y de email del usuario.
- Datos inválidos o incompletos: se informan los errores antes de guardar.
- Medio de acceso inicial: contraseña temporal generada por el sistema y mostrada una sola vez al Administrador; la UI debe indicarlo claramente y no volver a mostrarla.
- Las contraseñas se guardan siempre hasheadas, nunca en claro ni en logs.

## Plan de implementación

**Backend**: validaciones de DTO, controles de duplicado (nombre, dominio, email), hash de contraseña.
**Frontend**: formularios de alta de institución y de usuario con errores por campo y listados.
**Tests**: Jest de duplicados, datos inválidos, rol no permitido, institución inexistente; acceso de roles no ADMIN (403); Cypress del alta; Postman.

## Casos borde y restricciones

- La comparación de nombre y de dominio duplicado debe ser insensible a mayúsculas y espacios (definí y documentá).
- La respuesta de creación de usuario nunca debe devolver el hash.

## Fuera de alcance

Edición y baja de instituciones o usuarios, autoservicio y envío de credenciales por email (V3).

## Dependencias

Habilita HU-10 (usuarios para loguearse) y todo lo demás.

## Definition of Done

- Cada criterio de aceptación tiene al menos un test que lo cubra (Jest, Cypress o Postman, según corresponda), y todos pasan.
- `npm test` en `backend/` y `npm run build` y `npm run lint` en `frontend/` pasan sin errores.
- No hay regresiones en las HU relacionadas (ver Dependencias).
- No hay secretos, credenciales ni datos sensibles hardcodeados ni en logs.
- Resumen final: criterios verificados, desvíos corregidos, tests agregados y lo que quedó pendiente.
