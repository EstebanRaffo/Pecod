# PECOD - V3

Plataforma de cursos on-demand multi-institucional. La versión 3 incluye las funcionalidades definidas hasta la HU-25 del TP Integrador de Testing de Aplicaciones.

## Stack (decisiones fijadas para V1)

- **Backend:** Node.js + NestJS + REST
- **Base de datos:** PostgreSQL (Prisma ORM), multi-tenant vía `institutionId`
- **Auth:** JWT (login con email/contraseña propios de la plataforma; sin OAuth2 en V1)
- **Email:** Nodemailer (SMTP configurable, Mailpit para desarrollo)
- **Frontend:** React + TypeScript + Vite + TailwindCSS
- **Video:** subida directa a S3 vía URL prefirmada + Mux (transcodificación/streaming)
- **Testing:** Jest, Cypress/Playwright, Postman, JMeter/k6 (no incluidos en este esqueleto)

## Estructura

```
pecod/
├── backend/          # API NestJS
│   ├── prisma/
│   │   ├── schema.prisma   # Modelo de datos completo (25 HU)
│   │   └── seed.ts         # Crea el Administrador de Sistema inicial
│   └── src/
│       ├── auth/           # HU10, HU22, HU23 (auto-registro)
│       ├── mail/           # HU22 (envío de emails), HU23 (verificación)
│       ├── institutions/   # HU9, HU23 (gestión de dominios)
│       ├── users/          # HU9, HU23 (usuarios administrativos verificados)
│       ├── courses/        # HU1, HU4, HU5, HU8
│       ├── topics/         # HU5, HU6, HU7
│       ├── enrollments/    # HU2, HU3
│       ├── evaluations/    # HU11, HU12
│       ├── uploads/        # URLs prefirmadas S3 (HU5/HU6/HU7)
│       ├── reviews/        # HU20
│       ├── certificates/   # HU18
│       ├── analytics/      # HU21
│       ├── notifications/  # HU17, HU24 (notificaciones de contenido y recomendaciones)
│       ├── recommendations/ # HU24 (algoritmo de recomendación de cursos)
│       └── forum/          # HU25 (foro de consultas por curso)
└── frontend/         # SPA React
    └── src/
        ├── pages/          # Una página por HU (+ ForgotPasswordPage, ResetPasswordPage para HU22, RegisterPage y VerifyEmailPage para HU23, ForumPage para HU25)
        ├── components/     # Componentes reutilizables (ConfirmDialog para HU25)
        ├── context/        # AuthContext (JWT)
        └── routes/         # ProtectedRoute (control de acceso por rol)
```

## Puesta en marcha

### 1. Base de datos y servicios

```bash
docker compose up -d
```

Esto levanta:
- **PostgreSQL** en `localhost:5432` (usuario/clave/DB: `pecod`)
- **Mailpit** en `localhost:1025` (SMTP) y `localhost:8025` (Web UI para desarrollo)

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

#### Subidas directas a S3

Las cargas desde el navegador usan `PUT` directo a S3, por lo que el CORS de Nest no configura el CORS del bucket. Aplicá `backend/s3-cors.json` en **S3 → bucket → Permissions → Cross-origin resource sharing (CORS)**. La regla incluida habilita el frontend local en `http://localhost:5173` y `http://localhost:5174`; para otros entornos, agregá el origen exacto del frontend (protocolo, host y puerto).

El principal de AWS configurado en el backend también necesita `s3:PutObject` sobre los prefijos `video/*` y `material/*`. Las lecturas firmadas requieren `s3:GetObject`. Un `403` de S3 suele indicar permisos, región o firma incorrecta; un error de red/CORS suele indicar que falta el origen en la política CORS del bucket.

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

El frontend queda en `http://localhost:5173` (Vite usa `5174` si `5173` ya está ocupado).

## Flujo para probar el sistema de punta a punta

1. Login como `admin@pecod.com`.
2. Crear una Institución (HU9).
3. Crear un usuario con rol **Profesor** para esa institución (HU9) — anotar la contraseña temporal que se muestra una única vez.
4. Crear un usuario con rol **Alumno** para la misma institución (HU9).
5. Cerrar sesión, loguearse como el Profesor, crear un curso (HU5), agregarle temas (HU5) y publicarlo (HU8).
6. Cerrar sesión, loguearse como el Alumno, ver el catálogo (HU1), entrar al detalle (HU4) e inscribirse (HU2).
7. Ver "Mis cursos" (HU3).

### Progreso individual (HU16)

En la cursada, cada tema permite marcarse como visto y desmarcarse. La cursada y "Mis cursos" muestran los temas vistos sobre el total, el porcentaje y una barra de progreso. El porcentaje usa `Math.round(vistos / total * 100)`; un curso sin temas muestra 0%. Las evaluaciones no cuentan.

Solo un Alumno inscripto puede consultar o modificar su propio progreso. Los registros persisten por inscripción y tema; el total se consulta nuevamente en cada lectura para reflejar los temas agregados o eliminados. La eliminación de un tema borra su progreso mediante `onDelete: Cascade`.

