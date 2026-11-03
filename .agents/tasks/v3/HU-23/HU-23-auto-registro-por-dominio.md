# Prompt de implementación: HU-23: Auto-registro de Alumnos por dominio institucional

Sos un desarrollador senior full-stack trabajando en el repositorio PECOD. Implementá la historia de usuario descrita abajo de punta a punta (base de datos, backend, frontend y tests), siguiendo las convenciones del repositorio. Si algo de este prompt contradice lo que encontrás en el código, priorizá lo que verifiques en el código, avisalo en tu plan y avanzá con la opción más conservadora.

## Contexto del repositorio

PECOD es una plataforma educativa multi-institucional (multi-tenant) de cursos on-demand. Monorepo con:

- `backend/`: NestJS + Prisma + PostgreSQL. Módulos en `backend/src/<modulo>/` (controller, service, dto, `*.service.spec.ts`). Esquema en `backend/prisma/schema.prisma`, migraciones en `backend/prisma/migrations/`, seed en `backend/prisma/seed.ts`.
- `frontend/`: React + TypeScript + Tailwind (sin librería de componentes). Páginas en `frontend/src/pages/`, componentes en `frontend/src/components/`, cliente HTTP en `frontend/src/api/` (Axios con interceptor JWT en `client.ts`), rutas en `frontend/src/App.tsx` con `routes/ProtectedRoute.tsx`.
- Tests: Jest en backend (`npm test` en `backend/`) usando `createMockPrismaService()` de `backend/src/test-utils/mock-prisma.ts`; Cypress e2e en `frontend/cypress/e2e/` (helpers `cy.seedFullScenario` y `cy.apiLogin` en `frontend/cypress/support/commands.ts`); colección Postman en `postman/PECOD.postman_collection.json`.
- Ya están implementadas las HU-1 a HU-18 (V1 y V2, incluido el certificado en PDF con pdf-lib). El README todavía dice "V1": actualizalo al terminar.

### Convenciones que debés respetar

- Los comentarios del código referencian la HU (por ejemplo `// HU12: ...`) y los mensajes de error y de UI están en español.
- DTOs con `class-validator`/`class-transformer`; las validaciones devuelven mensajes en español.
- Aislamiento por institución: el JWT trae `role` e `institutionId`; todo acceso a datos debe filtrar por la institución del usuario autenticado (salvo el Administrador de Sistema). Nunca tomes `institutionId` de un body o query para usuarios que no sean ADMIN.
- Roles con `@Roles(...)` y `RolesGuard`; endpoints protegidos con `JwtAuthGuard`.
- Para agregar un modelo de Prisma también hay que agregarlo a `createMockPrismaService()` en `mock-prisma.ts`, porque esa lista de modelos es explícita.
- Migraciones nuevas: carpeta con timestamp posterior a `20261025000000_add_certificates`. Deben aplicarse limpias sobre una base vacía y sobre una base con datos existentes.
- Antes de codificar, explorá los archivos indicados y escribí un plan breve en `.agents/tasks/plan-<hu>.md` (secciones: hallazgos de exploración, cambios por capa, riesgos). No pises el `plan.md` existente.

## Historia de usuario

- **Cómo:** Alumno (sin cuenta en la plataforma)
- **Quiero:** Registrarme por mi cuenta usando mi email institucional.
- **Para:** Acceder a los cursos de mi institución sin depender de que un Administrador me dé de alta.

### Criterios de aceptación

1. El Administrador de Sistema puede definir, al dar de alta una institución (HU-9) o editarla posteriormente, uno o más dominios de email permitidos para el auto-registro. Un dominio no puede estar asignado a más de una institución, y una institución sin dominios no habilita el auto-registro.
2. La pantalla de login ofrece la opción “Registrarme”, con los campos nombre, email, contraseña y confirmación de contraseña. Todos son obligatorios; si faltan o son inválidos, el sistema informa los errores y no continúa. La contraseña debe tener al menos 8 caracteres.
3. La institución del Alumno se determina por el dominio de su email. Si el dominio no pertenece a ninguna institución habilitada, el sistema informa “El dominio de tu email no pertenece a una institución habilitada” y no crea la cuenta.
4. Si el email ya está registrado, el sistema informa que ya existe una cuenta con ese email y no crea una nueva.
5. El usuario creado tiene siempre el rol Alumno; no es posible auto-registrarse como Profesor ni como Administrador.
6. Al registrarse, el sistema envía un email con un enlace de verificación de un solo uso y vigencia de 24 horas. La cuenta no puede iniciar sesión hasta verificar el email.
7. Si un usuario con credenciales válidas intenta iniciar sesión sin haber verificado su email, el sistema se lo informa y permite reenviar el enlace de verificación. Ante credenciales inválidas se mantiene el mensaje genérico de HU-10.
8. Una vez verificado el email, el Alumno queda vinculado a su institución y puede acceder al catálogo (HU-1) e inscribirse a cursos (HU-2) de la misma, con las mismas restricciones de aislamiento institucional de HU-10.
9. Se permiten hasta 5 registros por hora por dirección IP; al superarlos, el sistema rechaza la solicitud e informa que debe intentar más tarde.
10. El auto-registro convive con el alta administrativa de HU-9: los usuarios dados de alta por el Administrador de Sistema mantienen su flujo de acceso inicial, y el alta administrativa sigue siendo la única vía para crear Profesores.

Cada criterio debe tener al menos un test que lo cubra.

## Estado actual del código relevante

