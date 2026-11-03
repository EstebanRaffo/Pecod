# Prompt de implementación: HU-10: Sesiones por rol de usuario

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
- **Cómo:** Alumno, Profesor o Administrador
- **Quiero:** Autenticarme mediante un login diferenciado según mi rol.
- **Para:** Acceder únicamente a las funcionalidades y datos correspondientes a mi perfil.

### Criterios de aceptación

1. Un usuario con credenciales válidas es redirigido a la vista correspondiente a su rol al iniciar sesión.
2. El login es con email y contraseña propios de la plataforma, con sesión gestionada mediante token (JWT).
3. Ante credenciales inválidas, el acceso se deniega con un mensaje genérico, sin revelar si el usuario existe.
4. Un usuario no puede acceder a funcionalidades o vistas reservadas a otro rol.
5. Al expirar la sesión o cerrar sesión, cualquier intento de acceso a una vista protegida redirige nuevamente al login.
6. Cada usuario visualiza únicamente los datos y cursos de su propia institución, salvo el Administrador de Sistema con alcance global.

Cada criterio debe tener al menos un test que lo cubra.

## Ubicación en el código y estado actual

- `POST /auth/login` (`login.dto.ts`) → `AuthService.login`: mensaje genérico "Email o contraseña incorrectos." para usuario inexistente o contraseña incorrecta; emite un JWT con rol e `institutionId` y vigencia `JWT_EXPIRES_IN` (por defecto 8 h).
- Autorización: `JwtAuthGuard`, `RolesGuard` y el decorador `@Roles`; `jwt.strategy.ts` valida el token.
- Frontend: `context/AuthContext`, `routes/ProtectedRoute.tsx` (redirige a `/login` sin sesión y a `/` si el rol no corresponde), `api/client.ts` (interceptor que ante 401 limpia la sesión y vuelve a `/login`), `pages/LoginPage.tsx` y redirección por rol desde `/`.
- **Puntos a revisar**: `jwt.strategy.ts` cae a un secreto `'dev-secret'` si falta `JWT_SECRET` (debería fallar al iniciar) y no hay límite de intentos de login.
- Tests: `auth.service.spec.ts`, `cypress/e2e/auth.cy.ts`.
- Payload del JWT (verificado en `auth.service.ts`): `sub`, `email`, `role` e `institutionId`.

## Decisiones de diseño y reglas de negocio

- Login con email y contraseña propios, sesión por JWT sin estado.
- Credenciales inválidas: mismo mensaje y mismo status en ambos casos, sin revelar si el usuario existe.
- Cada rol aterriza en su vista: Alumno en catálogo o Mis cursos, Profesor en sus cursos, Administrador en instituciones.
- Autorización siempre en el backend (los guards) y reflejada en la UI; ocultar un botón no es seguridad.
- Aislamiento: cada usuario ve solo datos de su institución, salvo el Administrador de Sistema.
- Cerrar sesión o expirar el token redirige a `/login` ante cualquier vista protegida.

## Plan de implementación

**Backend**: endurecer la estrategia JWT (exigir `JWT_SECRET`), revisar la comparación de contraseñas y el payload del token.
**Frontend**: sesión persistente, redirección por rol, rutas protegidas y manejo de expiración.
**Tests**: Jest (credenciales válidas, usuario inexistente y contraseña incorrecta con mensajes idénticos), tests de guards por rol, Cypress (login por rol, acceso a una vista de otro rol, logout, token vencido), Postman (200, 401, 403).

## Casos borde y restricciones

- No guardar la contraseña ni el token en logs.
- Un token válido de un usuario cuyo rol cambió: definí cuándo se refleja (en V1 recién al reloguear).

## Fuera de alcance

Recuperación de contraseña y auto-registro (V3), OAuth2 y refresh tokens.

## Dependencias

Base de toda la plataforma; depende de HU-9.

## Definition of Done

- Cada criterio de aceptación tiene al menos un test que lo cubra (Jest, Cypress o Postman, según corresponda), y todos pasan.
- `npm test` en `backend/` y `npm run build` y `npm run lint` en `frontend/` pasan sin errores.
- No hay regresiones en las HU relacionadas (ver Dependencias).
- No hay secretos, credenciales ni datos sensibles hardcodeados ni en logs.
- Resumen final: criterios verificados, desvíos corregidos, tests agregados y lo que quedó pendiente.
