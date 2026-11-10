# Análisis de Implementación: HU-25 Monetización de Cursos

## 🔴 ESTADO ACTUAL: INCOMPLETO (Frontend)

### Estado del Backend ✅
- **Implementación:** COMPLETA
- **Tests:** 276/276 ✅ pasando
- **Base de datos:** Migración aplicada con campo `price` y tabla `payments`
- **APIs:** Todos los endpoints implementados
  - `POST /courses/:courseId/payments` - Procesar pagos
  - `GET /courses/:courseId/payments` - Historial de pagos
- **Validaciones:** Algoritmo de Luhn, tarjetas de prueba, rangos de valores
- **Seguridad:** No persiste número de tarjeta ni CVV, solo marca y últimos 4 dígitos

### Estado del Frontend ❌
- **Implementación:** INCOMPLETA
- **Falta:** Campo de precio en formularios de creación y edición de cursos
- **Falta:** Página de pago (PaymentPage)
- **Falta:** Actualización de interfaces TypeScript
- **Falta:** Visualización de precio en catálogo y detalle
- **Falta:** Lógica de redirección a pago vs inscripción

---

## 📋 Criterios de Aceptación de HU-25

### ❌ CA1 - Definir precio al crear/editar
**Estado:** ❌ NO IMPLEMENTADO EN FRONTEND

- **Backend:** ✅ DTOs tienen campo `price` (CreateCourseDto, UpdateCourseDto)
- **Frontend - Creación:** ❌ ProfessorCoursesPage.tsx NO tiene campo de precio
- **Frontend - Edición:** ❌ CourseEditorPage.tsx NO tiene campo de precio

### ❌ CA2 - Mostrar precio en catálogo y detalle
**Estado:** ❌ NO IMPLEMENTADO
- CatalogPage.tsx: No muestra precio
- CourseDetailPage.tsx: No muestra precio
- Interfaces TypeScript no incluyen campo `price`

### ❌ CA3-10 - Flujo de pago
**Estado:** ❌ NO IMPLEMENTADO
- PaymentPage.tsx: No existe
- Validador de tarjeta frontend: No existe
- Formulario de tarjeta: No existe
- Aviso de entorno de pruebas: No existe

---

## 🎯 Qué Falta Implementar en Frontend

### 1. Actualizar formulario de creación de cursos
📄 **Archivo:** `frontend/src/pages/ProfessorCoursesPage.tsx`

**Cambios necesarios:**
- Agregar estado `price` con useState
- Agregar input numérico para precio (opcional)
- Mostrar etiqueta "Gratuito" si no tiene precio
- Incluir `price` en POST a `/courses`
- Validación: permitir vacío, si tiene valor debe ser > 0 y máx 2 decimales

### 2. Actualizar formulario de edición de cursos
📄 **Archivo:** `frontend/src/pages/CourseEditorPage.tsx`

**Cambios necesarios:**
- Agregar estado `editingPrice` y `draftPrice`
- Agregar sección editable para precio
- Permitir cambio de precio en PATCH a `/courses/:id`
- Mostrar "Gratuito" si no hay precio

### 3. Actualizar interfaces TypeScript
📄 **Archivos:** 
- `CourseDetailPage.tsx`
- `CourseEditorPage.tsx`
- `CatalogPage.tsx`
- `ProfessorCoursesPage.tsx`

```typescript
interface CourseDetail {
  id: string;
  name: string;
  // ...
  price?: number;  // ← AGREGAR
}
```

### 4. Crear página de pago
📄 **Archivo:** `frontend/src/pages/PaymentPage.tsx` (NUEVA)

**Ruta:** `/courses/:id/pagar`

**Componentes necesarios:**
- Encabezado con nombre del curso y monto
- ⚠️ Aviso destacado: "Entorno de pruebas: no ingreses datos reales"
- 📊 Tabla con tarjetas de prueba disponibles:
  - 4242 4242 4242 4242 → Aprobado
  - 4000 0000 0000 9995 → Fondos insuficientes
  - 4000 0000 0000 0002 → Tarjeta rechazada
- 📝 Formulario de tarjeta con campos:
  - Número (XXXX XXXX XXXX XXXX) - 16 dígitos
  - Titular (hasta 60 caracteres)
  - Vencimiento (MM/AA)
  - CVV (●●●) - 3 dígitos
