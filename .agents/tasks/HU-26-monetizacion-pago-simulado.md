# Prompt de implementación: HU-26: Monetización de cursos (pago simulado con tarjeta de prueba)

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

- **Cómo:** Profesor y Alumno
- **Quiero:** Como Profesor, ofrecer cursos pagos en mi institución y, como Alumno, pagar para inscribirme a ellos mediante un pago simulado con una tarjeta de prueba.
- **Para:** Permitir que las instituciones ofrezcan cursos pagos y que los Alumnos accedan a ellos una vez aprobado el pago.

### Criterios de aceptación

1. El Profesor puede definir un curso como gratuito (valor por defecto) o pago, indicando un precio mayor a 0 en pesos argentinos (ARS) con hasta 2 decimales, al crear el curso (HU-5) o al editarlo (HU-14). Un precio inválido se rechaza con un mensaje de validación.
2. El catálogo (HU-1) y el detalle del curso (HU-4) muestran el precio de los cursos pagos y la leyenda “Gratuito” en los demás.
3. Para un curso pago, el detalle muestra la opción “Pagar” en lugar de inscribirse. Al seleccionarla, el sistema abre una pantalla de pago de la propia plataforma que muestra el nombre del curso y el monto, con un formulario de tarjeta de crédito: número de tarjeta, titular, vencimiento (MM/AA) y código de seguridad (CVV). Todos los campos son obligatorios.
4. La pantalla muestra un aviso visible con la leyenda “Entorno de pruebas: no ingreses datos reales de tarjetas” y el listado de las tarjetas de prueba disponibles con el resultado que produce cada una. No se realiza ningún cobro real.
5. Antes de procesar el pago, el sistema valida que el número tenga 16 dígitos y supere el control de dígito verificador (algoritmo de Luhn), que el titular no esté vacío (hasta 60 caracteres), que el vencimiento tenga formato MM/AA con mes entre 01 y 12 y sea igual o posterior al mes actual, y que el CVV tenga 3 dígitos. Si algún dato es inválido, el sistema informa los errores y no procesa el pago.
6. Solo se aceptan las tarjetas de prueba definidas por la plataforma. Cualquier otro número, aunque supere el control de Luhn, se rechaza con el mensaje “Tarjeta no habilitada en el entorno de pruebas” sin procesar el pago. Esta validación se realiza también en el backend.
7. El resultado depende de la tarjeta de prueba utilizada y es siempre el mismo: 4242 4242 4242 4242 produce pago aprobado; 4000 0000 0000 9995 produce pago rechazado por fondos insuficientes; 4000 0000 0000 0002 produce pago rechazado por tarjeta rechazada.
8. Al aprobarse el pago, el sistema registra el pago y crea la inscripción en una única operación, y el curso pasa a estar disponible en “Mis cursos” (HU-3) con una confirmación visual.
9. Si el pago es rechazado, el sistema informa el motivo, no crea la inscripción y permite reintentar con los mismos u otros datos.
10. El número completo de la tarjeta y el CVV nunca se almacenan ni se registran en logs. De cada operación solo se conservan la marca de la tarjeta y sus últimos 4 dígitos.
11. El sistema registra cada operación de pago con Alumno, curso, monto, moneda, estado (aprobado o rechazado), motivo del rechazo, marca y últimos 4 dígitos de la tarjeta y fecha. El monto registrado es el precio vigente al momento de la operación.
12. El Alumno no puede inscribirse a un curso pago sin un pago aprobado. El sistema rechaza también cualquier intento de inscripción directa a un curso pago (HU-2).
13. Confirmar más de una vez el mismo pago aprobado (por ejemplo, por un doble clic) no genera una doble inscripción ni un doble registro de pago aprobado.
14. Un Alumno ya inscripto no puede volver a pagar el mismo curso (HU-2). No es posible pagar un curso despublicado ni de otra institución (HU-2, HU-10).
15. Cambiar el precio de un curso no afecta a los Alumnos ya inscriptos. Si un curso gratuito pasa a ser pago, los Alumnos ya inscriptos mantienen su acceso sin pagar.
16. Quedan fuera del alcance de V3: la integración con una pasarela de pago real (por ejemplo, Mercado Pago o Stripe), reembolsos, cupones, múltiples monedas, facturación y rendición de cobros a las instituciones. Una pasarela real, que recibe los datos de tarjeta en su propio sitio, reemplazaría este formulario en una versión futura.

Cada criterio debe tener al menos un test que lo cubra.

## Estado actual del código relevante

- `Course` no tiene precio. `EnrollmentsService.enroll()` (en `backend/src/enrollments/`) crea la inscripción de forma inmediata y gratuita: aplica las reglas de HU-2 (curso publicado, sin doble inscripción, misma institución). Verificá la restricción única de `Enrollment`.
- DTOs de curso: `backend/src/courses/dto/create-course.dto.ts` y `update-course.dto.ts`. Frontend: `CourseEditorPage.tsx`, `CatalogPage.tsx`, `CourseDetailPage.tsx`, `MyCoursesPage.tsx`.
- No hay ninguna pasarela ni modelo de pagos.

## Decisiones de diseño (ya tomadas)

