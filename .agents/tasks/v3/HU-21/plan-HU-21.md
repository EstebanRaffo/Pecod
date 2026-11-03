# HU-21: Panel de Analíticas para el Profesor - Plan de Implementación

## Hallazgos de Exploración

### Estado Actual
- ✅ **HU-20 implementada**: CourseReview existe en DB (migración `20261101120000_add_course_reviews`)
- ⚠️ **Schema.prisma desactualizado**: No contiene modelo `CourseReview` en el archivo source (solo en migración)
- ✅ **CourseCompletionService existe**: Con método `getProgressPercentage()` y helpers
- ✅ **Mock Prisma actualizado**: Incluye `courseReview` 
- ✅ **Estructura Frontend**: Rutas `/profesor/cursos`, páginas en `ProfessorCoursesPage.tsx`
- ✅ **API Client**: Estructura de axios con interceptores de JWT

### Dependencias
- HU-20 reseñas completada
- HU-16 progreso de temas completado (getProgressPercentage disponible)
- Roles/Guards implementados
- Enrollments/TopicProgress disponibles

## Cambios por Capa

### 1. Base de Datos (Backend)
**Cambio: Actualizar schema.prisma**
- Agregar modelo `CourseReview` con relaciones bidireccionales
- Agregar relación `reviews` en modelo `Course`
- Agregar relación `courseReviews` en modelo `User`
- No requiere migración nueva (ya existe)

### 2. Backend
**Crear módulo `analytics`**
- Archivo: `backend/src/analytics/analytics.controller.ts`
  - `GET /professor/analytics` con `@Roles(Role.PROFESSOR)`
  - Toma `professorId` del JWT (nunca del body)
  - Retorna array de DTOs con agregaciones por curso

- Archivo: `backend/src/analytics/analytics.service.ts`
  - Consultas agregadas con `groupBy` para evitar N+1
  - Cálculo de promedios en memoria
  - Filtrado por institutionId del JWT
  - Lógica de redondeo según CA2-3

- Archivo: `backend/src/analytics/analytics.module.ts`
  - Importar `PrismaModule`, `CommonModule`

- Archivo: `backend/src/analytics/dto/analytics-response.dto.ts`
  - DTO con campos: `courseId`, `title`, `status`, `enrolledCount`, `averageProgress`, `ratingAverage`, `ratingCount`

- DTO de respuesta: validar con `class-validator` si es necesario

**Actualizar app.module.ts**
- Importar `AnalyticsModule`

**Tests (backend)**
- Archivo: `backend/src/analytics/analytics.service.spec.ts`
  - Casos: múltiples porcentajes (verificar redondeo), sin inscriptos, sin temas, sin reseñas, curso despublicado, profesor solo ve sus cursos, roles no autorizados
  - Usar `createMockPrismaService()`

### 3. Frontend

**API Client**
- Archivo: `frontend/src/api/analytics.ts`
  - Función `getAnalytics()` que llama `GET /professor/analytics`

**Componente/Página**
- Archivo: `frontend/src/pages/ProfessorAnalyticsPage.tsx`
  - Carga datos de `/professor/analytics`
  - Renderiza tabla o tarjetas con indicadores
  - Estado vacío: "Sin cursos para analizar" con enlace a `/profesor/cursos`
  - Formato: "Sin calificaciones" cuando `ratingAverage` es null
  - Muestra porcentaje de avance con %
  - Información solamente agregada (nunca de alumnos individuales)

**Rutas y Navegación**
- Actualizar `frontend/src/App.tsx`:
  - Agregar ruta `/profesor/analiticas` con `ProtectedRoute` para PROFESSOR
- Actualizar `frontend/src/components/NavBar.tsx`:
  - Agregar enlace "Analíticas" en menú del PROFESSOR

### 4. Tests

**Backend (Jest)**
- Múltiples porcentajes de avance (verificar Math.round)
- Curso sin inscriptos → 0%
- Curso sin temas → 0%
- Curso sin reseñas → "Sin calificaciones" (ratingAverage = null)
- Curso despublicado conserva indicadores
- Profesor solo ve sus cursos
- Profesor de otra institución no ve cursos
- Rol STUDENT/ADMIN → 403
- Calificación con 1 decimal

**Frontend (Cypress)**
- Profesor con 2+ cursos y varios alumnos ve valores esperados
- Profesor sin cursos ve mensaje y enlace a crear
- Clicky a crear curso desde mensaje vacío
- Navegación desde NavBar

**Postman**
- `GET /professor/analytics` con token PROFESSOR → 200
- `GET /professor/analytics` con token STUDENT → 403
- `GET /professor/analytics` con token ADMIN → 403
- Verificar estructura de respuesta

## Riesgos y Mitigación

| Riesgo | Mitigación |
|--------|-----------|
| N+1 en agregaciones | Usar `groupBy` + `include` eficiente, calcular en memoria |
| Schema desactualizado | Actualizar schema.prisma con `CourseReview` antes de continuar |
| Seguridad: Profesor ve cursos ajenos | Verificar institutionId + professorId en cada query |
| Redondeo de promedios inconsistente | Usar Math.round() explícitamente, testear con valores fronterizos |
| Cursos sin temas/inscriptos | Validar CA2: si no hay inscriptos/temas, retornar 0 o defaults |
| Reseñas null/undefined | Validar que ratingAverage y ratingCount son seguros si no hay reseñas |
| Rating con más de 1 decimal | Usar `toFixed(1)` + parseFloat si es necesario en DB o DTO |
| Cambios en HU-20 (reviews) | Si se modifica structure de CourseReview, actualizar AnalyticsService |

## Secuencia de Implementación

1. **Actualizar schema.prisma** → Agregar CourseReview model
2. **Backend - Analytics Service** → Lógica de cálculos y queries
3. **Backend - Analytics Controller** → Endpoints
4. **Backend - Tests** → Cobertura completa
5. **Frontend - API client** → `analytics.ts`
6. **Frontend - Page component** → `ProfessorAnalyticsPage.tsx`
7. **Frontend - Rutas y NavBar** → Integración
8. **Frontend - Tests (Cypress)** → E2E
9. **Postman** → Requests
10. **README** → Actualizar a V2

## Definition of Done Checklist

- [ ] `npm test` en backend pasa (todas las pruebas)
- [ ] `npm run build` y `npm run lint` en frontend pasan
- [ ] Cypress spec nuevo/ampliado cubre criterios
- [ ] Postman requests configurados y validados
- [ ] Schema.prisma actualizado
- [ ] Migraciones aplican limpias
- [ ] Seed sigue funcionando
- [ ] Tests anteriores siguen pasando
- [ ] Sin secretos/hardcoding
- [ ] README actualizado (HU-21 implementada, estructura)
- [ ] Resumen final documentado