- Hoy los usuarios solo se crean desde el Administrador de Sistema: `users.service.ts` / `users.controller.ts` y `AdminUsersPage.tsx` (HU-9). No existe `POST /auth/register`.
- `Institution.domain` es el dominio/subdominio único de la **plataforma** (HU-9), no el dominio de email de los usuarios. **No lo reutilices** para este fin.
- `User.email` es único globalmente. `auth.service.ts` valida credenciales y no verifica ningún estado de la cuenta.
- Instituciones: `institutions.service.ts`, `institutions.controller.ts`, `dto/create-institution.dto.ts`, `AdminInstitutionsPage.tsx`. No existe endpoint de edición de institución.

## Decisiones de diseño (ya tomadas)

- **Dominios de email**: modelo nuevo `InstitutionEmailDomain` (`id`, `institutionId`, `domain` con `@unique`, normalizado a minúsculas y sin `@`). Se usa un modelo aparte y no un arreglo para que la unicidad entre instituciones la garantice la base.
- **Configuración**: `CreateInstitutionDto` acepta `emailDomains` opcional, y se agrega `PATCH /institutions/:id/email-domains` (solo ADMIN) para modificarlos. Una institución sin dominios no habilita auto-registro. Validar formato de dominio y rechazar duplicados con mensaje claro. Actualizá `AdminInstitutionsPage` para cargarlos.
- **Verificación de email**: `User.emailVerifiedAt DateTime?`. La migración debe dejar `emailVerifiedAt = now()` para **todos los usuarios existentes**, y los usuarios creados por el Administrador (HU-9) se crean ya verificados. Modelo `EmailVerificationToken` (hash SHA-256, vigencia 24 h, un solo uso).
- **Endpoints**: `POST /auth/register` (nombre, email, contraseña, confirmación), `POST /auth/verify-email` (token), `POST /auth/resend-verification` (email; respuesta genérica). El rol siempre es STUDENT, sin excepción, aunque el body envíe un rol. La contraseña requiere mínimo 8 caracteres.
- **Login**: si las credenciales son válidas pero `emailVerifiedAt` es null, responder 403 con un mensaje específico que permita reenviar la verificación. Con credenciales inválidas se mantiene el mensaje genérico de HU-10.
- **Rate limiting**: 5 registros por hora por IP (reutilizá `ThrottlerModule` de HU-22).
- **Email ya registrado**: informar que ya existe una cuenta con ese email.
- **Efecto sobre HU-9**: el criterio "no existe auto-registro en V1" se exceptúa para Alumnos; el alta administrativa sigue siendo la única vía para Profesores. Documentalo en el README.

## Plan de implementación sugerido

**Base de datos**
1. `InstitutionEmailDomain`, `EmailVerificationToken`, `User.emailVerifiedAt` (con backfill) y migración; modelos en `mock-prisma.ts`.

**Backend**
2. Extender `InstitutionsService`/controller/DTO para dominios de email (alta y edición).
3. `AuthService.register`, `verifyEmail`, `resendVerification`; ajuste de `login` para cuentas sin verificar; email de verificación vía `MailService` con enlace `${FRONTEND_URL}/verify-email?token=...`.
4. Asegurar que `UsersService.create` (alta administrativa) deja `emailVerifiedAt` seteado.

**Frontend**
5. `RegisterPage` (`/register`), `VerifyEmailPage` (`/verify-email`), enlace "Registrarme" en `LoginPage`, y manejo del 403 de cuenta sin verificar con botón "Reenviar verificación". Campo de dominios en `AdminInstitutionsPage`.

**Tests**
6. Jest: dominio habilitado, dominio inexistente, dominio compartido entre instituciones (debe fallar al configurarlo), email duplicado, rol forzado a STUDENT con body malicioso, verificación con token válido/vencido/usado, login sin verificar vs credenciales inválidas, backfill (usuarios previos pueden loguearse), usuarios del Administrador creados verificados, límite de 5 por hora.
7. Cypress: registro completo con verificación, dominio no habilitado, intento de login sin verificar, reenvío.
8. Postman: requests de registro, verificación, reenvío y administración de dominios.

## Casos borde y restricciones

- Un Alumno verificado queda vinculado a la institución dueña del dominio y solo ve datos de esa institución (HU-10).
- Subdominios de email (`alumnos.uade.edu.ar` vs `uade.edu.ar`): definí y documentá si se hace coincidencia exacta (recomendado) o por sufijo.
- No debe poder registrarse nadie con un email de dominio habilitado sin verificar el email: la cuenta no puede iniciar sesión hasta verificar.
- Limpieza de cuentas sin verificar: fuera de alcance, pero dejá un comentario con la idea.

## Fuera de alcance

Registro de Profesores, registro con código de invitación, login con Google/Microsoft (OAuth2), y personalización de la marca por institución.

## Dependencias y orden

Requiere el `MailModule` creado en HU-22. Ver también los cambios de HU-9 mencionados en las decisiones.

## Definition of Done

- `npm test` en `backend/` pasa, con tests nuevos para toda la lógica de negocio agregada (caminos felices, validaciones y accesos no autorizados).
- `npm run build` y `npm run lint` en `frontend/` pasan sin errores.
- Hay un spec de Cypress nuevo (o ampliado) que cubre los criterios de aceptación observables en la UI.
- La colección Postman tiene los requests nuevos o modificados, con tests de status y de cuerpo.
- Las migraciones aplican limpias (`prisma migrate dev` desde cero) y el seed sigue funcionando.
- Los tests de las HU anteriores que tocaste siguen pasando; si un test cambia porque cambia el comportamiento esperado, justificalo en el plan.
- No hay secretos, credenciales ni datos sensibles hardcodeados ni en logs.
- README actualizado (HU implementada, variables de entorno nuevas, cómo probarla).
- Resumen final: qué cambiaste, qué decisiones tomaste, qué quedó fuera y cómo verificarlo manualmente.
