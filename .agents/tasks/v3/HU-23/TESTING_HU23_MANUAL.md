# Guía de Prueba Manual: HU-23 Auto-registro de Alumnos

## Prerrequisitos

1. Docker Compose corriendo:
   ```bash
   docker compose up -d
   ```

2. Backend iniciado:
   ```bash
   cd backend
   npm run build
   npm run start:dev
   ```

3. Frontend iniciado:
   ```bash
   cd frontend
   npm run dev
   ```

4. Acceso a Mailpit para verificar emails:
   - UI: http://localhost:8025
   - API: localhost:1025

## Configuración Inicial

### 1. Crear una institución con dominio de email habilitado

1. Ir a http://localhost:3000/login
2. Loguearse como Administrador (se crea en seed):
   - Email: `admin@pecod.local`
   - Contraseña: `AdminPassword123!`
3. Ir a "Instituciones" (panel admin)
4. Crear una institución con:
   - Nombre: "UADE"
   - Dominio: `uade.pecod.local`
   - Dirección: "Av. de Mayo 866"
   - Teléfono: "4343-4343"
   - Email: `contacto@uade.edu.ar`
   - **Dominios para auto-registro:** `uade.edu.ar`

5. Guardar

### 2. (Opcional) Editar dominios de una institución existente

1. En el listado de instituciones, buscar "UADE"
2. Hacer clic en "Editar dominios"
3. Agregar más dominios (ej: `alumnos.uade.edu.ar`)
4. Guardar

## Flujo de Auto-registro

### CA1: Registro exitoso con email habilitado

1. Ir a http://localhost:3000/login
2. Hacer clic en "¿No tienes cuenta? Registrate aquí"
3. Rellenar el formulario:
   - Nombre: "Juan Perez"
   - Email: `juan.perez@uade.edu.ar` (dominio habilitado)
   - Contraseña: `MySecurePass123`
   - Confirmar: `MySecurePass123`
4. Hacer clic en "Registrarse"
5. **Resultado esperado:** Mensaje "Registro exitoso. Por favor, verifica tu email..."
6. Redirigido a login automáticamente

### CA2: Rechazo por dominio no habilitado

1. En la página de registro, intentar registrarse con:
   - Email: `usuario@ejemplo.com` (dominio no habilitado)
   - Resto igual
2. Hacer clic en "Registrarse"
3. **Resultado esperado:** Error "El dominio de tu email no pertenece a una institución habilitada"

### CA3: Rechazo por contraseña corta

1. En el formulario de registro:
   - Contraseña: `pass123` (7 caracteres)
   - Confirmar: `pass123`
2. Hacer clic en "Registrarse"
3. **Resultado esperado:** Error "La contraseña debe tener al menos 8 caracteres"

### CA4: Rechazo por email duplicado

1. Registrarse exitosamente con `juan@uade.edu.ar`
2. Ser redirigido a login
3. Volver a `/register`
4. Intentar registrarse con el mismo email
5. **Resultado esperado:** Error "Ya existe una cuenta con ese email"

### CA5: Validaciones de campos

Todos los campos son obligatorios:
- Nombre vacío → "El nombre es obligatorio"
- Email vacío → "El email es obligatorio"
- Email inválido → "El email debe ser válido"
- Contraseña vacía → "La contraseña es obligatoria"
- Confirmación vacía → "La confirmación de contraseña es obligatoria"
- Contraseñas no coinciden → "Las contraseñas no coinciden"

## Verificación de Email

### CA6: Verificación exitosa

1. Tras registrarse, el usuario es redirigido a login
2. Ir a Mailpit: http://localhost:8025
3. Buscar el email enviado a la dirección de registro
4. Hacer clic en el enlace "Verificar Email"
5. **Resultado esperado:** Página de confirmación con check ✓
6. Automáticamente redirigido a login

### CA7: Login con email verificado

1. En el login, ingresar credenciales del usuario registrado
2. Hacer clic en "Ingresar"
3. **Resultado esperado:** Acceso exitoso a `/catalogo`

### CA8: Login SIN email verificado

1. Registrarse con `test@uade.edu.ar`
2. **NO verificar email**
3. Ir a http://localhost:3000/login
4. Intentar loguearse con credenciales correctas
5. **Resultado esperado:**
   - Error 403: "Tu email aún no ha sido verificado"
   - Botón "Reenviar enlace de verificación"

### CA9: Reenvío de verificación

1. Estando en el error anterior (email no verificado)
2. Hacer clic en "Reenviar enlace de verificación"
3. Ir a Mailpit y verificar que llegó nuevo email
4. Hacer clic en el enlace
5. **Resultado esperado:** Verificación exitosa
6. Ahora puede loguearse

