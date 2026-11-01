# Prompt de implementación: HU-22: Recuperación de contraseña

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

- **Cómo:** Alumno, Profesor o Administrador
- **Quiero:** Restablecer mi contraseña cuando la olvidé.
- **Para:** Recuperar el acceso a mi cuenta sin depender de un Administrador.

### Criterios de aceptación

1. La pantalla de login ofrece la opción “¿Olvidaste tu contraseña?”, que permite ingresar el email de la cuenta.
2. Exista o no el email en la plataforma, el sistema responde siempre con el mismo mensaje genérico, sin revelar si el usuario existe (HU-10).
3. Si el email corresponde a un usuario, el sistema le envía un enlace de restablecimiento de un solo uso, con vigencia de 60 minutos. Una nueva solicitud invalida el enlace anterior.
4. El enlace lleva a un formulario donde se ingresa la nueva contraseña y su confirmación. La contraseña debe tener al menos 8 caracteres y ambos campos deben coincidir; de lo contrario se informa el error y no se guarda.
5. Un enlace vencido, ya utilizado o inválido se rechaza con un mensaje y permite solicitar uno nuevo.
6. Al restablecer la contraseña, el enlace queda invalidado, las sesiones (tokens JWT) emitidas antes del cambio dejan de ser válidas y el usuario es redirigido al login con una confirmación.
7. Se permiten hasta 5 solicitudes de restablecimiento por hora por email o dirección IP; al superarlas, el sistema rechaza la solicitud e informa que debe intentar más tarde.
8. La recuperación está disponible para los tres roles: Alumno, Profesor y Administrador de Sistema.

Cada criterio debe tener al menos un test que lo cubra.

## Estado actual del código relevante

- No existe ningún servicio de envío de email ni endpoints de recuperación o cambio de contraseña. Los Alumnos y Profesores dados de alta por el Administrador (HU-9) reciben una contraseña inicial y no hay forma de cambiarla.
- `backend/src/auth/auth.service.ts` valida credenciales y emite el JWT; `jwt.strategy.ts` **no consulta la base** en `validate` (confía en los claims) y cae a un secreto `'dev-secret'` si falta `JWT_SECRET`.
- No hay rate limiting (`@nestjs/throttler` no está en las dependencias).
- `docker-compose.yml` tiene Postgres (y Redis comentado). `frontend/src/pages/LoginPage.tsx` es el login; el interceptor de `api/client.ts` redirige a `/login` ante un 401.
- Verificá qué librería de hash de contraseñas usa `users.service.ts` y reutilizala.

## Decisiones de diseño (ya tomadas)

- **MailModule** nuevo en `backend/src/mail/` con un `MailService` que abstrae el proveedor. Implementación por defecto con SMTP (`nodemailer`), configurable por variables de entorno (`MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM`) y `FRONTEND_URL` para armar enlaces. Agregá un contenedor Mailpit al `docker-compose.yml` para desarrollo. La interfaz debe permitir cambiar luego a AWS SES o SendGrid sin tocar los consumidores.
- **Token de restablecimiento**: modelo `PasswordResetToken` (`id`, `userId`, `tokenHash`, `expiresAt`, `usedAt`, `createdAt`). Generá el token con `crypto.randomBytes(32)` y guardá solo su hash SHA-256. Vigencia 60 minutos, un solo uso. Una nueva solicitud invalida los tokens anteriores del usuario.
- **Respuesta genérica**: `POST /auth/forgot-password` responde siempre lo mismo (mismo status y mensaje) exista o no el email, y no debe filtrar por tiempos de respuesta de forma evidente (hacé el envío de forma asíncrona, sin esperar).
- **Invalidar sesiones**: agregá `User.passwordChangedAt DateTime?`. `JwtStrategy.validate` debe rechazar tokens cuyo `iat` sea anterior a `passwordChangedAt`; eso implica una consulta a la base por request (`select` mínimo). Actualizá los tests de auth en consecuencia.
- **Política de contraseña**: mínimo 8 caracteres y confirmación coincidente.
- **Rate limiting**: `@nestjs/throttler`, 5 solicitudes por hora por IP en `forgot-password`, y además contá por email consultando los tokens creados en la última hora. Al superarlo: 429 con mensaje claro.
- **Arreglo previo en el mismo módulo**: `jwt.strategy.ts` debe fallar al arrancar si `JWT_SECRET` no está definido (eliminar el fallback `'dev-secret'`).

## Plan de implementación sugerido

**Base de datos**
1. `PasswordResetToken`, `User.passwordChangedAt` y migración; agregar el modelo a `mock-prisma.ts`.

**Backend**
2. `MailModule`/`MailService` (con plantilla de texto/HTML simple en español para el email de restablecimiento) y Mailpit en `docker-compose.yml`.
3. `POST /auth/forgot-password` y `POST /auth/reset-password` (body: `token`, `password`, `confirmPassword`). Errores de token vencido, usado o inválido con mensaje que invite a pedir uno nuevo.
4. Ajustes en `JwtStrategy` (validar `passwordChangedAt`, exigir `JWT_SECRET`) y configuración de `ThrottlerModule`.
5. Disponible para los tres roles (Alumno, Profesor, Administrador de Sistema).

**Frontend**
6. En `LoginPage`, enlace "¿Olvidaste tu contraseña?". Páginas públicas `ForgotPasswordPage` (`/forgot-password`) y `ResetPasswordPage` (`/reset-password?token=...`), con validación de longitud y coincidencia, y redirección al login con confirmación al terminar. Agregar las rutas públicas en `App.tsx`.

**Tests**
7. Jest: respuesta idéntica para email existente e inexistente; token válido, vencido, usado e inválido; solicitud nueva invalida la anterior; contraseña corta o que no coincide; tokens JWT anteriores rechazados tras el cambio; límite de 5 por hora; los tres roles; `MailService` mockeado (verificar que el email contiene el enlace correcto y que no se guarda el token en claro).
8. Cypress: flujo completo leyendo el enlace desde un stub o desde la API de Mailpit; enlace vencido; contraseñas distintas.
9. Postman: requests de ambos endpoints, incluyendo 429.

## Casos borde y restricciones

- Nunca loguear el token en claro ni la contraseña.
- El token viaja en la URL: usá `Referrer-Policy: no-referrer` o equivalente en la página de restablecimiento si es viable.
- Un usuario que cambia su contraseña con una sesión abierta en otro navegador debe ser deslogueado en esa otra sesión (por 401 en la siguiente request).

## Fuera de alcance

Cambio de contraseña estando logueado, política de complejidad avanzada, doble factor, y envío de otros emails (los consume HU-23).

## Dependencias y orden

Crea el servicio de email que luego reutiliza HU-23, así que va antes. Independiente de las HU-19 a HU-21.

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