Endpoints autenticados (base `/api`):
- `GET /courses/:courseId/progress`: avance propio y IDs de temas vistos.
- `PUT /courses/:courseId/topics/:topicId/viewed`: marcar como visto, de forma idempotente.
- `DELETE /courses/:courseId/topics/:topicId/viewed`: desmarcar, de forma idempotente.

Para actualizar una base existente, ejecutar `npx prisma migrate deploy` y `npm run prisma:generate` desde `backend`, con el backend detenido para evitar el bloqueo de la DLL de Prisma en Windows.

### Notificaciones de contenido (HU17)

La campana aparece solo en el header del Alumno y se muestra roja mientras haya avisos sin leer. El listado muestra primero los mas recientes, con nombre del curso, tipo de evento, tema y fecha/hora local. Cada aviso permite marcarse como leido y acceder directamente al tema; abrir el listado no marca automaticamente los avisos.

Los avisos se generan para los alumnos inscriptos al crear temas o agregar/modificar texto, videos, grabaciones y materiales adjuntos. La escritura del contenido y sus avisos es transaccional. No se generan por eliminaciones, guardados sin cambios ni modificaciones de datos generales del curso. Una inscripcion posterior no recibe avisos retroactivos. Los avisos conservan los nombres del curso y del tema al momento del evento.

La sesion consulta novedades cada 15 segundos, al recuperar el foco y al abrir el listado. El estado de lectura persiste en la base y es individual por alumno. La API comprueba tanto el destinatario como la inscripcion vigente, sin aceptar un ID de alumno proporcionado por el cliente.

Endpoints autenticados, exclusivos de `STUDENT` (base `/api`):
- `GET /notifications`: listado propio, ordenado de mas reciente a mas antiguo.
- `PATCH /notifications/:id/read`: marcar un aviso propio como leido.

Para una base existente, detener el backend y ejecutar desde `backend`:

```bash
npx prisma migrate deploy
npm run prisma:generate
npm run start:dev
```

Pruebas: `npm test -- --runInBand topics.service.spec notifications.service.spec` desde `backend` y `npm run cypress:run -- --spec cypress/e2e/notifications.cy.ts` desde `frontend`. El spec comprueba recepcion en una sesion abierta, orden, lectura persistente, navegacion al tema, vista movil, exclusiones y aislamiento entre alumnos.

### Recomendación de cursos (HU24)

El Alumno inscripto recibe recomendaciones de cursos nuevos basadas en su historial de inscripciones y su avance (HU16). Las recomendaciones se generan mediante una tarea programada que se ejecuta una vez por semana (lunes 09:00 UTC) y se entregan como notificaciones en el mismo icono "campana" y listado de HU17, diferenciadas por el tipo de evento `COURSE_RECOMMENDED`.

El algoritmo calcula el perfil de intereses del Alumno a partir del peso acumulado por categoría y tecnología de los cursos en los que está inscripto. El peso por curso es `1 + avance/100` (p. ej., 80% de avance = 1.8). Luego selecciona los cursos publicados y activos de la institución del Alumno en los que no está inscripto y que no se le han recomendado previamente, y los rankea por puntaje = pesoCategoria + pesoTecnologia (ambos normalizados: lowercase y sin espacios sobrantes). El desempate es por cantidad de inscriptos (descendente) y luego por fecha de creación (más recientes primero). Se generan como máximo 3 recomendaciones por Alumno por ejecución. Un mismo curso no se vuelve a recomendar al mismo Alumno. Si el Alumno no tiene inscripciones o no existen cursos candidatos, no se genera nada y no es un error.

Cada notificación de recomendación informa: nombre del curso, área de conocimiento, tecnología y fecha/hora de generación. Al seleccionar la notificación, el Alumno accede al detalle del curso (HU4); si el curso ya no está publicado, se informa que no está disponible; si el Alumno ya está inscripto (se inscribió después de recibir la recomendación), se navega al contenido del curso.

Las recomendaciones se pueden marcar como leídas y se ordenan junto con las de HU17 de la más reciente a la más antigua. El ícono permanece en rojo mientras haya notificaciones no leídas.

Endpoint autenticado, exclusivo de `ADMIN`, para ejecutar manualmente la generación de recomendaciones en demos y tests (base `/api`):
- `POST /notifications/recommendations/run`: ejecuta `generateForAllStudents()` y devuelve un resumen con cantidad de estudiantes procesados y notificaciones creadas.

Pruebas: `npm test -- --testPathPattern=recommendations` desde `backend` y `npm run cypress:run -- --spec cypress/e2e/hu24-recommendations.cy.ts` desde `frontend`. El spec cubre ejecución manual, recepción de recomendaciones, lectura persistente, navegación y acceso denegado sin permisos ADMIN.

**Mejoras futuras:** La normalización de categoría y tecnología es frágil porque son strings libres. Una tabla de categorías predefinidas y etiquetado con IDs mejoraría sustancialmente el algoritmo.

### Certificado de finalización (HU18)

