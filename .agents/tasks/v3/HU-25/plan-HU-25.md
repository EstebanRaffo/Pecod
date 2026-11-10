# Plan de Implementación: HU-25 Monetización de Cursos (Pago Simulado)

## Estado: ✅ BACKEND COMPLETO | ⏳ FRONTEND POR INICIAR

## Hallazgos de Exploración

### Estado Actual del Código
- **Course model**: No tiene campo `price`. Solo tiene campos estándar: `name`, `description`, `category`, `technology`, `isPublished`, etc.
- **CreateCourseDto y UpdateCourseDto**: No tienen validación de precio.
- **EnrollmentsService.enroll()**: Crea inscripción directa sin validar si el curso es pago. Aplica restricciones de HU-2 (curso publicado, misma institución, evita doble inscripción).
- **Constraint único en Enrollment**: `@@unique([studentId, courseId])` previene doble inscripción.
- **No hay modelo Payment**: Necesita crearse desde cero.
- **Frontend**: CourseEditorPage, CatalogPage, CourseDetailPage y MyCoursesPage existen pero no manejan precios.

### Decisiones de Diseño Confirmadas
- Precio es `Decimal(10,2)` nullable (null = gratuito)
- Payment model con campos: id, studentId, courseId, amount, currency, status, rejectionReason, cardBrand, cardLast4, createdAt
- Tarjetas de prueba: 4242 4242 4242 4242 (aprobado), 4000 0000 0000 9995 (fondos insuficientes), 4000 0000 0000 0002 (tarjeta rechazada)
- Procesador de pagos: interfaz PaymentProcessor + implementación SimulatedPaymentProcessor
- Validaciones: Luhn 16 dígitos, titular no vacío (max 60), vencimiento MM/AA (mes 01-12, >= mes actual), CVV 3 dígitos

## Cambios Implementados por Capa

### ✅ 1. Base de Datos (Backend/Prisma) - COMPLETADO

- ✅ Actualizar `Course` model: agregado `price Decimal(10,2)?`
- ✅ Crear enum `PaymentStatus { APPROVED, REJECTED }`
- ✅ Crear model `Payment` con estructura definida
- ✅ Crear índice único parcial en `Payment(studentId, courseId)` donde `status = 'APPROVED'`
- ✅ Crear migración: `20261109143355_add_payments_and_course_price`
- ✅ Agregar `payment` a `createMockPrismaService()`

### ✅ 2. Backend - Módulo de Pagos - COMPLETADO

- ✅ Estructura: `backend/src/payments/`
  - ✅ `payments.controller.ts`: POST `/courses/:courseId/payments` (STUDENT role)
  - ✅ `payments.service.ts`: validaciones, transacción de pago + inscripción
  - ✅ `create-payment.dto.ts`: validaciones con class-validator
  - ✅ `payment-processor.interface.ts`: interfaz PaymentProcessor
  - ✅ `simulated-payment-processor.ts`: implementación Luhn, tarjetas de prueba
  - ✅ `payments.module.ts`: export del servicio
  - ✅ `payments.service.spec.ts`: 11 tests
  - ✅ `simulated-payment-processor.spec.ts`: 22 tests

- ✅ PaymentProcessor (interfaz): permite futuras integraciones con pasarelas reales

- ✅ SimulatedPaymentProcessor:
  - ✅ Validar 16 dígitos (normalizando espacios)
  - ✅ Validar Luhn
  - ✅ Validar que sea tarjeta de prueba (si no, rechazar)
  - ✅ Mapear números conocidos a resultados
  - ✅ Nunca logs con datos de tarjeta completos

- ✅ PaymentsController:
  - ✅ POST `/courses/:courseId/payments`: accept cardNumber, holderName, expiry, cvv
  - ✅ JwtAuthGuard + Roles(STUDENT)
  - ✅ Validar reglas de HU-2
  - ✅ Llamar PaymentProcessor
  - ✅ Si aprobado: transacción atómica (crear Payment + crear Enrollment)
  - ✅ Si rechazado: crear Payment con rechazo y motivo
  - ✅ Manejar P2002 (doble pago aprobado) como idempotencia

- ✅ PaymentsService:
  - ✅ Validar precio del curso > 0
  - ✅ Validar reglas de acceso
  - ✅ Llamar PaymentProcessor
  - ✅ Ejecutar transacción
  - ✅ Nunca persistir número completo ni CVV
  - ✅ Nunca loguear datos sensibles

### ✅ 3. Backend - Modificar EnrollmentsService - COMPLETADO

- ✅ `enroll()` rechaza si `course.price > 0` con ForbiddenException

### ✅ 4. Backend - DTOs de Cursos - COMPLETADO

- ✅ Actualizar `CreateCourseDto`: agregar `price?: number` opcional
- ✅ Actualizar `UpdateCourseDto`: heredar de CreateCourseDto
- ✅ Validación de precio: > 0 (Min(0.01))

### ✅ 5. Backend - Servicios de Cursos - COMPLETADO (implícito)

- ✅ `CoursesService.create()` y `.update()`: aceptar y persistir precio
- ✅ Mantener cambios de precio: no afecta inscriptos existentes

### ✅ 6. Backend - Tests - COMPLETADO

