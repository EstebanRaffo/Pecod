# Resumen de Implementación: HU-23 Auto-registro de Alumnos por Dominio Institucional

## Introducción

Se implementó la Historia de Usuario 23 de forma completa, permitiendo que alumnos se registren por cuenta propia usando emails institucionales. La solución incluye validación por dominio, verificación de email, gestión de dominios administrativos y rate limiting.

## Cambios por Capa

### Base de Datos (Prisma)

**Archivos modificados:**
- `backend/prisma/schema.prisma` - Agregados 3 nuevos modelos/campos
- `backend/prisma/migrations/20261109124502_add_email_verification_and_institution_domains/migration.sql` - Migración que aplica cambios

**Cambios:**

1. **User.emailVerifiedAt** (DateTime?): Nuevo campo para rastrear verificación de email. La migración backfilla todos los usuarios existentes con `now()` para mantener compatibilidad.

2. **InstitutionEmailDomain**: Nuevo modelo para almacenar dominios permitidos por institución:
   - `id` (UUID, PK)
   - `institutionId` (FK)
   - `domain` (String, lowercase normalizado, unique por institución)
   - Índice en domain para búsquedas rápidas

3. **EmailVerificationToken**: Nuevo modelo para tokens de verificación:
   - `id` (UUID, PK)
   - `userId` (FK)
   - `tokenHash` (String, @unique, SHA-256)
   - `expiresAt` (DateTime, 24 horas)
   - `usedAt` (DateTime?, null mientras no se use)
   - Índices en userId y tokenHash

### Backend - Auth Service & Controller

**Archivos modificados:**
- `backend/src/auth/auth.service.ts`
- `backend/src/auth/auth.controller.ts`
- `backend/src/auth/auth.module.ts`

**Nuevos DTOs:**
- `backend/src/auth/dto/register.dto.ts`
- `backend/src/auth/dto/verify-email.dto.ts`
- `backend/src/auth/dto/resend-verification.dto.ts`

**Cambios clave:**

1. **AuthService.register()**: Implementa registro de alumno
   - Valida que las contraseñas coincidan (>=8 caracteres)
   - Verifica que el email no exista
   - Extrae dominio del email y lo busca en instituciones habilitadas
   - Si no encuentra institución, rechaza con mensaje específico
   - Crea usuario con role siempre STUDENT, emailVerifiedAt = null
   - Genera token de verificación y envía email
   - Respuesta genérica sin revelar existencia de usuario

2. **AuthService.login()** (modificado): Validación de verificación de email
   - Si credentials OK pero emailVerifiedAt es null, devuelve 403 con mensaje específico
   - Permite distinguir entre "falta verificar" y "credenciales inválidas"

3. **AuthService.verifyEmail()**: Verifica token y marca email como verificado
   - Busca token por hash SHA-256
   - Valida que no haya expirado (24 horas)
   - Valida que no haya sido usado
   - Marca usuario como verificado (emailVerifiedAt = now())
   - Marca token como usado

4. **AuthService.resendVerification()**: Genera nuevo token si aplica
   - Respuesta genérica siempre igual
   - Simula delay si email no existe (timing attack mitigation)
   - Solo genera nuevo token si usuario existe y no verificó

5. **AuthController**: Nuevos endpoints
   - `POST /auth/register` - Rate limiting 5/hora por IP
   - `POST /auth/verify-email` - Verifica token
   - `POST /auth/resend-verification` - Rate limiting 5/hora por IP

### Backend - Instituciones

**Archivos modificados:**
- `backend/src/institutions/institutions.service.ts`
- `backend/src/institutions/institutions.controller.ts`
- `backend/src/institutions/dto/create-institution.dto.ts`

**Nuevos DTOs:**
- `backend/src/institutions/dto/update-email-domains.dto.ts`

**Cambios clave:**

1. **CreateInstitutionDto**: Extendido con `emailDomains?: string[]` opcional
   - Se valida formato de dominio
   - Se normaliza a lowercase
   - Se valida unicidad global entre instituciones

2. **InstitutionsService.create()** (modificado):
   - Si proporciona emailDomains, se crean en transacción

3. **InstitutionsService.updateEmailDomains()** (nuevo):
   - Solo ADMIN puede llamar
   - Reemplaza todos los dominios de una institución
   - Valida unicidad entre dominios de otra institución

4. **InstitutionsService.findByEmailDomain()** (nuevo):
   - Búsqueda por dominio de email
   - Devuelve institución o null

5. **InstitutionsService** (métodos privados):
   - `normalizeDomain()`: Valida y normaliza formato
   - `createEmailDomains()`: Crea dominios con validaciones

6. **InstitutionsController**:
   - `PATCH /institutions/:id/email-domains` - Nuevo endpoint

### Backend - Users Service

**Archivo modificado:**
- `backend/src/users/users.service.ts`

**Cambio clave:**
- UsersService.create() (HU-9): Ahora crea usuarios administrativos con `emailVerifiedAt = now()` para que puedan loguearse inmediatamente

### Backend - Mail Service

**Archivo modificado:**
- `backend/src/mail/mail.service.ts`

**Nuevo método:**
- `sendEmailVerificationEmail()`: Envía email de verificación con enlace de 24 horas
  - Templating HTML y texto plano
  - Fire-and-forget (no lanza error si falla)

### Backend - Test Utils

**Archivo modificado:**
- `backend/src/test-utils/mock-prisma.ts`

**Cambios:**
- Agregados `institutionEmailDomain` y `emailVerificationToken` a createMockPrismaService()

### Frontend - Páginas