- 🎯 Procesar pago con validación
- ✅ Mostrar resultado (éxito/rechazo)
- 🔄 Opción de reintentar si falla

### 5. Actualizar catálogo
📄 **Archivo:** `frontend/src/pages/CatalogPage.tsx`

**Cambios necesarios:**
- Mostrar "Gratuito" o "$XXX ARS" en cada tarjeta de curso
- Agregar campo `price` a interfaz Course

### 6. Actualizar detalle de curso
📄 **Archivo:** `frontend/src/pages/CourseDetailPage.tsx`

**Cambios necesarios:**
- Mostrar precio o "Gratuito"
- Si es pago: botón "Pagar" → redirige a `/courses/:id/pagar`
- Si es gratuito: botón "Inscribirse" (comportamiento actual)
- Agregar campo `price` a interfaz CourseDetail

### 7. Crear validadores frontend
📄 **Archivo:** `frontend/src/utils/validation.ts` (NUEVO)

**Funciones necesarias:**
```typescript
export const luhnCheck = (cardNumber: string): boolean => { ... }
export const validateCardNumber = (num: string): string | null => { ... }
export const validateExpiry = (exp: string): string | null => { ... }
export const validateCVV = (cvv: string): string | null => { ... }
export const validateHolderName = (name: string): string | null => { ... }
```

---

## 📊 Tabla Comparativa

| Criterio | Backend | Frontend |
|----------|---------|----------|
| CA1 - Definir precio en creación | ✅ | ❌ |
| CA1 - Definir precio en edición | ✅ | ❌ |
| CA2 - Mostrar en catálogo | ✅ API | ❌ UI |
| CA2 - Mostrar en detalle | ✅ API | ❌ UI |
| CA3-9 - Flujo de pago completo | ✅ | ❌ |
| CA10 - No persistir datos sensibles | ✅ | N/A |
| CA11 - Registrar operación | ✅ | N/A |
| CA12 - Bloquear inscripción directa | ✅ | ❌ (no aplica si hay pago) |
| CA13 - Evitar doble inscripción | ✅ | N/A |
| CA14 - Validaciones de acceso | ✅ | ❌ (no hay validación FE) |
| CA15 - Cambio de precio no afecta inscritos | ✅ | N/A |

---

## 🛠️ Plan de Acción

**Orden recomendado:**

1. ✅ Actualizar interfaces TypeScript en frontend (5 min)
2. ✅ Agregar campo de precio a ProfessorCoursesPage.tsx (20 min)
3. ✅ Agregar campo de precio a CourseEditorPage.tsx (20 min)
4. ✅ Actualizar CatalogPage.tsx para mostrar precio (15 min)
5. ✅ Actualizar CourseDetailPage.tsx para mostrar precio y botón dinámico (20 min)
6. ✅ Crear PaymentPage.tsx con formulario de tarjeta (45 min)
7. ✅ Crear validadores frontend (validador Luhn, etc.) (20 min)
8. ✅ Tests E2E para flujo de pago (30 min)

**Tiempo estimado total:** 2-3 horas

---

## 📸 Evidencia Actual

### Imagen adjunta: Alta de Curso Pago
- ❌ **NO muestra campo de precio**
- Campos actuales:
  - Nombre del curso
  - Descripción
  - Área/categoría
  - Tecnología
  - Requerimientos Académicos
  - Aptitudes adquiridas al finalizar
- **Falta:** Input de precio entre "Tecnología" y "Requerimientos"

---

## 🎓 Conclusión

**HU-25 está INCOMPLETA en el frontend.**

Para cumplir con los criterios de aceptación, el Profesor DEBE poder:
1. ❌ Definir un curso como pago o gratuito al **crear** (CA1) → NO FUNCIONA HOY
2. ❌ Definir un curso como pago o gratuito al **editar** (CA1) → NO FUNCIONA HOY
3. ❌ Ver el precio en el catálogo (CA2) → NO FUNCIONA HOY
4. ❌ Ver el precio en el detalle (CA2) → NO FUNCIONA HOY

**El backend está 100% listo. El frontend necesita implementación completa del flujo de precio y pago.**