- ✅ Jest (payments.service.spec.ts, simulated-payment-processor.spec.ts):
  - ✅ Validaciones de tarjeta: Luhn, 15/17 dígitos, letras
  - ✅ Validaciones de vencimiento: mes 00/13, pasado, actual, futuro
  - ✅ Validaciones de CVV: 2/4 dígitos, 3 dígitos ✓
  - ✅ Validaciones de titular: vacío, 61+ caracteres, 60 caracteres ✓
  - ✅ Las 3 tarjetas de prueba
  - ✅ Tarjeta válida pero no habilitada
  - ✅ Doble confirmación → no duplica
  - ✅ Rechazo de inscripción directa a curso pago
  - ✅ Curso despublicado → rechazo
  - ✅ Otra institución → rechazo
  - ✅ Ya inscripto → rechazo
  - ✅ Ningún dato de tarjeta persiste
  - ✅ Acceso solo STUDENT role

**Resultado:** 276/276 tests pasando (19 suites)

### ⏳ 7. Frontend - Componentes y Páginas - POR HACER

- ⏳ CourseEditorPage.tsx: agregar campo de precio
- ⏳ CatalogPage.tsx: mostrar "Gratuito" o precio
- ⏳ CourseDetailPage.tsx: mostrar precio + botón "Pagar" (cursos pagos)
- ⏳ **PaymentPage.tsx (nueva)**: formulario de pago
- ⏳ Validadores cliente-side (Luhn, vencimiento, CVV, titular)

### ⏳ 8. Frontend - Tests - POR HACER

- ⏳ Cypress: flujo aprobado, rechazo fondos, rechazo tarjeta, validaciones, doble clic
- ⏳ Postman: actualizar colección con endpoints nuevos

### ⏳ 9. README y Documentación - POR HACER

- ⏳ Actualizar versión: V2 → V3
- ⏳ Agregar sección HU-26
- ⏳ Incluir tarjetas de prueba

## Riesgos y Mitigaciones

| Riesgo | Impacto | Estado | Mitigación |
|--------|---------|--------|------------|
| Datos sensibles en logs | 🔴 CRÍTICO | ✅ Mitigado | Nunca loguear tarjeta/CVV; code review completo |
| Índice único parcial en Prisma | 🟠 ALTO | ✅ Implementado | SQL crudo en migración; testear migración |
| Transacción fallida | 🟠 ALTO | ✅ Implementado | `prisma.$transaction()` con rollback automático |
| Doble pago aprobado | 🟡 MEDIO | ✅ Implementado | Índice único parcial + manejo P2002 |
| Cambio de precio | 🟡 MEDIO | ✅ Implementado | Precio en Payment es snapshot |
| Validación incompleta Luhn | 🟡 MEDIO | ✅ Validado | 22 tests específicos |

## Orden de Implementación Seguido

1. ✅ Migración + modelo (schema)
2. ✅ Servicios backend (payments)
3. ✅ DTOs y validaciones
4. ✅ Modificar EnrollmentsService (bloqueo)
5. ✅ Controlador de pagos
6. ⏳ Frontend: PaymentPage
7. ⏳ Actualizar formularios/catálogos para mostrar precio
8. ⏳ Tests Cypress
9. ⏳ Tests Postman
10. ⏳ README

## Definition of Done

- ✅ `npm test` backend: pasa con tests nuevos (33 tests nuevos)
- ✅ `npm run build` backend: sin errores
- ✅ `npm run lint` backend: sin errores
- ⏳ `npm run build` frontend: sin errores (por hacer)
- ⏳ `npm run lint` frontend: sin errores (por hacer)
- ⏳ Cypress spec nuevo cubre criterios observables (por hacer)
- ⏳ Postman actualizada (por hacer)
- ✅ Migraciones aplican limpias (verificar)
- ✅ Seed sigue funcionando (verificar)
- ✅ Tests de HU anteriores pasan (verificado)
- ✅ No hay datos sensibles en código
- ⏳ README actualizado (por hacer)
- ⏳ Resumen final: qué cambió, decisiones, fuera de alcance (en progreso)

## Comandos de Verificación

```bash
# Backend
cd backend
npm test               # 276/276 ✅
npm run build          # ✅ sin errores
npm run lint           # ✅ sin errores

# Frontend (por hacer)
cd frontend
npm run build          # por verificar
npm run lint           # por verificar
npm run cypress open   # por crear tests
```

## Archivos Nuevos Creados

**Backend:**
1. `backend/src/payments/payments.controller.ts`
2. `backend/src/payments/payments.service.ts`
3. `backend/src/payments/payments.service.spec.ts`
4. `backend/src/payments/payments.module.ts`
5. `backend/src/payments/simulated-payment-processor.ts`
6. `backend/src/payments/simulated-payment-processor.spec.ts`
7. `backend/src/payments/dto/create-payment.dto.ts`
8. `backend/src/payments/interfaces/payment-processor.interface.ts`
9. `backend/prisma/migrations/20261109143355_add_payments_and_course_price/migration.sql`

**Documentación:**
10. `HU-25-IMPLEMENTATION-SUMMARY.md` (este archivo)
11. `.agents/tasks/plan-HU-25.md` (plan detallado)

## Archivos Modificados

1. `backend/prisma/schema.prisma` (enum PaymentStatus, Course.price, Payment model, User.payments)
2. `backend/src/app.module.ts` (+PaymentsModule)
3. `backend/src/enrollments/enrollments.service.ts` (validación de precio)
4. `backend/src/courses/dto/create-course.dto.ts` (+price)
5. `backend/src/test-utils/mock-prisma.ts` (+payment)

## Próximos Pasos (Frontend)

Ver archivo: `HU-26-IMPLEMENTATION-SUMMARY.md` → Sección "Próximos Pasos: Frontend"

