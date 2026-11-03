# Prompt de implementación: HU-5: Curso. Contenido. Video

Sos un desarrollador senior full-stack trabajando en el repositorio PECOD. Tu tarea es implementar (o auditar y completar) la historia de usuario descrita abajo de punta a punta: base de datos, backend, frontend y tests, siguiendo las convenciones del repositorio.

## Modo de trabajo

**Esta HU ya está implementada en el repositorio.** No dupliques código ni crees módulos paralelos. Usá este prompt de dos maneras:

1. **Para implementarla desde cero** (por ejemplo en una rama limpia o un proyecto nuevo con la misma arquitectura): seguí las decisiones de diseño y el plan, y respetá los nombres de rutas y modelos indicados.
2. **Para auditarla en el repo actual**: recorré uno por uno los criterios de aceptación contra el código y los tests, listá en tu plan qué criterios están cubiertos, cuáles parcialmente y cuáles no, corregí los desvíos y agregá los tests que falten. No cambies comportamiento que ya cumple un criterio.

Los nombres de archivos y rutas de abajo salen de una lectura del repo; si algo no coincide, priorizá lo que verifiques en el código y avisalo en el plan.

## Contexto del repositorio

PECOD es una plataforma educativa multi-institucional (multi-tenant) de cursos on-demand. Monorepo con:

- `backend/`: NestJS + Prisma + PostgreSQL. Módulos en `backend/src/<modulo>/` (controller, service, dto, `*.service.spec.ts`). Esquema en `backend/prisma/schema.prisma`, migraciones en `backend/prisma/migrations/`, seed en `backend/prisma/seed.ts`.
- `frontend/`: React + TypeScript + Tailwind. Páginas en `frontend/src/pages/`, componentes en `frontend/src/components/`, hooks en `frontend/src/hooks/`, cliente HTTP en `frontend/src/api/` (Axios con interceptor JWT en `client.ts`), contexto de sesión en `frontend/src/context/AuthContext`, rutas en `frontend/src/App.tsx` con `routes/ProtectedRoute.tsx`.
- Tests: Jest en backend (`npm test` en `backend/`) usando `createMockPrismaService()` de `backend/src/test-utils/mock-prisma.ts`; Cypress e2e en `frontend/cypress/e2e/` (helpers `cy.seedFullScenario` y `cy.apiLogin` en `frontend/cypress/support/commands.ts`); colección Postman en `postman/PECOD.postman_collection.json`.
- Archivos en S3 con subida directa desde el navegador mediante URLs prefirmadas (`UploadsService`). El código actual **no** integra Mux aunque el documento de herramientas lo mencione: no lo incorpores salvo que se pida.

### Convenciones que debés respetar

- Los comentarios del código referencian la HU (por ejemplo `// HU12: ...`) y los mensajes de error y de UI están en español.
- DTOs con `class-validator`/`class-transformer`, con mensajes en español.
- Aislamiento por institución: el JWT trae `role` e `institutionId`; todo acceso a datos filtra por la institución del usuario autenticado (salvo el Administrador de Sistema). Nunca tomes `institutionId` de un body o query para usuarios que no sean ADMIN.
- Roles con `@Roles(...)` y `RolesGuard`; endpoints protegidos con `JwtAuthGuard`.
- Si agregás un modelo de Prisma, agregalo también a `createMockPrismaService()`.
- Migraciones: carpeta con timestamp; deben aplicarse limpias sobre una base vacía.
- Antes de codificar, explorá los archivos indicados y escribí un plan breve en `.agents/tasks/plan-<hu>.md` (hallazgos, cambios por capa, riesgos). No pises el `plan.md` existente.

## Historia de usuario

- **Versión:** V1
- **Cómo:** Profesor
- **Quiero:** Crear un curso cargando información en formatos de texto y video.
- **Para:** Ofrecer contenido educativo a los alumnos de la institución.

### Criterios de aceptación

1. El curso solo se guarda si están completos los campos obligatorios (nombre, descripción, área/categoría, tecnología, temario).
2. Si faltan datos obligatorios, el sistema informa los errores de validación y no permite continuar.
3. Se pueden cargar videos en los formatos y tamaños permitidos, quedando asociados al tema correspondiente.
4. El Profesor puede cargar un video ya existente desde un archivo de su dispositivo, como alternativa a grabarlo mediante la funcionalidad de HU6.
5. El sistema acepta archivos de video en formato MP4, MOV o WebM; cualquier otro formato es rechazado con un mensaje indicando los formatos válidos.
6. Se rechazan archivos de video con formato o peso no soportado, informando el motivo. El tamaño máximo es 500 MB por archivo y la duración máxima del video es de 30 minutos.
7. Una vez publicado, el curso queda disponible en el catálogo de su institución correspondiente.

