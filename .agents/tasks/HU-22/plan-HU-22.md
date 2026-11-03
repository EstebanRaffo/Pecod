# Plan de Implementación: HU-22 Recuperación de Contraseña

## Hallazgos de Exploración

- **Auth actual**: `AuthService` valida credenciales con `bcrypt`, `JwtStrategy` usa fallback `'dev-secret'` (debe eliminarse).
- **Hash de contraseña**: Usa `bcrypt` en `UsersService` y `AuthService`.
- **Schema Prisma**: Modelo `User` tiene `id`, `email`, `passwordHash`, `role`, `institutionId`, `createdAt`, `updatedAt`. Falta `passwordChangedAt`.
- **Rate limiting**: No existe `@nestjs/throttler`.
- **Mail**: No existe `MailModule` ni servicio de email.
- **Frontend**: `LoginPage` existe en `frontend/src/pages/LoginPage.tsx`; no hay rutas de recuperación ni componentes de reset.
- **Docker**: `docker-compose.yml` tiene Postgres; necesita Mailpit para desarrollo.

## Cambios por Capa

### Base de Datos
1. **Migración nueva**: Agregar `passwordChangedAt DateTime?` a `User` e introducir modelo `PasswordResetToken`.
   - Campos: `id` (UUID PK), `userId` (FK), `tokenHash` (string, indexed), `expiresAt` (DateTime), `usedAt` (DateTime?), `createdAt` (DateTime).
2. **mock-prisma.ts**: Agregar `PasswordResetToken` a la lista de modelos.

### Backend
3. **MailModule** (`backend/src/mail/`):
   - `mail.module.ts`, `mail.service.ts`, `mail.service.spec.ts`.
   - Abstracta (interfaz) para permitir SES/SendGrid luego.
   - SMTP por defecto con `nodemailer` (variables: `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM`).
   - Plantilla HTML/texto simple para email de reset en español.
   - Método `sendPasswordResetEmail(email, resetLink, userName)`.

4. **Auth adjustments**:
   - `jwt.strategy.ts`: Eliminar fallback `'dev-secret'`; fallar al arrancar si `JWT_SECRET` no definido.
   - `jwt.strategy.ts`: Validar `passwordChangedAt` en payload; rechazar tokens si `iat < passwordChangedAt`.
   - `auth.module.ts`: Importar `ThrottlerModule`, aplicar a endpoints de `forgot-password`.

5. **Password Reset endpoints** (nuevo en `auth.controller.ts`):
   - `POST /auth/forgot-password` (body: `email`): Genera token, lo envía vía mail, responde genérico siempre. Rate limit: 5 por hora por IP + 5 por hora por email.
   - `POST /auth/reset-password` (body: `token`, `password`, `confirmPassword`): Valida token (no vencido, no usado), contraseña (≥8 chars, coincide), actualiza `passwordHash` y `passwordChangedAt`. Invalida token.

6. **AuthService**: Método `generatePasswordResetToken(userId)` y `resetPassword(tokenHash, password)`.

7. **Roles**: Endpoints disponibles para `ADMIN`, `PROFESSOR`, `STUDENT` (sin guard obligatorio, públicos tras aceptar email).

### Frontend
8. **LoginPage**: Agregar enlace "¿Olvidaste tu contraseña?" que navega a `/forgot-password`.

9. **Pages nuevas**:
   - `ForgotPasswordPage` (`/forgot-password`): Form con email, validación, envío. Mensaje genérico al enviar.
   - `ResetPasswordPage` (`/reset-password?token=...`): Valida token en URL, form password + confirm, validaciones (≥8 chars, coincide), submit, redirige a login con toast.

10. **Rutas**: Agregar a `App.tsx` como públicas (sin `ProtectedRoute`).

### Tests
11. **Jest** (`backend/src/auth/auth.service.spec.ts`):
    - Respuesta idéntica para email existente e inexistente.
    - Token válido, vencido, usado, inválido.
    - Nueva solicitud invalida anterior.
    - Contraseña corta (<8) rechazada.
    - Contraseñas no coincidentes rechazadas.
    - Tokens JWT previos rechazados tras reset.
    - Rate limit 5/hora por IP.
    - Rate limit 5/hora por email.

12. **Cypress e2e** (`frontend/cypress/e2e/`):
    - Flujo completo: login con "Olvidé", ingresar email, recibir link, resetear, login con nueva contraseña.
    - Token vencido/inválido: intenta reset, error, opción para solicitar nuevo.

## Riesgos y Consideraciones

1. **Backward compatibility**: `passwordChangedAt` es nullable; usuarios existentes quedan NULL.
2. **JWT validation perf**: `JwtStrategy.validate` ahora consulta BD (select userId, passwordChangedAt). Considerar caché si es crítico.
3. **Rate limit**: `ThrottlerModule` puede requerir Redis en producción. Dev puede usar en memoria.
4. **Email**: En desarrollo usa Mailpit (mock SMTP), en prod requiere vars de entorno reales (AWS SES, SendGrid, etc.).
5. **Timing attacks**: No es prioritario para V2 educativa, pero respuesta genérica ayuda.
6. **Async email**: Envío sin esperar respuesta (fire-and-forget) para evitar timing leaks y mejorar UX.

## Orden de Ejecución
1. Migración Prisma + schema.
2. MailModule + test.
3. Auth fixes (jwt.strategy, JwtSecret validation).
4. Password reset endpoints + service.
5. ThrottlerModule config.
6. Frontend pages + rutas.
7. Tests Jest + Cypress.
8. Verificación e2e + README.
