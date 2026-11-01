# Prompt de implementación: HU-20: Calificación y reseñas de cursos

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
- **Quiero:** Calificar con estrellas y dejar una reseña de un curso en el que estoy inscripto.
- **Para:** Compartir mi valoración del curso y ayudar a otros Alumnos a decidir si les conviene.

### Criterios de aceptación

1. El Alumno inscripto puede calificar un curso cuando lo finalizó (cumple las condiciones de HU-18) o cuando tiene al menos 50% de avance (HU-16).
2. Si el Alumno no cumple ninguna de las dos condiciones, la opción de calificar se muestra deshabilitada e informa qué falta.
3. La calificación es obligatoria y consiste en un número entero de 1 a 5 estrellas. El comentario es opcional y admite hasta 1000 caracteres; si se supera, el sistema informa el límite y no guarda la reseña.
4. Cada Alumno tiene una única reseña por curso. Puede editarla o eliminarla; al hacerlo, el promedio del curso se recalcula y, si la edita, se actualiza la fecha de modificación.
5. Un Alumno no inscripto en el curso no puede calificarlo. Los Profesores y Administradores no pueden calificar cursos.
6. El detalle del curso (HU-4) muestra el promedio de estrellas (promedio aritmético con un decimal), la cantidad de reseñas y el listado de reseñas ordenado de la más reciente a la más antigua, con nombre del Alumno, estrellas, comentario y fecha.
7. El catálogo (HU-1) muestra el promedio y la cantidad de reseñas de cada curso. Si un curso no tiene reseñas, se muestra “Sin calificaciones”.
8. Los Alumnos inscriptos en un curso despublicado mantienen la posibilidad de calificarlo, editar o eliminar su reseña (HU-8). El curso despublicado no aparece en el catálogo.
9. Cada usuario visualiza únicamente las reseñas de cursos de su propia institución (HU-10).
10. En V3 el Profesor no puede editar ni eliminar las reseñas de sus cursos; no hay moderación de reseñas.

Cada criterio debe tener al menos un test que lo cubra.

## Estado actual del código relevante

- No existe ningún modelo de reseñas ni de calificaciones.
- La condición de "curso finalizado" (100% de temas vistos y todas las evaluaciones aprobadas; si no hay evaluaciones alcanza con el 100%; un curso sin temas no está finalizado) está **duplicada** en `enrollments.service.ts` (`myCourses`) y en `certificates.service.ts`. El avance se calcula como `Math.round(vistos / totales * 100)` (HU-16).
- Catálogo: `CoursesService` (método de catálogo) filtra por categoría (igualdad sin distinguir mayúsculas) y tecnología (contiene). Detalle: `CoursesService.findDetail`.
- Frontend: `pages/CatalogPage.tsx`, `pages/CourseDetailPage.tsx`, `pages/MyCoursesPage.tsx`.

## Decisiones de diseño (ya tomadas)

- Modelo nuevo `CourseReview`: `id`, `courseId`, `studentId`, `rating Int`, `comment String?`, `createdAt`, `updatedAt`, con `@@unique([courseId, studentId])` y relaciones con `onDelete: Cascade`.
- Elegibilidad para calificar: inscripto en el curso Y (curso finalizado según HU-18 O avance >= 50%). Implementala en un provider compartido (por ejemplo `CourseCompletionService` en un módulo propio) y **refactorizá `myCourses` y `CertificatesService` para usarlo**, sin cambiar su comportamiento. Los tests existentes de ambos deben seguir pasando.
- `rating`: entero 1 a 5. `comment`: opcional, máximo 1000 caracteres.
- Un curso despublicado mantiene la posibilidad de reseñar/editar/eliminar para los Alumnos inscriptos, pero no aparece en el catálogo.
- Promedio = media aritmética con un decimal. Sin reseñas: "Sin calificaciones".
- Para el catálogo evitá N+1: calculá promedio y cantidad con una sola consulta agregada (`groupBy`) para todos los cursos de la página. No denormalices en `Course` en esta HU.
- El Profesor no puede editar ni borrar reseñas (sin moderación en V3).

## Plan de implementación sugerido

**Base de datos**
1. Modelo `CourseReview` + migración; agregarlo a `mock-prisma.ts`.

**Backend**
2. Crear `CourseCompletionService` (helper reutilizable: avance, finalizado, elegibilidad para reseñar) y refactorizar `EnrollmentsService.myCourses` y `CertificatesService` para usarlo.
3. Módulo `reviews`: `POST /courses/:courseId/reviews`, `PATCH /courses/:courseId/reviews/me`, `DELETE /courses/:courseId/reviews/me`, `GET /courses/:courseId/reviews` (más reciente primero; nombre del Alumno, estrellas, comentario, fecha). Solo rol STUDENT escribe; validar inscripción, elegibilidad e institución.
4. Incluir `ratingAverage` y `ratingCount` en la respuesta del catálogo y del detalle; incluir además la reseña propia y la elegibilidad (con el motivo si no es elegible) en el detalle para el Alumno inscripto.

**Frontend**
5. `api/reviews.ts`; sección de reseñas en `CourseDetailPage` (promedio, cantidad, listado, formulario de estrellas y comentario con contador, editar y eliminar la propia, control deshabilitado con el motivo cuando no es elegible); estrellas y cantidad en `CatalogPage`.

**Tests**
6. Jest: elegibilidad (50% exacto, 49%, finalizado sin evaluaciones, curso sin temas), unicidad por Alumno, rango y longitud, Alumno no inscripto, Profesor/Admin intentando reseñar, promedio con un decimal, curso despublicado, otra institución, y regresión de `myCourses` y certificados tras el refactor.
7. Cypress: Alumno con 50% de avance reseña; Alumno con 40% ve el control deshabilitado; editar y eliminar; catálogo muestra promedio.
8. Postman: requests de reseñas con casos válidos e inválidos.

## Casos borde y restricciones

- Verificá cómo `findDetail` filtra hoy por institución: según lo relevado, `GET /courses/:id` no valida que el curso pertenezca a la institución del usuario y expone `contentText` a Alumnos no inscriptos. Si sigue así, corregilo en esta HU o dejalo documentado como bug separado, pero las reseñas **no** deben ser visibles entre instituciones.
- Reseña cuando el Alumno es eliminado del curso o el curso se elimina: cascada.
- Editar la reseña actualiza `updatedAt` y recalcula el promedio.

## Fuera de alcance

Moderación por el Profesor, respuestas a reseñas, votos de utilidad, reseñas con imágenes, y ordenar el catálogo por calificación.

## Dependencias y orden

Precondición técnica: extraer la lógica de "curso finalizado" a un helper compartido (ver plan). Conviene tener corregida la validación de institución en `GET /courses/:id` (ver Restricciones). La HU-21 depende de esta.

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
