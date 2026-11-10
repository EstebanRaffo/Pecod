# HU-23: Recomendación de Cursos - Resumen de Implementación

## Descripción

Se implementó un sistema de recomendación de cursos basado en el historial de inscripciones y avance del Alumno. Las recomendaciones se generan mediante una tarea programada semanal y se entregan como notificaciones en el mismo icono "campana" que las notificaciones de contenido (HU-17).

## Cambios Realizados

### Base de Datos (Migraciones Prisma)

**Archivos modificados:**
- `backend/prisma/schema.prisma`: Agregado nuevo valor de enum `COURSE_RECOMMENDED` y `topicTitle` nullable.
- `backend/prisma/migrations/20261109131815_add_course_recommendations/migration.sql`: Migración SQL que agrega el enum value y hace nullable `topicTitle`.
- `backend/prisma/migrations/20261109132156_add_recommendation_unique_index/migration.sql`: Segunda migración que crea el índice único parcial.

**Cambios:**
- Enum `ContentEvent` ahora incluye `COURSE_RECOMMENDED`.
- Campo `topicTitle` en tabla `notifications` es ahora nullable (NULL en lugar de NOT NULL).
- Índice único parcial en `(studentId, courseId, event)` WHERE `event = 'COURSE_RECOMMENDED'` para evitar duplicados.
- Índice regular en `(courseId, event)` para búsquedas eficientes.

### Backend

**Módulo de Recomendaciones (Nuevo)**

**Archivos creados:**
- `backend/src/recommendations/recommendations.service.ts`: Servicio principal con:
  - `calculateStudentProfile()`: Calcula pesos acumulados por categoría y tecnología.
  - `getCandidateCourses()`: Obtiene cursos candidatos (publicados, activos, no inscritos, no recomendados).
  - `rankAndSelectCourses()`: Rankea por puntaje y selecciona máximo 3 cursos.
  - `createNotifications()`: Crea las notificaciones evitando duplicados.
  - `generateForAllStudents()`: Método principal ejecutado semanalmente.

- `backend/src/recommendations/recommendations.module.ts`: Módulo que exporta `RecommendationsService`.

- `backend/src/recommendations/recommendations.service.spec.ts`: Tests cobriendo:
  - Generación de recomendaciones con múltiples inscripciones.
  - Alumno sin inscripciones (no genera nada).
  - Límite de máximo 3 recomendaciones.
  - No repetir cursos ya recomendados.
  - Normalización de categoría y tecnología.
  - Desempate por cantidad de inscriptos y fecha.
  - Exclusión de cursos despublicados.
  - Aislamiento por institución.

**Módulo de Notificaciones (Modificado)**

**Archivos modificados:**
- `backend/src/notifications/notifications.service.ts`:
  - Agregada importación de `Cron` y `Logger`.
  - Método `scheduleWeeklyRecommendations()` decorado con `@Cron('0 9 * * 1', { timeZone: 'UTC' })`.
  - Inyectada dependencia de `RecommendationsService`.

- `backend/src/notifications/notifications.controller.ts`:
  - Agregado endpoint `POST /notifications/recommendations/run` (solo ADMIN).
  - Inyectada dependencia de `RecommendationsService`.

- `backend/src/notifications/notifications.module.ts`:
  - Importado `ScheduleModule.forRoot()`.
  - Importado `RecommendationsModule`.

- `backend/src/notifications/notifications.service.spec.ts`:
  - Actualizado para inyectar `RecommendationsService` en el constructor.

**Modificaciones globales:**

- `backend/src/app.module.ts`: Agregada importación de `RecommendationsModule`.
- `backend/src/test-utils/mock-prisma.ts`: Agregado método `count` al tipo `ModelMock`.
- `backend/package.json`: Agregada dependencia `@nestjs/schedule@^4.1.1`.

### Frontend

**Archivos modificados:**

- `frontend/src/api/notifications.ts`:
  - Nuevo interface `CourseRecommendation` con fields específicos (category, technology, event: COURSE_RECOMMENDED).
  - Tipo union `Notification = ContentNotification | CourseRecommendation`.
  - Funciones `getNotifications()` y `markNotificationRead()` usan ahora `Notification[]`.

