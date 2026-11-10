# Prompt de implementación: HU-24: Foro de consultas por curso

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

- **Cómo:** Alumno y Profesor
- **Quiero:** Realizar y responder consultas sobre un tema puntual de un curso.
- **Para:** Resolver dudas sobre el contenido dictado con ayuda del Profesor y de otros Alumnos.

### Criterios de aceptación

1. El Alumno inscripto puede crear una consulta en el foro del curso, asociada a un tema del temario. Son obligatorios el tema, el título (hasta 120 caracteres) y el contenido (hasta 2000 caracteres); si faltan datos o se superan los límites, el sistema informa los errores y no la guarda.
2. El Profesor propietario del curso y los Alumnos inscriptos pueden responder una consulta. La respuesta es obligatoria y admite hasta 2000 caracteres.
3. El foro lista las consultas del curso de la más reciente a la más antigua, con título, tema, autor, fecha y cantidad de respuestas, en páginas de 20 consultas. Es posible filtrar por tema. El detalle de una consulta muestra sus respuestas en orden cronológico.
4. Solo acceden al foro de un curso los Alumnos inscriptos y el Profesor propietario. Un Alumno no inscripto, un Profesor ajeno al curso o un usuario de otra institución no pueden verlo ni participar (HU-10).
5. Los Alumnos inscriptos en un curso despublicado mantienen el acceso al foro, tanto para leer como para participar (HU-8).
6. Un usuario puede eliminar sus propias consultas y respuestas. El Profesor propietario puede eliminar cualquier consulta o respuesta de su curso. La eliminación requiere una confirmación previa mediante un Popup con los botones Confirmar y Cancelar, y eliminar una consulta elimina también sus respuestas.
7. El contenido del foro es solo texto, sin archivos adjuntos ni formato enriquecido, y se muestra siempre como texto, sin interpretar código HTML.
8. Si se elimina un tema del temario, sus consultas se conservan y se identifican como “Tema eliminado”.
9. En V3 el foro no genera notificaciones (HU-17).

Cada criterio debe tener al menos un test que lo cubra.

## Estado actual del código relevante

- No existe ningún modelo de foro. **Atención**: ya existe un modelo Prisma llamado `Question` (preguntas de evaluaciones, HU-11). Nombrá los modelos del foro `ForumThread` y `ForumPost` para evitar colisión.
- El componente de confirmación Popup con "Confirmar" y "Cancelar" (`ConfirmDialog`) está definido dentro de `components/TopicMediaUploader.tsx`; extraelo a `components/ConfirmDialog.tsx` para reutilizarlo sin duplicar.
- Acceso por inscripción: `Enrollment` (Alumno-curso). Propiedad del curso: `Course.professorId`. Un curso despublicado conserva el acceso de sus inscriptos (HU-8).
- Páginas relacionadas: `pages/CourseLearningPage.tsx` (Alumno), `pages/CourseEditorPage.tsx` (Profesor).

## Decisiones de diseño (ya tomadas)

- Modelos: `ForumThread` (`id`, `courseId`, `topicId?` con `onDelete: SetNull`, `authorId`, `title`, `body`, `createdAt`, `updatedAt`) y `ForumPost` (`id`, `threadId` con cascada, `authorId`, `body`, `createdAt`). Índices por `(courseId, createdAt)`.
- Límites: título hasta 120 caracteres, contenido y respuestas hasta 2000, todos obligatorios, y el tema es obligatorio al crear una consulta.
- **Control de acceso centralizado** en un helper del módulo `forum`: un usuario accede si es Alumno inscripto en el curso (de su institución) o Profesor propietario del curso. El resto recibe 403 o 404.
- Borrado: el autor puede borrar lo propio; el Profesor propietario puede borrar cualquier consulta o respuesta de su curso. Borrar una consulta borra sus respuestas. Siempre con confirmación en la UI.
- Contenido solo texto. El backend hace `trim` y valida longitud; el frontend lo renderiza siempre como texto (React escapa por defecto: **no** uses `dangerouslySetInnerHTML`). Sin adjuntos ni formato enriquecido.
- Si se elimina un tema, las consultas se conservan y se muestran con "Tema eliminado".
- Paginación de 20 consultas por página, más reciente primero, con filtro opcional por `topicId`. El detalle de una consulta muestra sus respuestas en orden cronológico.
- **El foro no genera notificaciones** en V3 (no toques `Notification`).

## Plan de implementación sugerido

**Base de datos**
1. `ForumThread` y `ForumPost` + migración; ambos en `mock-prisma.ts`.

**Backend**
2. Módulo `forum`: `GET /courses/:courseId/forum/threads?page=&topicId=`, `POST /courses/:courseId/forum/threads`, `GET /forum/threads/:id`, `POST /forum/threads/:id/posts`, `DELETE /forum/threads/:id`, `DELETE /forum/posts/:id`. Solo el Alumno inscripto crea consultas; Alumnos inscriptos y el Profesor propietario responden.

**Frontend**
3. Extraer `ConfirmDialog`. `api/forum.ts`. `ForumPage` accesible desde `CourseLearningPage` (Alumno) y `CourseEditorPage` (Profesor), con listado paginado, filtro por tema, formulario de nueva consulta, detalle con respuestas, y borrado con confirmación según los permisos.

**Tests**
4. Jest: validaciones de longitud y obligatoriedad, acceso de Alumno inscripto / no inscripto / otra institución / Profesor ajeno, borrado propio y moderación del Profesor, borrado en cascada, tema eliminado, curso despublicado, paginación de 20.
5. Cypress: crear una consulta, responderla desde la cuenta del Profesor, borrar con confirmación (Confirmar y Cancelar), verificar que un texto con `<script>` se muestra como texto.
6. Postman: requests del foro con casos de acceso denegado.

## Casos borde y restricciones

- Pruebas de seguridad: un Alumno de otra institución o no inscripto no debe poder listar, leer ni escribir (verificar también por id directo de hilo o de respuesta).
- Evitá `include` anidados sin límite: paginá siempre el listado y no traigas todas las respuestas en la lista.

## Fuera de alcance

Notificaciones del foro, adjuntos, edición de consultas y respuestas, votos o 'mejor respuesta', búsquedas de texto completo y moderación por el Administrador.

## Dependencias y orden

Independiente del resto, pero reutiliza el diálogo de confirmación de HU-8. Se recomienda corregir antes la validación de institución de `GET /courses/:id`.

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
