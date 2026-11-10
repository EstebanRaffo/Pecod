# Plan de Implementación: HU-23 - Recomendación de Cursos

## Hallazgos de Exploración

### Base de datos actual
- Modelo `Notification` actual: `studentId`, `courseId`, `topicId`, `courseName`, `topicTitle`, `event` (enum `ContentEvent`), `createdAt`, `readAt`.
- Enum `ContentEvent` solo tiene `NEW_CONTENT` y `UPDATED_CONTENT`.
- Modelos relevantes: `User`, `Course`, `Enrollment`, `TopicProgress`.
- `Course` tiene `category` (string libre) y `technology` (string libre).
- No existe `@nestjs/schedule` ni ningún job programado actualmente.

### Frontend actual
- `NotificationBell.tsx` mostraría solo las notificaciones de contenido.
- Tipos en `api/notifications.ts`: `ContentNotification` con los 2 eventos de contenido.
- No hay componentes para visualizar recomendaciones de cursos.

### Estructura de migraciones
- Última migración: `20261025000000_add_certificates`.
- Las migraciones están nombradas con timestamp.

## Cambios por Capa

### 1. Base de datos (Migración Prisma)
**Archivo:** `backend/prisma/migrations/20261109000000_add_course_recommendations/migration.sql`

- Agregar valor `COURSE_RECOMMENDED` al enum `ContentEvent`.
- Hacer `topicTitle` nullable (STRING NULL en PostgreSQL).
- Crear índice único parcial para evitar duplicados: `CREATE UNIQUE INDEX ... ON notifications(studentId, courseId, event) WHERE event = 'COURSE_RECOMMENDED'`.
- Agregar índice en `(courseId, event)` para búsquedas de recomendaciones por curso.

**Cambio en schema.prisma:**
- `topicTitle` pasa de `String` a `String?`.
- El enum `ContentEvent` incluye `COURSE_RECOMMENDED`.

### 2. Backend

#### 2.1 Servicio de Recomendaciones (`backend/src/recommendations/recommendations.service.ts`)

**Responsabilidades:**
- `generateForAllStudents()`: método principal que:
  1. Obtiene todos los estudiantes activos de la plataforma.
  2. Para cada estudiante, calcula su perfil de intereses.
  3. Genera hasta 3 recomendaciones por estudiante.
  4. Crea las notificaciones correspondientes.
  5. Maneja errores sin romper (si un alumno sin inscripciones, continúa).

- `calculateStudentProfile(studentId: string)`: calcula el perfil de intereses:
  1. Obtiene todas las inscripciones del alumno.
  2. Para cada inscripción, obtiene el avance (TopicProgress).
  3. Calcula peso = 1 + (avance/100).
  4. Acumula peso por categoría y tecnología (normalizadas: lowercase, trim).
  5. Retorna un objeto con los pesos acumulados.

- `getCandidateCourses(studentId: string, institutionId: string)`: obtiene candidatos:
  1. Cursos publicados y activos de la institución.
  2. En los que el alumno no está inscripto.
  3. Que no se le hayan recomendado antes (no exista `COURSE_RECOMMENDED` para ese par).
  4. Retorna lista de cursos.

- `rankAndSelectCourses(candidates, profile)`: ranking y selección:
  1. Para cada candidato, calcula puntaje = pesoCategoria + pesoTecnologia (ambos normalizados).
  2. Filtra solo los con puntaje > 0.
  3. Ordena por puntaje desc, luego por inscriptos desc, luego por createdAt desc.
  4. Retorna máximo 3 cursos.

- `createNotifications(studentId, courses)`: crea notificaciones:
  1. Verifica que no exista una `COURSE_RECOMMENDED` para ese par (duplicados).
  2. Crea `Notification` con `event: COURSE_RECOMMENDED`, `courseId`, `courseName`, `topicId: null`, `topicTitle: null`.

**Inyección de dependencias:**
- `PrismaService`, `Logger` de NestJS.

#### 2.2 Módulo de Recomendaciones (`backend/src/recommendations/recommendations.module.ts`)
- Importa `PrismaModule`.
- Expone `RecommendationsService`.

#### 2.3 Integración con Notificaciones
**Archivo:** `backend/src/notifications/notifications.service.ts`

- Ajustar el método `list()` para devolver correctamente:
  - Para notificaciones con `event: COURSE_RECOMMENDED`: obtener `courseName` del campo y `category`, `technology` del curso relacionado.
  - Para notificaciones de contenido: mantener el comportamiento actual.
  
- El `NotificationsService` ya devuelve `topicTitle` que ahora puede ser null (compatible).

**Archivo:** `backend/src/notifications/notifications.controller.ts`

- Agregar endpoint `POST /notifications/recommendations/run` (solo ADMIN):
  - Ejecuta `RecommendationsService.generateForAllStudents()`.
  - Retorna resumen (ej: "10 notificaciones generadas").
  - Usado para tests y demos.

#### 2.4 Tarea Programada
**Archivo:** `backend/src/notifications/notifications.module.ts`

