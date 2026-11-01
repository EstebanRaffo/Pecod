# Prompt de implementación: HU-24: Recomendación de cursos

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

- **Cómo:** Alumno
- **Quiero:** Recibir una notificación con cursos recomendados en función de mi historial y mi avance.
- **Para:** Descubrir cursos de mi institución afines a mis intereses sin tener que buscarlos en el catálogo.

### Criterios de aceptación

1. El sistema genera recomendaciones mediante una tarea programada que se ejecuta una vez por semana, y las entrega como notificaciones dentro de la plataforma, en el mismo ícono “campana” y listado de HU-17.
2. Las recomendaciones se basan en el historial de inscripciones del Alumno, su avance (HU-16) y sus áreas de interés, entendidas como el área de conocimiento y la tecnología de los cursos en los que está inscripto. Las áreas y tecnologías con mayor presencia y mayor avance tienen prioridad.
3. Solo se recomiendan cursos publicados y activos de la institución del Alumno en los que no está inscripto (HU-1, HU-2, HU-10).
4. Cada notificación recomienda un único curso e informa: nombre del curso, área de conocimiento, tecnología y fecha y hora de generación. El tipo de evento es “Curso recomendado”. Al seleccionarla, el Alumno accede al detalle del curso (HU-4).
5. Se generan como máximo 3 recomendaciones por Alumno en cada ejecución de la tarea.
6. Un mismo curso no se vuelve a recomendar a un Alumno que ya recibió esa recomendación, haya sido leída o no.
7. Si el Alumno no tiene inscripciones o no existen cursos que cumplan los criterios, no se genera ninguna notificación y no se produce ningún error.
8. Las notificaciones de recomendación se pueden marcar como leídas y se ordenan junto con las de HU-17 de la más reciente a la más antigua. El ícono permanece en rojo mientras haya notificaciones no leídas.
9. Si al abrir una recomendación el curso ya no está publicado, el sistema informa que no está disponible. Si el Alumno ya se inscribió, la notificación lo lleva directamente a su contenido (HU-4).
10. Cada Alumno visualiza únicamente sus propias notificaciones de recomendación.

Cada criterio debe tener al menos un test que lo cubra.

## Estado actual del código relevante

- El modelo `Notification` solo sirve para contenido: `topicTitle String` es obligatorio, `event` es el enum `ContentEvent` con `NEW_CONTENT` y `UPDATED_CONTENT`, y la creación ocurre en `TopicsService` dentro de la transacción de cambios del temario.
- Servicio y controller en `backend/src/notifications/`. En el frontend: `components/NotificationBell.tsx` y `api/notifications.ts` (el tipo `ContentNotification` solo conoce los dos eventos de contenido).
- `Course` tiene `category` y `technology` como **strings libres**. El catálogo compara categoría sin distinguir mayúsculas y tecnología con "contiene". No existe ningún job programado ni `@nestjs/schedule`.
- Datos para el perfil de intereses: `Enrollment` y `TopicProgress` (avance por curso, HU-16).

## Decisiones de diseño (ya tomadas)

- **Generalizar la notificación sin romper HU-17**: agregar el valor `COURSE_RECOMMENDED` al enum de eventos, y hacer `topicTitle` nullable (migración segura para los datos existentes). Para una recomendación: `courseId` = curso recomendado, `courseName` = su nombre, `topicId` y `topicTitle` en null. Área y tecnología se obtienen del curso relacionado al leer.
- **Tarea programada**: `@nestjs/schedule`, una ejecución por semana (por ejemplo lunes 09:00). Exponé `RecommendationsService.generateForAllStudents()` como método público y un endpoint solo ADMIN `POST /notifications/recommendations/run` para poder ejecutarlo en demos y tests.
- **Perfil de intereses del Alumno**: para cada curso en el que está inscripto, peso = `1 + avance/100`. Acumulá el peso por categoría y por tecnología, normalizadas (minúsculas y sin espacios sobrantes).
- **Candidatos**: cursos publicados y activos de la misma institución en los que el Alumno no está inscripto y que no se le hayan recomendado antes.
- **Puntaje**: `pesoCategoria + pesoTecnologia`. Solo candidatos con puntaje mayor a 0. Desempate por cantidad de inscriptos descendente y luego por fecha de creación descendente. Máximo 3 recomendaciones por Alumno por ejecución, una notificación por curso.
- **Sin duplicados**: antes de crear, verificá que no exista una notificación `COURSE_RECOMMENDED` para ese par Alumno-curso (hacelo en código y, si es viable, reforzalo con un índice único parcial en la migración con SQL crudo). No uses un `@@unique` simple sobre `(studentId, courseId, event)`: rompería las notificaciones de contenido repetidas de HU-17.
- Alumno sin inscripciones o sin candidatos: no se genera nada y no es un error.

## Plan de implementación sugerido

**Base de datos**
1. Migración: nuevo valor de enum, `topicTitle` nullable, índice único parcial opcional.

**Backend**
2. `RecommendationsService` con el algoritmo descrito, usando consultas por lote (no una consulta por Alumno por curso).
3. `@Cron` semanal y endpoint ADMIN de ejecución manual.
4. Ajustar `NotificationsService` para devolver `courseName`, `category`, `technology` y `event` correctos, tolerando `topicTitle` nulo.

**Frontend**
5. Extender los tipos de `api/notifications.ts`; en `NotificationBell` mostrar "Curso recomendado", nombre del curso, área, tecnología y fecha; al hacer clic marcar como leída y navegar al detalle del curso. Si el curso ya no está publicado, mostrar que no está disponible. El ícono sigue en rojo mientras haya no leídas y el orden sigue siendo de más reciente a más antigua, mezclado con las de HU-17.

**Tests**
6. Jest: perfil con varios cursos y avances, ranking y desempate, máximo 3, no repetir, Alumno sin inscripciones, sin candidatos, otra institución excluida, cursos despublicados excluidos, normalización ("Programación" vs "programacion " cuentan igual), regresión de las notificaciones de contenido de HU-17.
7. Cypress: ejecutar la tarea vía el endpoint ADMIN y verificar la campana del Alumno; marcar como leída; curso despublicado.
8. Postman: endpoint de ejecución manual con ADMIN y con otros roles (403).

## Casos borde y restricciones

- La normalización de `category` y `technology` es frágil porque son strings libres; dejá anotada la mejora (tablas de categorías) pero no la hagas en esta HU.
- Si el Alumno se inscribe a un curso después de recibir su recomendación, al abrirla debe llevarlo a su contenido.
- Ejecución duplicada de la tarea el mismo día: no debe generar duplicados.

## Fuera de alcance

Modelos de IA o aprendizaje automático, recomendaciones por email, preferencias declaradas por el Alumno y un panel de recomendaciones en el catálogo.

## Dependencias y orden

Se apoya en las notificaciones de HU-17. Conviene tener HU-20 (para desempatar por calificación si se desea), pero no es obligatorio.

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
