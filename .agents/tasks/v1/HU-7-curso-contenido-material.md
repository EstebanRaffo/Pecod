# Prompt de implementación: HU-7: Curso. Contenido. Material

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
- **Quiero:** Agregar información adicional como contenido teórico desde archivos externos.
- **Para:** Complementar el video de la clase con material de lectura o consulta.

### Criterios de aceptación

1. Se pueden adjuntar archivos en los formatos soportados (PDF, Excel, Word, TXT), quedando disponibles para los Alumnos inscriptos. El tamaño máximo es de 10 MB por archivo.
2. Se rechazan archivos con formatos no soportados, informando cuáles son los válidos.
3. Los cambios (edición o eliminación) sobre material ya publicado se reflejan de inmediato para los Alumnos.

Cada criterio debe tener al menos un test que lo cubra.

## Ubicación en el código y estado actual

- `POST /topics/:topicId/materials` (`add-material.dto.ts`) y `DELETE /topics/:topicId/materials/:materialId`; modelo `Material` (nombre, URL de S3, tipo y tamaño).
- `UploadsService`: tipos de contenido PDF, Excel, Word y TXT (`MATERIAL_CONTENT_TYPES`) y `MAX_MATERIAL_BYTES = 10 MB`; descarga con URL firmada de lectura (`generatePresignedGetUrl`, 1 hora).
- Frontend: sección de materiales en `components/TopicMediaUploader.tsx`.
- Tests: `uploads.service.spec.ts`, `topics.service.spec.ts`.

## Decisiones de diseño y reglas de negocio

- Formatos soportados: PDF, Excel, Word y TXT; cualquier otro se rechaza informando los válidos. Máximo 10 MB por archivo.
- Los archivos quedan disponibles solo para los Alumnos inscriptos (URL firmada de corta duración, nunca un enlace público permanente).
- Editar o eliminar un material publicado se refleja de inmediato para los Alumnos.
- No confiar solo en la extensión: validar también el `Content-Type` declarado.

## Plan de implementación

**Backend**: validación de tipo y tamaño en la emisión de la URL y en `addMaterial`; eliminación con permisos de propietario.
**Frontend**: carga de archivos con validación previa, lista de materiales con eliminar y mensajes de error.
**Tests**: Jest de los cuatro formatos, uno inválido, límites de 10 MB y 10 MB + 1 byte, eliminación, Profesor ajeno; Cypress de adjuntar y ver el material como Alumno.

## Casos borde y restricciones

- Nombres de archivo con caracteres especiales o muy largos.
- Si se elimina un tema, sus materiales deben quedar consistentes (definí el comportamiento y documentalo).

## Fuera de alcance

Vista previa de archivos, versionado de materiales y antivirus.

## Dependencias

Depende de HU-5. Notifica a los alumnos según HU-17. El material escrito es HU-13.

## Definition of Done

- Cada criterio de aceptación tiene al menos un test que lo cubra (Jest, Cypress o Postman, según corresponda), y todos pasan.
- `npm test` en `backend/` y `npm run build` y `npm run lint` en `frontend/` pasan sin errores.
- No hay regresiones en las HU relacionadas (ver Dependencias).
- No hay secretos, credenciales ni datos sensibles hardcodeados ni en logs.
- Resumen final: criterios verificados, desvíos corregidos, tests agregados y lo que quedó pendiente.