## Rate Limiting

### CA10: Límite de 5 registros por hora por IP

1. Intentar registrar 5 usuarios distintos exitosamente
2. Intentar un 6to registro
3. **Resultado esperado:** Error HTTP 429 "Too Many Requests"
4. Esperar a que se resetee el contador (1 hora)

Para testear sin esperar 1 hora, reiniciar el backend o modificar temporalmente el valor en `auth.controller.ts`.

## Gestión de Dominios (Admin)

### Crear institución CON dominios

1. En Admin → Instituciones, crear nueva institución
2. Al final del formulario, agregar dominios:
   - Hacer clic en input de "Dominios de email"
   - Escribir `example.edu.ar`
   - Hacer clic en "Agregar"
   - Repetir para múltiples dominios
3. Crear institución
4. **Resultado esperado:** Institución creada con dominios asociados

### Editar dominios de institución

1. En Admin → Instituciones, buscar institución
2. Hacer clic en "Editar dominios"
3. Reemplazar dominios
4. Hacer clic en "Guardar"
5. **Resultado esperado:** Dominios actualizados

### Validaciones de dominio

- **Duplicado en la misma institución:** Rechazado
- **Asignado a otra institución:** Rechazado con error claro
- **Formato inválido:** Rechazado (ej: sin punto, con @)

## Casos Edge

### Token expirado

1. Registrarse con `edge@uade.edu.ar`
2. Esperar 24+ horas (o manipular BD para que expiresAt < now())
3. Hacer clic en enlace del email
4. **Resultado esperado:** Error "El enlace de verificación ha expirado"

### Token ya usado

1. Registrarse y verificar exitosamente
2. Hacer clic nuevamente en el mismo enlace
3. **Resultado esperado:** Error "El enlace de verificación ya ha sido utilizado"

### Email inválido en verificación

1. Ir directamente a `/verify-email?token=invalid_token`
2. **Resultado esperado:** Error "El enlace de verificación es inválido o ha expirado"

## Integración con HU-9 (Usuarios Administrativos)

### Usuarios creados por admin NO necesitan verificar email

1. En Admin → Usuarios, crear nuevo usuario (Profesor o Admin)
2. No recibe email de verificación
3. Puede loguearse inmediatamente
4. **Verificación:** Campo `emailVerifiedAt` está seteado en creation time

## Base de Datos

### Verificar estado de la migración

```bash
cd backend
npx prisma studio
```

1. Navegar a tabla `users`
2. Filtrar: `emailVerifiedAt IS NOT NULL` → todos deberían cumplir
3. Crear usuario por autoregistro: `emailVerifiedAt IS NULL` hasta verificar
4. Navegar a `institution_email_domains`
5. Verificar que tenga las instituciones y dominios configurados
6. Navegar a `email_verification_tokens`
7. Verificar tokens creados con `expiresAt` y `usedAt`

## Resumen de Prueba

| Criterio | Status | Notas |
|----------|--------|-------|
| CA1: Registro con dominio habilitado | ✅ | Redirige a login |
| CA2: Rechazo por dominio no habilitado | ✅ | Mensaje específico |
| CA3: Determinación de institución | ✅ | Por dominio de email |
| CA4: Email único | ✅ | Rechaza duplicados |
| CA5: Rol forzado a STUDENT | ✅ | No se acepta valor de body |
| CA6: Email de verificación | ✅ | Token 24h, de un uso |
| CA7: Login sin verificar | ✅ | 403 con opción reenviar |
| CA8: Aislamiento institucional | ✅ | Usuario vinculado por dominio |
| CA9: Rate limiting | ✅ | 5/hora por IP |
| CA10: Compat. HU-9 | ✅ | Admins crean verificados |

## Troubleshooting

### No llega email de verificación

1. Verificar que Mailpit esté corriendo: `docker ps`
2. Ir a http://localhost:8025 y verificar que aparezca en la bandeja
3. Revisar logs del backend: `npm run start:dev`
4. Si MailService da error, revisar variables de entorno en `.env`

### Usuario no puede loguearse tras verificar

1. Ir a `http://localhost:3000/verify-email?token=...` directamente
2. Verificar que mensaje sea "Email verificado correctamente"
3. En Prisma Studio, verificar que `emailVerifiedAt` sea NOT NULL
4. Intentar login nuevamente

### Dominio no se guarda

1. Verificar que formato sea válido (sin @, con punto, letras/números/guiones)
2. Ir a Prisma Studio → `institution_email_domains`
3. Buscar por `institutionId`
4. Si no aparece, revisar errores en console del backend