Cada criterio debe tener al menos un test que lo cubra.

## Ubicación en el código y estado actual

- Alta de curso: `POST /courses` (PROFESSOR) con `create-course.dto.ts`; temas con `POST /courses/:courseId/topics` (`create-topic.dto.ts`); publicación con `PATCH /courses/:id/publish`.
- Video: `POST /uploads/presigned-url` (`UploadsService`: formatos MP4, MOV y WebM; máximo 500 MB; mensaje "Formato de video no soportado. Formatos válidos: MP4, MOV, WebM." y "El video supera el tamaño máximo de 500 MB.") y `POST|DELETE /topics/:topicId/video` con `attach-video.dto.ts` (`videoDurationSeconds` con `@Max(1800)`).
- Frontend: `pages/CourseEditorPage.tsx` y `components/TopicMediaUploader.tsx` (subida directa a S3 con la URL prefirmada, duración leída del elemento de video).
- Tests: `uploads.service.spec.ts`, `topics.service.spec.ts`, `courses.service.spec.ts`.
- **Desvíos respecto de los criterios (verificalos y corregilos)**: (1) en `CreateCourseDto` el campo `technology` es `@IsOptional()`, aunque HU-5 lo exige como obligatorio (el formulario de `ProfessorCoursesPage.tsx` sí lo marca `required`, y el editor permite vaciarlo con `saveField({ technology: draftTechnology || null })`); (2) el temario se carga después de crear el curso (`POST /courses/:courseId/topics`) y `setPublished()` no valida nada, así que hoy se puede publicar un curso sin temas.

## Decisiones de diseño y reglas de negocio

- El curso solo se guarda con nombre, descripción, área/categoría, tecnología y temario completos; si faltan, se informan los errores de validación y no se continúa.
- Validar el formato y el tamaño **antes** de emitir la URL prefirmada, y de nuevo la duración (máx. 1800 s) al asociar el video al tema.
- El video queda asociado al tema (`Topic.videoUrl` y `videoDurationSeconds`); guardar la clave/URL de S3, no el archivo.
- Una vez publicado, el curso aparece en el catálogo de su institución.
- El Profesor solo opera sobre sus cursos y sobre temas de sus cursos.
- Cierre de los desvíos: `technology` pasa a ser obligatoria en el alta y no se puede vaciar al editar; y la **publicación** exige los campos obligatorios completos y al menos un tema en el temario (con mensaje que indique qué falta). Documentá esta interpretación en el plan: el temario es obligatorio en el momento de publicar, no en el de crear el borrador.

## Plan de implementación

**Backend**: DTOs con mensajes, validación de tipo/tamaño/duración, asociación del video al tema, publicación.
**Frontend**: formulario de curso con validación y errores por campo, carga de video con barra de progreso, mensajes claros ante formato, peso o duración inválidos.
**Tests**: Jest de formatos válidos e inválidos, valores límite de tamaño (500 MB y 500 MB + 1 byte) y de duración (1800 s y 1801 s), campos obligatorios, curso ajeno; Cypress con alta de curso, carga de video y publicación; Postman de upload y attach.

## Casos borde y restricciones

- Alternativa de HU-6: el Profesor puede subir un archivo ya existente o grabar la pantalla; ambos deben convivir.
- Si falla la subida a S3, el curso y el resto del contenido no se pierden.

## Fuera de alcance

Transcodificación o streaming adaptativo (Mux), subtítulos y edición de video.

## Dependencias

Base de HU-6, HU-7, HU-8, HU-13 y HU-14. Alimenta HU-1.

## Definition of Done

- Cada criterio de aceptación tiene al menos un test que lo cubra (Jest, Cypress o Postman, según corresponda), y todos pasan.
- `npm test` en `backend/` y `npm run build` y `npm run lint` en `frontend/` pasan sin errores.
- No hay regresiones en las HU relacionadas (ver Dependencias).
- No hay secretos, credenciales ni datos sensibles hardcodeados ni en logs.
- Resumen final: criterios verificados, desvíos corregidos, tests agregados y lo que quedó pendiente.
