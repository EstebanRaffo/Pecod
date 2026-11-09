# Plan de Implementación: HU-23 Auto-registro por Dominio Institucional

## Hallazgos de Exploración

### Código Existente
- **Modelos**: `User` tiene `institutionId`, `role`, `email` (único global). No existe `emailVerifiedAt` ni `InstitutionEmailDomain`.
- **Auth**: `AuthService.login()` no verifica verificación de email. No existe `POST /auth/register`.
- **Instituciones**: `InstitutionsService.create()` solo crea institución. No hay endpoint de edición de dominios.
- **Mail**: `MailService` existe con transporter configurado (HU-22). Métodos para reset de contraseña.
- **Users**: `UsersService.create()` (HU-9) genera contraseña temporal. No contempla auto-registro verificado.
- **Rate Limiting**: `ThrottlerModule` ya usado en `POST /auth/forgot-password` (5/hora).
- **Mock Prisma**: Lista explícita de modelos en `createMockPrismaService()` (necesita agregar).

## Cambios por Capa

### 1. Base de Datos (Prisma)
- **Migración nueva**: `User.emailVerifiedAt` (DateTime?), backfill para usuarios existentes con now().
- **Nuevo modelo**: `InstitutionEmailDomain` (id, institutionId, domain @unique lowercase, timestamps).
- **Nuevo modelo**: `EmailVerificationToken` (id, userId, tokenHash @unique, expiresAt, usedAt, timestamps).
- Actualizar `mock-prisma.ts` con los 2 modelos nuevos.

### 2. Backend - Instituciones
- Extender `CreateInstitutionDto`: agregar `emailDomains?: string[]` (validar formato, lowercase).
- Nuevo `PATCH /institutions/:id/email-domains` (solo ADMIN): validar unicidad y conflictos entre instituciones.
- `InstitutionsService`: métodos para validar/actualizar dominios, búsqueda por dominio.

### 3. Backend - Auth
- `AuthService.register(dto)`: nombre, email, password, passwordConfirm. Validar: dominio habilitado, email único, password >= 8 chars, rol siempre STUDENT.
- `AuthService.verifyEmail(token)`: buscar token válido, no expirado, no usado. Marcar usuario como verificado.
- `AuthService.resendVerification(email)`: generar nuevo token si usuario existe y no verificado.
- `AuthService.login()`: si password OK pero `emailVerifiedAt` null, devolver 403 con mensaje específico.
- Método para generar token de verificación (SHA-256, 24 horas).
- Método para enviar email de verificación vía `MailService`.

### 4. Backend - Users
- `UsersService.create()` (HU-9): agregar `emailVerifiedAt: now()` para usuarios administrativos.

### 5. Backend - Endpoints
- `POST /auth/register`: con rate limiting 5/hora por IP (reutilizar ThrottlerModule).
- `POST /auth/verify-email`: recibir token.
- `POST /auth/resend-verification`: recibir email, respuesta genérica.
- `PATCH /institutions/:id/email-domains`: gestionar dominios (solo ADMIN).

### 6. Frontend - Páginas
- `RegisterPage.tsx` (`/register`): form con nombre, email, password, confirmación. Validaciones en cliente.
- `VerifyEmailPage.tsx` (`/verify-email?token=`): verificar y redirigir a login o página de confirmación.
- Modificar `LoginPage.tsx`: agregar enlace "Registrarme" → `/register`.
- Manejar 403 en login (cuenta sin verificar): mostrar mensaje y botón "Reenviar verificación".

### 7. Frontend - Admin
- `AdminInstitutionsPage.tsx`: campo para ingresar/editar dominios (multi-input o textarea).

## Riesgos y Mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Dominio compartido entre instituciones | Validar unicidad en BD (@unique) + validación en service antes de crear |
| Token de verificación reutilizable | Marcar como usado en BD, validar `usedAt` null |
| Timing attack en resend-verification | Respuesta genérica siempre igual; delay simulado si email no existe |
| Usuario verifica email pero se borra institución | No relevante en alcance actual; marcar en comentario para limpieza futura |
| Backfill de usuarios existentes | Migración debe dejar todos con `emailVerifiedAt = now()` para que puedan loguearse |

## Prioridad de Implementación

1. Modelos + Migración + `mock-prisma.ts`
2. `InstitutionsService` + endpoints de dominios
3. `AuthService` (register, verify, resend + login ajustado)
4. Mail de verificación
5. Rate limiting en register
6. Frontend (Register, Verify, ajustes Login/Admin)
7. Tests (Jest + Cypress + Postman)
8. README