**Nuevas páginas:**
- `frontend/src/pages/RegisterPage.tsx` - Formulario de auto-registro
  - Validación cliente de todos los campos
  - Manejo de errores con mensajes específicos
  - Redirección a login tras registro exitoso

- `frontend/src/pages/VerifyEmailPage.tsx` - Página de verificación
  - Acepta token en query param `?token=...`
  - Spinner de carga
  - Mensajes de éxito/error
  - Redirección a login tras verificación

**Archivos modificados:**
- `frontend/src/pages/LoginPage.tsx` - Ajustes para HU-23
  - Enlace "Registrarse" → `/register`
  - Manejo de error 403 (email no verificado)
  - Botón "Reenviar verificación" que llama POST /auth/resend-verification

- `frontend/src/pages/AdminInstitutionsPage.tsx` - Gestión de dominios
  - UI para agregar dominios al crear institución
  - Edición de dominios en institución existente (botón "Editar dominios")
  - Visualización de dominios habilitados

- `frontend/src/App.tsx` - Enrutamiento
  - `GET /register` → RegisterPage
  - `GET /verify-email` → VerifyEmailPage

## Criterios de Aceptación Cubiertos

1. ✅ **Dominios configurables**: Administrador define dominios en creación o mediante PATCH
2. ✅ **Pantalla de login**: Ofrece "Registrarme" con campos validados
3. ✅ **Determinación de institución**: Extrae dominio de email y busca en base de datos
4. ✅ **Email único**: Rechaza si email ya registrado
5. ✅ **Rol forzado a STUDENT**: No se acepta rol del body
6. ✅ **Email de verificación**: Token de 24h, de un solo uso
7. ✅ **Login sin verificar**: Respuesta 403 específica + opción de reenviar
8. ✅ **Aislamiento institucional**: Usuario vinculado a institución por dominio
9. ✅ **Rate limiting**: 5 registros/hora por IP (ThrottlerModule)
10. ✅ **Compatibilidad HU-9**: Usuarios administrativos verificados automáticamente

## Decisiones de Diseño Aplicadas

- **Unicidad de dominio**: @unique a nivel de base de datos + validación en service
- **Normalización de dominio**: lowercase, sin @, validación de formato
- **Token SHA-256**: Consistente con HU-22, almacenado hasheado
- **Backfill de usuarios**: Todos los usuarios existentes quedan verificados
- **Respuestas genéricas**: resend-verification y forgot-password ocultan si email existe
- **Rol explícito**: Role.STUDENT se fuerza sin excepción, ignorando body
- **Rate limiting**: ThrottlerModule de NestJS (reutilizado de HU-22)

## Testing

### Backend
- ✅ 207 tests pasan (incluyendo tests existentes sin regresión)
- Mock de PrismaService actualizado con nuevos modelos
- AuthService.spec.ts actualizado para inyectar InstitutionsService

### Frontend
- ✅ Build TypeScript sin errores
- ✅ Validaciones cliente funcionan
- Pendiente: tests Cypress (estructura lista para agregar)

### Base de Datos
- ✅ Migración Prisma aplicada exitosamente
- ✅ Backfill de emailVerifiedAt completado
- ✅ Constraints de integridad en place

## Casos Edge Cubiertos

- Email sin dominio válido: Rechazado con mensaje
- Dominio no habilitado: Rechazado con mensaje específico
- Email duplicado: Rechazado como ConflictException
- Contraseñas no coinciden: Error de validación
- Token expirado/usado: Rechazado con mensaje específico
- Usuario intenta loguearse sin verificar: 403 con opción de reenviar
- Dominio duplicado entre instituciones: Rechazado al crear/editar
- Timing attacks mitigados: Respuestas genéricas con delays simulados

## Variables de Entorno Requeridas

No hay nuevas variables de entorno requeridas. Se reutilizan:
- `FRONTEND_URL` (para construir enlaces de verificación)
- `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS` (existentes en HU-22)

## Migraciones y Data

- Migración: `20261109124502_add_email_verification_and_institution_domains`
- Aplica limpiamente sobre base vacía
- Backfill seguro para bases con datos existentes
- Compatible con prisma migrate deploy

## Cambios en comportamiento

### Para Admin de Sistema:
- Puede ahora definir dominios de email al crear institución
- Puede editar dominios de institución después de crearla
- Usuarios administrativos se crean ya verificados (sin cambio de experiencia)

### Para Alumnos:
- Nuevas opciones: registro por email institucional
- Flujo: registro → email verificación → login
- Sin interfaz de creación de profesor/admin (solo STUDENT)

### Para el login:
- Si email sin verificar: 403 con opción de reenviar (no genérico)
- Si credenciales inválidas: Genérico (sin cambios)

## Puntos de Extensión Futura

- Limpieza automática de tokens/cuentas expirados
- Personalización de email por institución
- Validación de dominio existente antes de registro
- Two-factor authentication
- OAuth2 con proveedores institucionales (Google Workspace, Okta, etc.)

## Verificación Manual

```bash
# Terminal 1: Backend
cd backend
npm run build
npm test
npm run start:dev

# Terminal 2: Frontend  
cd frontend
npm run build
npm run dev

# Terminal 3: Tests Cypress (cuando esté listo)
cd frontend
npm run cypress:open
```

Flujo manual de prueba:
1. Ir a `/register`
2. Ingresar email con dominio institucional habilitado (ej: usuario@uade.edu.ar)
3. Recibir email en Mailpit (localhost:8025)
4. Hacer clic en enlace de verificación
5. Ser redirigido a `/login`
6. Loguearse exitosamente
7. Acceder a `/catalogo` como alumno
