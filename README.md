# PECOD — V1

Plataforma de cursos on-demand multi-institucional. Esqueleto de proyecto para arrancar el desarrollo de V1, generado a partir de las 12 Historias de Usuario definidas en el TP Integrador de Testing de Aplicaciones.

## Stack (decisiones fijadas para V1)

- **Backend:** Node.js + NestJS + REST
- **Base de datos:** PostgreSQL (Prisma ORM), multi-tenant vía `institutionId`
- **Auth:** JWT (login con email/contraseña propios de la plataforma; sin OAuth2 en V1)
- **Frontend:** React + TypeScript + Vite + TailwindCSS
- **Video:** subida directa a S3 vía URL prefirmada + Mux (transcodificación/streaming)
- **Testing:** Jest, Cypress/Playwright, Postman, JMeter/k6 (no incluidos en este esqueleto)

## Estructura

```
pecod-v1/
├── backend/          # API NestJS
│   ├── prisma/
│   │   ├── schema.prisma   # Modelo de datos completo (12 HU)
│   │   └── seed.ts         # Crea el Administrador de Sistema inicial
│   └── src/
│       ├── auth/           # HU10
│       ├── institutions/   # HU9
│       ├── users/          # HU9
│       ├── courses/        # HU1, HU4, HU5, HU8
│       ├── topics/         # HU5, HU6, HU7
│       ├── enrollments/    # HU2, HU3
│       ├── evaluations/    # HU11, HU12
│       └── uploads/        # URLs prefirmadas S3 (HU5/HU6/HU7)
└── frontend/         # SPA React
    └── src/
        ├── pages/          # Una página por HU
        ├── context/        # AuthContext (JWT)
        └── routes/         # ProtectedRoute (control de acceso por rol)
```

## Puesta en marcha

### 1. Base de datos

```bash
docker compose up -d
```

Esto levanta PostgreSQL en `localhost:5432` (usuario/clave/DB: `pecod`).

### 2. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run prisma:migrate     # crea las tablas
npm run prisma:seed        # crea el Administrador de Sistema inicial
npm run start:dev
```

El backend queda en `http://localhost:3000/api`.

**Credenciales del Administrador inicial** (creadas por el seed, cambiarlas luego):
- Email: `admin@pecod.com`
- Contraseña: `Admin123!`

Como no existe auto-registro en V1 (HU9), todo Profesor y Alumno se crea desde el panel de Administración con este usuario.

### 3. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

El frontend queda en `http://localhost:5173`.

## Flujo para probar el sistema de punta a punta

1. Login como `admin@pecod.com`.
2. Crear una Institución (HU9).
3. Crear un usuario con rol **Profesor** para esa institución (HU9) — anotar la contraseña temporal que se muestra una única vez.
4. Crear un usuario con rol **Alumno** para la misma institución (HU9).
5. Cerrar sesión, loguearse como el Profesor, crear un curso (HU5), agregarle temas (HU5) y publicarlo (HU8).
6. Cerrar sesión, loguearse como el Alumno, ver el catálogo (HU1), entrar al detalle (HU4) e inscribirse (HU2).
7. Ver "Mis cursos" (HU3).

## Testing

Cada test está comentado con la HU y el criterio de aceptación puntual que verifica — la idea es que la trazabilidad HU → criterio → test sea directa, no que haya que adivinarla.

### Backend — tests unitarios (Jest)

Cubren la lógica de negocio de cada service (validaciones, reglas de autorización, cálculo de puntaje, límite de intentos), mockeando Prisma para no depender de una base de datos real.

```bash
cd backend
npm install
npm test                 # corre todos los *.spec.ts
npm test -- --coverage   # con reporte de cobertura
```

Módulos cubiertos: `auth` (HU10), `institutions` (HU9), `users` (HU9), `courses` (HU1/HU5/HU8), `enrollments` (HU2/HU3), `evaluations` (HU11/HU12), `topics` (HU3-HU7), `uploads` (HU5-HU7), y el `RolesGuard` transversal a HU10.