- Importar `ScheduleModule.forRoot()` de `@nestjs/schedule`.
- En `NotificationsService`, agregar decorador `@Cron('0 9 * * 1')` (lunes 09:00 UTC).
- El método correspondiente llama a `this.recommendationsService.generateForAllStudents()`.

#### 2.5 Actualizar `mock-prisma.ts`
- Agregar modelos si es necesario (usaremos solo los existentes).

### 3. Frontend

#### 3.1 Tipos (`frontend/src/api/notifications.ts`)
- Crear tipo `CourseRecommendation`:
  ```ts
  interface CourseRecommendation {
    id: string;
    courseId: string;
    courseName: string;
    category: string;
    technology: string | null;
    event: 'COURSE_RECOMMENDED';
    createdAt: string;
    readAt: string | null;
  }
  ```
- Crear unión: `type Notification = ContentNotification | CourseRecommendation`.

#### 3.2 Componente NotificationBell (`frontend/src/components/NotificationBell.tsx`)
- Actualizar para mostrar ambos tipos de notificaciones.
- Para recomendaciones: mostrar "Curso recomendado", nombre, área, tecnología, fecha.
- Al hacer clic en recomendación:
  1. Marcar como leída.
  2. Navegar a `/courses/{courseId}` (HU-4).
  3. Si el curso ya no está publicado, mostrar "Curso no disponible".
  4. Si el alumno ya está inscripto, ir directamente a contenido.

#### 3.3 Integración en App
- Las notificaciones se muestran en orden descendente por fecha (más recientes primero).
- El ícono permanece rojo mientras haya no leídas.

### 4. Tests

#### Backend Jest (`backend/src/recommendations/recommendations.service.spec.ts`)
Tests a cubrir:
1. Perfil de intereses: múltiples cursos con diferentes avances, normalización de categoría y tecnología.
2. Ranking: desempate por cantidad de inscriptos y por fecha.
3. Máximo 3 recomendaciones por alumno.
4. No repetir curso ya recomendado.
5. Alumno sin inscripciones: no genera nada, no es error.
6. Alumno sin candidatos: no genera nada.
7. Cursos despublicados excluidos.
8. Aislamiento por institución: alumno de inst A no ve cursos de inst B.
9. Duplicados evitados (check de índice único).

Tests de integración en `NotificationsService`:
10. `list()` devuelve recomendaciones con `category`, `technology`, `courseName`.
11. Endpoint ADMIN `POST /notifications/recommendations/run` ejecuta la tarea.
12. Regresión: notificaciones de contenido de HU-17 siguen funcionando.

#### Frontend Cypress (`frontend/cypress/e2e/recommendations.cy.ts`)
Nuevo test:
1. Ejecutar la tarea vía endpoint ADMIN.
2. Alumno con inscripciones ve notificaciones de recomendación.
3. Hacer clic en recomendación marca como leída y navega al curso.
4. Curso despublicado: mostrar que no está disponible.
5. Recomendaciones y notificaciones de contenido se mezclan en el mismo listado, ordenadas por fecha.

#### Postman
- Nuevo request: `POST /notifications/recommendations/run` (solo ADMIN, 403 para otros roles).
- Tests de status 200 y body con resumen.

### 5. Migraciones y Seed
- Migración limpia: aplicar desde cero.
- Seed: sin cambios necesarios (no genera datos de recomendaciones).

### 6. Documentación
- Actualizar README: HU-23 implementada, variable de entorno `CRON_SCHEDULE` (opcional), cómo probar manualmente.

## Riesgos y Mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Normalización frágil de categoría/tecnología (strings libres) | Anotar en README que se requiere tabla de categorías. No implementar en esta HU. |
| Duplicados en recomendaciones | Índice único parcial + verificación en código. |
| Performance con muchos estudiantes | Usar `createMany()` en lotes, no loop. |
| Ruptura de notificaciones de contenido | Hacer `topicTitle` nullable, devolver null sin error. |
| Alumno se inscribe después de recomendación | Al abrir recomendación, verificar si ya está inscripto; llevar directo al contenido. |
| Cron se ejecuta en múltiples instancias (si hay réplicas) | Usar lock en BD o aceptar duplicados eventuales (lo recomendado es usar job queue). |

## Decisiones Tomadas

1. **Enum extendido**: `ContentEvent` incluye `COURSE_RECOMMENDED` sin romper HU-17.
2. **Tarea semanal**: lunes 09:00 UTC (configurable vía `.env` si es necesario).
3. **Máximo 3 por alumno**: como especifica HU-23.
4. **Sin modelo IA**: usar perfil simple basado en pesos acumulados.
5. **Endpoint ADMIN**: para ejecutar manualmente en tests y demos.

## Orden de Implementación

1. Migración Prisma (schema.prisma + SQL).
2. `RecommendationsService` (sin scheduler aún).
3. Tests del service.
4. Integración en `NotificationsController` y `NotificationsService`.
5. Scheduler en módulo.
6. Tests de integración (Jest + Cypress).
7. Frontend: tipos y componentes.
8. Postman.
9. README.