El Alumno inscripto puede consultar si tiene disponible su certificado desde la cursada y descargarlo en PDF. Para obtenerlo, el curso debe tener al menos un tema, todos sus temas deben estar vistos y todas sus evaluaciones aprobadas. Si agota los dos intentos de una evaluación sin aprobarla, no puede obtener el certificado; la pantalla informa qué requisito falta. Un curso despublicado sigue disponible para sus alumnos inscriptos.

La primera descarga emite el certificado con un código único y conserva una copia de los datos del Alumno, curso, institución, Profesor y fecha de emisión. Las descargas posteriores entregan el mismo certificado, aunque después cambie el contenido del curso. En “Mis cursos” se identifica el curso finalizado con el certificado disponible.

Endpoints autenticados, exclusivos de `STUDENT` y limitados a cursos de la institución del Alumno (base `/api`):
- `GET /courses/:courseId/certificate/status`: devuelve si el certificado está habilitado, si ya fue emitido y los requisitos pendientes.
- `GET /courses/:courseId/certificate`: emite el certificado si corresponde y descarga el PDF; si ya existe, descarga el mismo certificado.

Para una base existente, detener el backend y ejecutar desde `backend`:

```bash
npx prisma migrate deploy
npm run prisma:generate
```

Pruebas: `npm test -- --runInBand certificates.service.spec.ts enrollments.service.spec.ts` desde `backend` y `npm run cypress:run -- --spec cypress/e2e/certificates.cy.ts` desde `frontend`.

### Edicion de preguntas y respuestas de evaluaciones

En el listado de Evaluaciones del curso del Profesor, el icono Ver despliega las preguntas y respuestas. Cada texto permite Editar, Guardar o Cancelar; cancelar descarta el borrador y guardar modifica solo el texto, sin cambiar la respuesta correcta.

Los alumnos sin intentos ven el contenido actualizado. Desde el primer intento con nota se conserva una copia de preguntas, respuestas y criterio de aprobacion; un segundo intento usa esa misma version. La edicion no modifica las notas ni los intentos anteriores, y mantiene las restricciones de evaluacion aprobada y maximo de dos intentos.

Antes de usar esta funcionalidad en una base existente, ejecutar `npx prisma migrate deploy` y `npm run prisma:generate` desde `backend`. La migracion completa las copias de los intentos existentes con el contenido disponible al aplicarla; no puede recuperar cambios historicos previos que nunca se almacenaron.

Endpoints exclusivos del Profesor propietario (base `/api`):
- `GET /evaluations/:evaluationId`: detalle con preguntas y opciones.
- `PATCH /evaluations/:evaluationId/questions/:questionId`: texto de una pregunta, cuerpo `{ "text": "..." }`.
- `PATCH /evaluations/:evaluationId/options/:optionId`: texto de una respuesta, mismo cuerpo.

Pruebas: `npm test -- --runInBand evaluations.service.spec.ts` desde `backend` y `npm run cypress:run -- --spec cypress/e2e/evaluation-attempts.cy.ts` desde `frontend`.

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

HU16: `npm test -- --runInBand enrollments.service.spec.ts` desde `backend` y `npm run cypress:run -- --spec cypress/e2e/progress.cy.ts` desde `frontend`. Los helpers compartidos y el spec de progreso usan `cy.env`, compatible con Cypress 16; los specs anteriores todavía usan la API retirada `Cypress.env`.

### Panel de analíticas del Profesor (HU21)

El Profesor accede desde el menú a un panel que muestra indicadores agregados de todos sus cursos (publicados, despublicados y borradores):
- Cantidad de Alumnos inscriptos.
- Porcentaje de avance promedio (promedio de los porcentajes individuales, redondeado).
- Calificación promedio (1 decimal, o "Sin calificaciones" si no hay reseñas).
- Cantidad de reseñas.

Si no tiene cursos, muestra "Sin cursos para analizar" con enlace a crear un curso. El panel calcula los indicadores al abrir y se actualiza automáticamente (no hay caché). Solo datos agregados son expuestos; nunca información individual de Alumnos.

Endpoint autenticado, exclusivo de `PROFESSOR` (base `/api`):
- `GET /professor/analytics`: retorna array con un objeto por curso propio del Profesor autenticado, incluyendo courseId, title, status, enrolledCount, averageProgress, ratingAverage (null si no hay reseñas), ratingCount.

Rutas del Frontend:
- `GET /profesor/analiticas`: página del panel (protegida por rol `PROFESSOR`).
- Enlace en el NavBar del Profesor: "Analíticas".

Pruebas: `npm test -- --runInBand analytics.service.spec.ts` desde `backend` y `npm run cypress:run -- --spec cypress/e2e/hu21-analytics.cy.ts` desde `frontend`. Los tests verifican múltiples porcentajes (redondeo correcto), cursos sin inscriptos/sin temas/sin reseñas, cursos despublicados con indicadores, filtro por Profesor e institución, y denegación de acceso a otros roles.

> Nota: la versión 3 incluye las historias HU18 (Certificados), HU20 (Reseñas y calificaciones) y HU21 (Analíticas del Profesor), extendiendo las 18 HU de las versiones 1 y 2.

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