### Frontend — tests end-to-end (Cypress)

Prueban los flujos completos a través de la UI real, contra un backend y una base de datos corriendo (no mockeado). Cada test genera sus propios datos de prueba (institución/usuarios/curso) vía API antes de interactuar con la UI, así que se pueden correr repetidamente sin depender de un estado previo.

```bash
# 1. Backend y DB deben estar corriendo (ver "Puesta en marcha")
# 2. Frontend corriendo:
cd frontend
npm install
npm run dev

# 3. En otra terminal, con el frontend ya levantado:
npm run cypress:open   # modo interactivo
npm run cypress:run    # modo headless (CI)
```

Specs incluidos: `auth.cy.ts` (HU10), `catalog-and-enrollment.cy.ts` (HU1/HU2/HU3), `evaluation-attempts.cy.ts` (HU11/HU12, incluyendo el límite de 2 intentos).

> Nota: la colección REST usa Cypress como decisión de este esqueleto; Playwright sigue siendo una alternativa válida (ver "Herramientas" del TP) si el equipo lo prefiere — la estructura de specs no cambiaría demasiado.

### API — colección de Postman

En `postman/`: `PECOD-V1.postman_collection.json` + `PECOD-V1-Local.postman_environment.json`. Recorre el flujo completo (login → institución → usuarios → curso → inscripción → evaluación con límite de intentos) encadenando variables de entorno entre requests, con asserts por criterio de aceptación.

```bash
# Con el backend recién seedeado (npm run prisma:seed):
# Opción 1: importar ambos archivos en la app de Postman y correr la colección (Runner).
# Opción 2: por línea de comandos con Newman:
npm install -g newman
newman run postman/PECOD-V1.postman_collection.json -e postman/PECOD-V1-Local.postman_environment.json
```

### Pendiente en testing

- Tests de performance/carga (JMeter o k6) — no incluidos en este esqueleto.
- Tests e2e del `backend` (`test:e2e` con Supertest contra una base de datos de test) — el script ya existe en `package.json`, falta la configuración de `test/jest-e2e.json` y una base de datos separada para test.

## Pendiente de implementación (no cubierto por este esqueleto)

- Envío de credenciales por email al dar de alta un usuario (hoy se muestran una vez en pantalla; el envío por email queda para V2/V3, cuando se sume un servicio de email).
- Verificación exhaustiva de compatibilidad de `getDisplayMedia`/`MediaRecorder` entre navegadores (HU6) — funciona en Chrome/Edge recientes, conviene probarlo en el navegador real antes de la demo.
- Tests de performance/carga (JMeter o k6) y tests e2e del backend con base de datos de test (ver sección "Testing" arriba).

### Ya resueltos en esta iteración

- Subida real de archivos a S3 desde el navegador, vía URL prefirmada (`api/uploads.ts`, `TopicMediaUploader`).
- Grabación de pantalla en el navegador (HU6) con `MediaRecorder`/`getDisplayMedia` (`hooks/useScreenRecorder.ts`).
- Formulario de creación de evaluaciones de opción múltiple (HU11) (`EvaluationCreator`).
- Endpoint `GET /courses/mine` para que el Profesor vea también sus cursos en borrador.
- Listado de evaluaciones de un curso, visible para el Profesor (para administrarlas) y para el Alumno inscripto (para rendirlas).
- Suite de tests: unitarios de backend (Jest), end-to-end de frontend (Cypress) y colección de API (Postman) — ver sección "Testing".

## Ver también

Todas las decisiones técnicas y de negocio referenciadas en los comentarios del código (límites de tamaño, cantidad de intentos, etc.) están documentadas en el TP Integrador ("Testing de Aplicaciones - TP Integrador.docx"), sección de las 12 HU de V1 y "Supuestos técnicos".