- **Es una simulación**: no se integra ninguna pasarela real. Debe poder reemplazarse por una real en el futuro, así que aislá la lógica en un `PaymentProcessor` (interfaz) con una implementación `SimulatedPaymentProcessor`.
- **Precio**: `Course.price Decimal? @db.Decimal(10,2)`; `null` o ausente significa gratuito. Si se informa, debe ser mayor a 0 con hasta 2 decimales. Moneda fija ARS.
- **Modelo `Payment`**: `id`, `studentId`, `courseId`, `amount`, `currency` (por defecto "ARS"), `status` (enum `APPROVED` | `REJECTED`), `rejectionReason?`, `cardBrand`, `cardLast4`, `createdAt`. El monto es el precio vigente al momento de la operación.
- **Tarjetas de prueba (lista cerrada, definida como constante)**:
  - `4242 4242 4242 4242`: pago aprobado.
  - `4000 0000 0000 9995`: rechazado por fondos insuficientes.
  - `4000 0000 0000 0002`: rechazado por tarjeta rechazada.
  Cualquier otro número, aunque pase Luhn, se rechaza con "Tarjeta no habilitada en el entorno de pruebas" **sin procesar**. Esta validación va también en el backend.
- **Validaciones del formulario (frontend y backend)**: número de 16 dígitos con Luhn; titular no vacío (máx. 60); vencimiento `MM/AA` con mes 01 a 12 e igual o posterior al mes actual; CVV de 3 dígitos. Aceptá espacios en el número y normalizalos.
- **Endpoint**: `POST /courses/:courseId/payments` (rol STUDENT) con `cardNumber`, `holderName`, `expiry`, `cvv`. Si el pago es aprobado, en **una sola transacción** se crea el `Payment` y la inscripción.
- **Idempotencia**: confirmar dos veces no debe duplicar inscripción ni pago aprobado. Resolvelo con la unicidad existente de la inscripción y un índice único parcial sobre `Payment(studentId, courseId)` donde `status = 'APPROVED'` (migración con SQL crudo); ante `P2002` devolvé el resultado ya existente.
- **Bloqueo de inscripción gratuita**: `enroll()` debe rechazar cursos con precio mayor a 0 (por ejemplo 403 con el mensaje "Este curso es pago"). Sin esto, cualquiera se inscribiría sin pagar.
- **Datos de tarjeta**: el número completo y el CVV **nunca** se persisten ni se escriben en logs (revisá interceptores, filtros de excepciones y cualquier `console.log`). Solo se guardan marca y últimos 4 dígitos. Del lado del frontend no los guardes en `localStorage` ni en estado global, y limpiá el formulario al terminar.
- Cambiar el precio no afecta a inscriptos. Si un curso gratuito pasa a ser pago, los inscriptos conservan el acceso.

## Plan de implementación sugerido

**Base de datos**
1. `Course.price`, modelo `Payment`, enum de estado, índice único parcial y migración; `payment` en `mock-prisma.ts`.

**Backend**
2. Agregar `price` opcional a los DTOs de curso con validación (mayor a 0, hasta 2 decimales) y exponerlo en catálogo, detalle y listados del Profesor.
3. Módulo `payments`: `PaymentsController`, `PaymentsService` (validaciones, Luhn, tabla de tarjetas, transacción), `PaymentProcessor` + `SimulatedPaymentProcessor`.
4. Modificar `EnrollmentsService.enroll()` para rechazar cursos pagos; reutilizar la lógica de creación de inscripción dentro de la transacción del pago.
5. Reglas de HU-2 también en el pago: curso publicado, misma institución, Alumno no inscripto previamente.

**Frontend**
6. Campo de precio en `CourseEditorPage` (alta y edición). Precio o "Gratuito" en `CatalogPage` y `CourseDetailPage`. Para cursos pagos, botón "Pagar" en lugar de inscribirse.
7. `PaymentPage` (`/cursos/:id/pagar`): resumen (curso y monto), aviso destacado "Entorno de pruebas: no ingreses datos reales de tarjetas", listado de las tarjetas de prueba con su resultado, formulario con validaciones y máscara, deshabilitar el botón mientras se procesa, resultado aprobado (confirmación y redirección a "Mis cursos") o rechazado (motivo y reintento).

**Tests**
8. Jest: Luhn y casos límite (15 y 17 dígitos, letras), vencimiento (mes 00, 13, mes actual, mes pasado), CVV de 2 y 4 dígitos, titular vacío y de 61 caracteres, las tres tarjetas, tarjeta válida por Luhn pero no habilitada, doble confirmación, curso gratuito, curso despublicado, otra institución, ya inscripto, inscripción directa a un curso pago (rechazada), cambio de precio con inscriptos, y que ningún dato de tarjeta aparezca en lo persistido.
9. Cypress: flujo aprobado hasta "Mis cursos", rechazo por fondos insuficientes y por tarjeta rechazada con reintento, tarjeta no habilitada, validaciones del formulario y doble clic.
10. Postman: pago con cada tarjeta, datos inválidos y el rechazo de `POST` de inscripción directa a un curso pago.

## Casos borde y restricciones

- Redondeo y representación de `Decimal` en la API (devolvelo como string o número de forma consistente y documentala).
- Un curso despublicado no puede pagarse (HU-2).
- Evitá que el mensaje de error de validación repita el valor ingresado de la tarjeta.

## Fuera de alcance

Pasarela real (Mercado Pago, Stripe), reembolsos, cupones, múltiples monedas, facturación, rendición a las instituciones y webhooks.

## Dependencias y orden

Independiente. Toca inscripciones (HU-2, HU-3), catálogo y detalle (HU-1, HU-4) y edición de curso (HU-5, HU-14). Antes de empezar leé cómo se crea hoy la inscripción.

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
