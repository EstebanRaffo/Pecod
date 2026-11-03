# Prompt de implementación: HU-18: Certificado de finalización

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

- **Versión:** V2
- **Cómo:** Alumno.
- **Quiero:** Descargar un Certificado de finalización en formato PDF una vez que completé y aprobé el curso.
- **Para:** Tener una constancia de que completé y aprobé el curso.

### Criterios de aceptación

1. La opción “Descargar certificado” se habilita en la cursada únicamente cuando el Alumno inscripto cumple ambas condiciones: tiene el 100% de avance, es decir, todos los temas vistos (HU-16), y aprobó todas las evaluaciones del curso, incluidas las de cierre (HU-12). Si el curso no tiene evaluaciones, alcanza con el 100% de avance.
2. Un curso sin temas no se considera finalizado, por lo que no habilita el certificado.
3. Mientras no se cumplan las condiciones, la opción se muestra deshabilitada e informa qué falta: temas sin ver y/o evaluaciones sin aprobar. El sistema rechaza además cualquier solicitud de certificado que no cumpla las condiciones.
4. Si el Alumno agotó los intentos de una evaluación sin aprobarla (HU-12), no puede obtener el certificado y el sistema se lo informa.
5. El certificado se genera en formato PDF e incluye: nombre del Alumno, nombre del curso, nombre de la institución, nombre del Profesor, fecha de emisión y un código único de certificado.
6. La primera descarga registra la emisión del certificado. Las descargas posteriores entregan el mismo certificado (mismo código y fecha de emisión), aunque luego el Profesor agregue temas o evaluaciones al curso.
7. Solo el Alumno titular, inscripto en el curso, puede descargar su certificado. Un Alumno no puede acceder al certificado de otro Alumno ni de cursos de otra institución.
8. Un Alumno inscripto en un curso despublicado que cumple las condiciones mantiene la posibilidad de descargar su certificado (HU-8).
9. “Mis cursos” identifica los cursos finalizados con certificado disponible.

Cada criterio debe tener al menos un test que lo cubra.

## Ubicación en el código y estado actual

- `GET /courses/:courseId/certificate/status` y `GET /courses/:courseId/certificate` (STUDENT) en `certificates.controller.ts`; `CertificatesService` genera el PDF con `pdf-lib`, valida elegibilidad (`evaluateEligibility`) y devuelve mensajes específicos (temas sin ver, evaluaciones sin aprobar, intentos agotados, curso sin temas).
- Modelo `Certificate` (uno por inscripción, código único, fecha de emisión). La primera descarga registra la emisión y las siguientes devuelven el mismo código y fecha.
- Frontend: opción "Descargar certificado" en la cursada y marca de finalizado en Mis cursos.
- Nota: la lógica de "curso finalizado" está duplicada entre `myCourses` y este servicio.
- Tests: `certificates.service.spec.ts`, `cypress/e2e/certificates.cy.ts`.
- `certificates.service.ts` compara los intentos contra un `2` escrito a mano (`evalAttempts.length >= 2`), separado del `MAX_ATTEMPTS` de `EvaluationsService`: hay que unificar el límite (ver HU-12 y HU-19).

## Decisiones de diseño y reglas de negocio

- El certificado se habilita solo con 100% de avance y todas las evaluaciones aprobadas (incluidas las de cierre); sin evaluaciones alcanza con el 100%. Un curso sin temas no se considera finalizado.
- Mientras no se cumplan las condiciones, la opción se muestra deshabilitada e informa qué falta; el backend rechaza la solicitud igualmente.
- Si agotó los intentos de una evaluación sin aprobarla, no puede obtenerlo y se le informa.
- El PDF incluye nombre del Alumno, curso, institución, Profesor, fecha de emisión y código único.
- Descargas posteriores entregan el mismo certificado aunque luego se agreguen temas o evaluaciones.
- Solo el Alumno titular inscripto lo descarga; no accede a certificados de otros ni de otra institución.
- Un curso despublicado no impide la descarga si cumple las condiciones.

## Plan de implementación

**Backend**: mantener o extraer la evaluación de elegibilidad; asegurar la emisión idempotente (clave única por inscripción) y los controles de institución.
**Frontend**: botón deshabilitado con motivos, descarga del PDF, marca en Mis cursos.
**Tests**: Jest (cumple todo, falta un tema, falta una evaluación, intentos agotados, sin temas, sin evaluaciones, segunda descarga con el mismo código, curso con temas agregados después, otro alumno, otra institución, curso despublicado), Cypress (`certificates.cy.ts`), Postman (descarga y bloqueos).

## Casos borde y restricciones

- Doble clic en la primera descarga: no debe generar dos certificados (restricción única).
- Caracteres especiales (tildes, eñes) en nombres dentro del PDF.

## Fuera de alcance

Verificación pública del certificado por código, plantillas por institución y envío por email.

## Dependencias

Depende de HU-16 y HU-12 (condiciones) y HU-2. Su lógica de finalización se comparte con HU-20.

## Definition of Done

- Cada criterio de aceptación tiene al menos un test que lo cubra (Jest, Cypress o Postman, según corresponda), y todos pasan.
- `npm test` en `backend/` y `npm run build` y `npm run lint` en `frontend/` pasan sin errores.
- No hay regresiones en las HU relacionadas (ver Dependencias).
- No hay secretos, credenciales ni datos sensibles hardcodeados ni en logs.
- Resumen final: criterios verificados, desvíos corregidos, tests agregados y lo que quedó pendiente.
