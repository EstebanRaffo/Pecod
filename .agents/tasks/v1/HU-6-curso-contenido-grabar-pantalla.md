# Prompt de implementación: HU-6: Curso. Contenido. Grabar pantalla

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
- **Quiero:** Grabar una clase compartiendo mi pantalla al dar de alta un curso.
- **Para:** Generar material audiovisual explicativo sin depender de herramientas externas de grabación.

### Criterios de aceptación

1. El Profesor puede iniciar una grabación de pantalla desde el alta del curso, previa autorización de permisos del navegador.
2. Al finalizar la grabación, el video se genera y se asocia automáticamente a la clase en edición.
3. Si la grabación se cancela antes de finalizar, no se genera ni guarda ningún archivo parcial.
4. Ante errores durante la grabación (pérdida de conexión, permisos revocados), el sistema notifica el fallo y permite reintentar sin perder el resto del curso ya cargado.
5. Si se supera una duración o peso máximo definido (30 minutos o 500 MB, mismo límite que HU5), el sistema informa el límite alcanzado.

Cada criterio debe tener al menos un test que lo cubra.

## Ubicación en el código y estado actual

- Hook `frontend/src/hooks/useScreenRecorder.ts` (usa `getDisplayMedia` y `MediaRecorder` con `video/webm`) y su uso en `components/TopicMediaUploader.tsx` ("Grabar pantalla" / "Volver a grabar pantalla").
- Backend: `POST|DELETE /topics/:topicId/screen-recording` con `attach-screen-recording.dto.ts` (`@Max(1800)`) que persiste `Topic.screenRecordingUrl`; la subida a S3 reutiliza `POST /uploads/presigned-url`.
- Tests: `topics.service.spec.ts` y `uploads.service.spec.ts`; no hay un spec de Cypress específico (la grabación depende de permisos del navegador).
- Detalle verificado del hook: `MAX_DURATION_SECONDS = 1800` con un temporizador que detiene la grabación; si el usuario corta el uso compartido desde el navegador (`onended` del track) se trata como finalizar, no como cancelar; `cancel()` marca la cancelación y no se genera ningún blob; si se deniega el permiso el error es "No se pudo iniciar la grabación (permisos denegados o cancelados).".
- **Desvío**: el hook limita la duración, pero el límite de 500 MB solo se valida después, al pedir la URL prefirmada.

## Decisiones de diseño y reglas de negocio

- Pedir el permiso del navegador al iniciar. Si el usuario lo deniega o lo revoca durante la grabación, informar y permitir reintentar.
- Cancelar antes de finalizar **no** genera ni sube ningún archivo parcial.
- Al finalizar, subir a S3 con URL prefirmada y asociar automáticamente el video al tema en edición.
- Ante errores (pérdida de conexión, permisos revocados) mostrar un aviso y permitir reintentar sin perder el resto del curso cargado.
- Límites: 30 minutos y 500 MB. Detener automáticamente la grabación al alcanzar uno y avisar cuál se alcanzó, reutilizando las constantes de HU-5.
- Cierre del desvío: antes de subir, comprobar el tamaño del archivo grabado contra los 500 MB e informar el límite alcanzado sin perder el resto del curso (el límite de duración ya se aplica con el corte automático).

## Plan de implementación

**Frontend**: completar el hook (estados: inactivo, grabando, subiendo, error), temporizador, corte automático, cancelación sin residuos y manejo de errores.
**Backend**: validar duración y asociar al tema.
**Tests**: Jest del attach (límite 1800/1801 s); pruebas del hook con `MediaRecorder` y `getDisplayMedia` mockeados (permiso denegado, cancelación, límite alcanzado, error de subida); Cypress con los mocks de `getDisplayMedia`.

## Casos borde y restricciones

- `MediaRecorder` solo está disponible en navegadores modernos: verificar soporte y avisar si no existe.
- Liberar los tracks del stream al terminar o cancelar, para que el navegador deje de mostrar que se comparte la pantalla.
- Un tema puede tener a la vez video subido y grabación de pantalla; decidí y documentá cuál se muestra primero al Alumno.

## Fuera de alcance

Edición de la grabación, webcam y audio configurable.

## Dependencias

Depende de HU-5. Notifica a los alumnos según HU-17.

## Definition of Done

- Cada criterio de aceptación tiene al menos un test que lo cubra (Jest, Cypress o Postman, según corresponda), y todos pasan.
- `npm test` en `backend/` y `npm run build` y `npm run lint` en `frontend/` pasan sin errores.
- No hay regresiones en las HU relacionadas (ver Dependencias).
- No hay secretos, credenciales ni datos sensibles hardcodeados ni en logs.
- Resumen final: criterios verificados, desvíos corregidos, tests agregados y lo que quedó pendiente.
