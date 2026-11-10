# 🚨 Fix: Rate Limiting 429 Errors (HU22)

**Problema Reportado**: `GET http://localhost:3000/api/courses 429 (Too Many Requests)`  
**Afectaba**: Rutas `/profesor/cursos/:id` y `/catalogo`  
**Causa Raíz**: Configuración de ThrottlerGuard demasiado restrictiva  
**Fecha de Fix**: 2026-11-09 22:00  
**Status**: ✅ RESUELTO

---

## 📋 Problema Identificado

### Errores Originales
```
GET http://localhost:3000/api/courses 429 (Too Many Requests)
GET http://localhost:3000/api/notifications 429 (Too Many Requests)
```

### Causa
El módulo `ThrottlerModule` (HU22 - Rate Limiting) estaba configurado con un límite extremadamente restrictivo:

```typescript
// Configuración ANTES (src/auth/auth.module.ts)
ThrottlerModule.forRoot([
  {
    ttl: 3600000,  // 1 hora
    limit: 5,      // ¡Solo 5 solicitudes por hora!
  },
]),
```

**El problema**: Con solo 5 solicitudes por hora, cada navegación a una página que hace 2-3 requests (GET /courses, GET /notifications, etc.) agotaba el límite rápidamente.

---

## ✅ Solución Implementada

### 1. Aumentar el Límite de Rate Limiting

**Cambio en `src/auth/auth.module.ts`**:
```typescript
ThrottlerModule.forRoot([
  {
    ttl: 60000,   // 1 minuto
    limit: 100,   // 100 solicitudes por minuto
  },
]),
```

**Justificación**:
- **TTL**: 1 minuto es una ventana más práctica para desarrollo/testing
- **Limit**: 100 solicitudes/minuto ≈ 1.67 req/seg, suficiente para UX normal
- **Resultado**: Incluso si una página hace 5 requests, quedan 95 para otras operaciones

### 2. Archivos Modificados

| Archivo | Cambios | Status |
|---------|---------|--------|
| `src/auth/auth.module.ts` | Aumentar límite de 5 a 100 req/min | ✅ |
| `src/app.module.ts` | Mantener ThrottlerGuard estándar | ✅ |
| `src/courses/courses.controller.ts` | Sin cambios necesarios | ✅ |
| `src/notifications/notifications.controller.ts` | Sin cambios necesarios | ✅ |

### 3. Archivos Eliminados

Se removieron archivos innecesarios creados durante la exploración:
- ❌ `src/common/guards/custom-throttler.guard.ts` (no compilaba)
- ❌ `src/common/decorators/skip-throttle.decorator.ts` (no usado)

---

## 🧪 Verificación

### Tests
```
✅ 276/276 tests pasando
✅ Compilación exitosa (npm run build)
✅ Zero breaking changes
```

### Validación del Fix

**Antes**: 
- ❌ GET /courses → 429 Too Many Requests
- ❌ GET /notifications → 429 Too Many Requests

**Después**:
- ✅ GET /courses → 200 OK
- ✅ GET /notifications → 200 OK
- ✅ Múltiples navegaciones sin problemas

---

## 📊 Límites de Rate Limiting por Escenario

### Configuración Actual (Desarrollo/Testing)
```
Límite: 100 solicitudes por minuto
Promedio: ~1.67 req/segundo

Ejemplos de uso:
✅ Cargar catálogo: 2-3 requests
✅ Navegar entre cursos: 2-3 requests
✅ Cargar notificaciones: 1 request
✅ Subir material: 1-2 requests
✅ Enviar evaluación: 1 request
```

### Para Producción (si es necesario)
```typescript
// Opción 1: Más permisivo
{
  ttl: 60000,
  limit: 200,  // 200 solicitudes por minuto
}

// Opción 2: Por endpoint (requiere CustomThrottlerGuard)
// Aplicar throttling diferente a diferentes rutas
```

---

## 🔧 Cómo Cambiar el Límite en el Futuro

**Si necesitas ajustar el rate limiting**:

1. Abre `backend/src/auth/auth.module.ts`
2. Busca: `ThrottlerModule.forRoot([`
3. Modifica `limit` (solicitudes) o `ttl` (ventana en ms):

```typescript
ThrottlerModule.forRoot([
  {
    ttl: 60000,     // ventana de tiempo (milisegundos)
    limit: 100,     // máximo de solicitudes en esa ventana
  },
]),
```

4. Recompila: `npm run build`
5. Reinicia el servidor

---

## 📝 Notas Técnicas

### ¿Por qué HU22 (Rate Limiting) tenía un límite tan bajo?

HU22 fue implementada con propósito de seguridad (proteger contra abuso/DDoS), pero:
- El límite de 5/hora era demasiado restrictivo para desarrollo
- No distinguía entre producción y desarrollo
- Afectaba rutas que no necesitaban protección agresiva

### Configuración Recomendada por Ambiente

```typescript
// En producción, usar:
{
  ttl: 60000,
  limit: process.env.NODE_ENV === 'production' ? 60 : 100,
}

// O usar variables de entorno
const limit = process.env.RATE_LIMIT_REQUESTS || '100';
const ttl = process.env.RATE_LIMIT_TTL || '60000';
```

---

## 🚀 Próximos Pasos (Opcional)

Para una solución más robusta en producción:

1. **Implementar rate limiting por endpoint**:
   - Endpoints sensibles (login): 5 req/min
   - Endpoints comunes (GET cursos): 200 req/min
   - Uploads: 10 req/min

2. **Usar Redis para distributed rate limiting**:
   - Si tienes múltiples servidores
   - Usa `@nestjs/throttler` con adaptador Redis

3. **Monitoreo**:
   - Alertar si se alcanzan los límites frecuentemente
   - Ajustar según uso real

---

## ✅ Checklist

- [x] Identificar causa: ThrottlerModule con límite muy bajo
- [x] Aumentar límite a 100 req/min (de 5/hora)
- [x] Probar compilación
- [x] Verificar 276/276 tests pasando
- [x] Documentar cambios
- [x] Remover archivos innecesarios
- [x] Confirmar resolución

---

**Fix completado y verificado** ✅  
**Toda la aplicación funcionando normalmente** 🎉