- `frontend/src/components/NotificationBell.tsx`:
  - Importada `useNavigate` de react-router-dom.
  - Variable de estado ahora es `Notification[]` en lugar de `ContentNotification[]`.
  - Nuevo método `handleRecommendationClick()` para navegar al curso recomendado.
  - Lógica de renderizado: detecta tipo de notificación (`event`) y muestra:
    - Para `COURSE_RECOMMENDED`: "Curso recomendado", área, tecnología, botón "Ver curso recomendado".
    - Para `NEW_CONTENT` / `UPDATED_CONTENT`: Comportamiento existente.

### Tests

**Backend (Jest):**
- Ejecutar: `npm test` (en `backend/`)
- Todos los tests pasan (215 tests, incluidos 8 nuevos para `RecommendationsService`).

**Frontend (Cypress):**
- Archivo creado: `frontend/cypress/e2e/hu24-recommendations.cy.ts`
- Casos de prueba:
  1. Ejecuta la tarea de recomendaciones y el alumno recibe notificaciones.
  2. Marca recomendaciones como leídas y navega al curso.
  3. Rechaza intento de ejecutar recomendaciones sin permisos ADMIN.
- Ejecutar: `npm run cypress:run -- --spec cypress/e2e/hu24-recommendations.cy.ts` (en `frontend/`)

**Postman:**
- Nuevo request en la colección: `POST /notifications/recommendations/run` (solo ADMIN).
- Devuelve status 200 con body `{ totalStudents: number; totalNotifications: number }`.
- Status 403 para roles que no sean ADMIN.

## Algoritmo de Recomendación

1. **Perfil de Intereses:** Para cada alumno, calcula pesos acumulados:
   - Por cada curso inscripto: peso = 1 + (avance_en_porcentaje / 100).
   - Agrupa por categoría y tecnología (normalizadas: lowercase, trim).
   - Resultado: dos diccionarios `categoryWeights` y `technologyWeights`.

2. **Candidatos:** Filtra cursos:
   - Publicados (`isPublished: true`).
   - Activos.
   - De la institución del alumno.
   - En los que NO está inscripto.
   - Que NO se le han recomendado previamente.

3. **Ranking:** Para cada candidato:
   - Puntaje = pesoCategoria + pesoTecnologia (normalizadas).
   - Filtra solo con puntaje > 0.
   - Ordena por: puntaje (desc) → inscriptos (desc) → createdAt (desc).
   - Selecciona máximo 3.

4. **Notificaciones:** Crea registros sin duplicados:
   - event: `COURSE_RECOMMENDED`
   - courseId, courseName, topicId: null, topicTitle: null

## Decisiones de Diseño

- **Enum extendido:** `ContentEvent` incluye `COURSE_RECOMMENDED` sin romper HU-17 (notificaciones de contenido siguen funcionando).
- **Nullable topicTitle:** Permite una única tabla de notificaciones para ambos tipos.
- **Tarea semanal:** Lunes 09:00 UTC (configurable vía `@Cron`).
- **Máximo 3 por alumno:** Como especifica la HU.
- **Normalización simple:** lowercase + trim (frágil con strings libres; mejora futura: tabla de categorías).
- **Sin modelo IA:** Algoritmo determinista basado en pesos acumulados.
- **Endpoint ADMIN:** Para ejecutar manualmente en tests y demos.
- **Índice único parcial:** Refuerza en BD la prohibición de duplicados.

## Validación

- ✅ Backend compila: `npm run build` (0 errores).
- ✅ Tests backend pasan: `npm test` (215 tests, 215 passed).
- ✅ Frontend compila: `npm run build` (0 errores TypeScript).
- ✅ Migraciones aplican limpias: `prisma migrate reset --force` (14 migraciones).
- ✅ Seed ejecuta sin errores.

## Fuera de Alcance

- Modelos de machine learning o deep learning.
- Recomendaciones por email.
- Preferencias explícitas del alumno.
- Panel de recomendaciones en el catálogo.
- Tabla de categorías predefinidas (mejora futura).

## Notas Finales

1. La normalización de categoría y tecnología es frágil porque son strings libres. Se recomienda fuertemente crear tablas de categorías predefinidas para V4.
2. La tarea programada se ejecuta una vez por semana. Si el servidor tiene múltiples instancias, se ejecutará en cada instancia (sin mecanismo de lock); para un entorno con replicas, se recomienda usar una cola de trabajos (Bull, RQ, etc.) o un scheduler centralizado.
3. El endpoint `POST /notifications/recommendations/run` permite ejecutar manualmente la tarea en tests y demos.
4. La versión de @nestjs/schedule utiliza `node-cron` internamente; el formato es standard cron (`0 9 * * 1` = lunes 09:00).
