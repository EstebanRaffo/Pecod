# Prompt de implementación: HU-21: Panel de analíticas para el Profesor

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

- **Cómo:** Profesor
- **Quiero:** Ver un panel con indicadores de mis cursos: cantidad de Alumnos inscriptos, avance promedio y calificación promedio.
- **Para:** Conocer el alcance y la recepción de mis cursos para decidir qué contenido actualizar.

### Criterios de aceptación

1. El Profesor accede al panel desde su menú. El panel lista todos sus cursos (publicados, despublicados y borradores) y muestra, por curso, la cantidad de Alumnos inscriptos, el porcentaje de avance promedio, la calificación promedio y la cantidad de reseñas (HU-20).
2. El porcentaje de avance promedio es el promedio de los porcentajes individuales de los Alumnos inscriptos (HU-16), redondeado con Math.round. Si el curso no tiene inscriptos o no tiene temas, se muestra 0% sin error.
3. La calificación promedio es el promedio de estrellas con un decimal (HU-20). Si el curso no tiene reseñas, se muestra “Sin calificaciones”.
4. Los indicadores se calculan al abrir el panel y reflejan las nuevas inscripciones, los temas agregados o eliminados y las reseñas creadas, editadas o eliminadas.
5. El panel muestra únicamente datos agregados; no expone información individual de los Alumnos.
6. Un curso despublicado mantiene sus indicadores, ya que sus Alumnos inscriptos conservan el acceso (HU-8).
7. El Profesor visualiza solo los indicadores de los cursos que le pertenecen (HU-8). Un usuario con otro rol no puede acceder al panel (HU-10).
8. Si el Profesor no tiene cursos, se muestra el mensaje “Sin cursos para analizar”, con acceso directo a la creación de un curso (HU-5).

Cada criterio debe tener al menos un test que lo cubra.

## Estado actual del código relevante

- Datos disponibles: `Enrollment`, `TopicProgress` (temas vistos por Alumno), `Topic` por curso, `Course` con `professorId`, y `CourseReview` (HU-20).
- El avance individual se calcula como `Math.round(vistos / totales * 100)` y un curso sin temas da 0% (HU-16). Reutilizá el helper compartido creado en HU-20 si ya existe.
- Rutas del Profesor en `frontend/src/App.tsx` (`/profesor/cursos`, `/profesor/cursos/:id`) y página `pages/ProfessorCoursesPage.tsx`; menú en `components/NavBar.tsx`.

## Decisiones de diseño (ya tomadas)

- Endpoint `GET /professor/analytics` (rol PROFESSOR): devuelve un arreglo con un ítem por curso propio, incluyendo publicados, despublicados y borradores: `courseId`, `title`, `status`, `enrolledCount`, `averageProgress`, `ratingAverage`, `ratingCount`.
- `averageProgress` = promedio de los porcentajes individuales de cada inscripto (cada uno ya redondeado según HU-16), redondeado a entero con `Math.round`. Sin inscriptos o sin temas: 0.
- `ratingAverage`: un decimal o `null` (el frontend muestra "Sin calificaciones").
- Solo datos agregados: no devolver nada identificable de Alumnos individuales.
- Sin caché: se calcula al consultar. Evitá N+1: usá consultas agregadas (`groupBy`/`count`) y calculá los promedios en memoria sobre resultados acotados a los cursos del Profesor.

## Plan de implementación sugerido

**Backend**
1. Módulo `analytics` con `AnalyticsController` (`@Roles('PROFESSOR')`) y `AnalyticsService`. Tomar el id del Profesor siempre del JWT.
2. Implementar las consultas agregadas y el cálculo de promedios descritos arriba.

**Frontend**
3. `api/analytics.ts`, página `ProfessorAnalyticsPage.tsx` en `/profesor/analiticas` protegida por rol, enlace en `NavBar` para el Profesor, tabla o tarjetas por curso, estado vacío "Sin cursos para analizar" con enlace a la creación de curso (HU-5), y formato "Sin calificaciones".

**Tests**
4. Jest: promedios con distintos porcentajes (verificá el redondeo), curso sin inscriptos, curso sin temas, curso sin reseñas, curso despublicado que conserva indicadores, Profesor que solo ve sus cursos, roles no autorizados (403).
5. Cypress: Profesor con dos cursos y varios Alumnos con progresos distintos ve los valores esperados; Profesor sin cursos ve el mensaje.
6. Postman: request del panel con token de Profesor y de Alumno (403).

## Casos borde y restricciones

- Alumnos con baja o inscripciones de otro curso no deben afectar los números.
- Temas agregados o eliminados después de que los Alumnos avanzaron: el promedio se recalcula.
- Un Profesor nunca debe poder ver indicadores de cursos de otro Profesor, ni de otra institución.

## Fuera de alcance

Gráficos históricos, exportación a CSV, filtros por fecha, métricas por tema o por evaluación, y datos individuales de Alumnos.

## Dependencias y orden

Requiere HU-20 (calificación promedio y cantidad de reseñas).

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
