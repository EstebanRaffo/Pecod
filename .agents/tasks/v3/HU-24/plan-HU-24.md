# Plan de Implementación: HU-24 - Foro de consultas por curso

**Fecha**: 2026-11-09  
**Versión**: V3  
**Objetivo**: Implementar un foro de consultas por curso donde Alumnos y Profesores pueden crear y responder consultas sobre temas específicos del temario.

---

## Hallazgos de Exploración

### Estado actual del código
- **Modelos Prisma**: Schema completo con 18 HU implementadas. Modelos relevantes: `Course`, `Topic`, `Enrollment`, `User`
- **Guardias y autenticación**: `JwtAuthGuard`, `RolesGuard`, `@Roles()`, `@CurrentUser()` ya implementados
- **Estructura de módulos**: Backend sigue patrón controller → service → dto con validaciones centralizadas
- **Mock de Prisma**: `createMockPrismaService()` en `mock-prisma.ts` mantiene lista explícita de modelos
- **DTOs**: Usando `class-validator`/`class-transformer` con validaciones en español
- **Gestión multi-institución**: Todos los accesos validan `institutionId` del JWT contra el recurso
- **No existe modelo Forum**: Tal como se indica en el prompt

### Características no configuradas
- No existe `ConfirmDialog` genérico (está dentro de `TopicMediaUploader.tsx`)
- No existe módulo `forum` en backend
- No existen modelos `ForumThread` ni `ForumPost`

---

## Cambios por Capa

### 1. Base de Datos (Prisma)

**Archivo**: `backend/prisma/schema.prisma`

**Modelos a agregar**:
```prisma
model ForumThread {
  id        String   @id @default(uuid())
  courseId  String
  course    Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)
  topicId   String?
  topic     Topic?   @relation(fields: [topicId], references: [id], onDelete: SetNull)
  authorId  String
  author    User     @relation("ForumThreads", fields: [authorId], references: [id])
  title     String   @db.VarChar(120)
  body      String   @db.VarChar(2000)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  posts     ForumPost[]

  @@index([courseId, createdAt])
  @@index([topicId])
  @@map("forum_threads")
}

model ForumPost {
  id        String   @id @default(uuid())
  threadId  String
  thread    ForumThread @relation(fields: [threadId], references: [id], onDelete: Cascade)
  authorId  String
  author    User     @relation("ForumPosts", fields: [authorId], references: [id])
  body      String   @db.VarChar(2000)
  createdAt DateTime @default(now())

  @@index([threadId, createdAt])
  @@map("forum_posts")
}
```

**Relaciones a agregar en `User`**:
```prisma
forumThreads ForumThread[] @relation("ForumThreads")
forumPosts   ForumPost[]   @relation("ForumPosts")
```

**Relaciones a agregar en `Course`**:
```prisma
forumThreads ForumThread[]
```

**Relaciones a agregar en `Topic`**:
```prisma
forumThreads ForumThread[]
```

**Migración**: `20261109000000_add_forum_tables.sql`

---

### 2. Backend (NestJS)

**Módulo**: `backend/src/forum/`

**Estructura**:
```
forum/
  ├── forum.module.ts
  ├── forum.controller.ts
  ├── forum.service.ts
  ├── forum.service.spec.ts
  ├── dto/
  │   ├── create-forum-thread.dto.ts
  │   └── create-forum-post.dto.ts
  └── helpers/
      └── forum-access.helper.ts
```

**Helper de Acceso (`forum-access.helper.ts`)**:
- Función: `checkForumThreadAccess(userId, institutionId, courseId, userRole, threadId?)`
- Validaciones:
  1. El usuario existe y está en la misma institución que el curso
  2. El usuario es Alumno inscripto en el curso O Profesor propietario
  3. Retorna `{ allowed: boolean, reason?: string }`
- Casos:
  - Alumno no inscripto → 403
  - Usuario de otra institución → 404 (no delega información)
  - Profesor ajeno al curso → 403
  - Alumno inscripto o Profesor propietario → permitido

**DTOs**:

`create-forum-thread.dto.ts`:
```typescript
- topicId: string (obligatorio)
- title: string (obligatorio, 1-120 caracteres)
- body: string (obligatorio, 1-2000 caracteres)
```

`create-forum-post.dto.ts`:
```typescript
- body: string (obligatorio, 1-2000 caracteres)
```

**Endpoints**:
1. `GET /courses/:courseId/forum/threads?page=1&topicId=?` → listar consultas paginadas (20 por página)
2. `POST /courses/:courseId/forum/threads` → crear consulta (solo Alumnos inscriptos)
3. `GET /forum/threads/:id` → detalle de consulta con respuestas
4. `POST /forum/threads/:id/posts` → responder consulta (Alumnos inscriptos + Profesor propietario)
5. `DELETE /forum/threads/:id` → eliminar consulta (autor o Profesor propietario)
6. `DELETE /forum/posts/:id` → eliminar respuesta (autor o Profesor propietario)

**Validaciones de negocio**:
- Título: 1-120 caracteres, obligatorio
- Body de consulta: 1-2000 caracteres, obligatorio
- Body de respuesta: 1-2000 caracteres, obligatorio
- Topic: obligatorio al crear consulta, pero `topicId` puede ser nulo después de eliminar el tema
- Control de acceso: centralizado en el helper

**Respuestas de error** (en español):
- `400 Bad Request`: Validación fallida (límites de caracteres, campos obligatorios)
- `403 Forbidden`: Acceso denegado (no inscripto, institución diferente, etc.)
- `404 Not Found`: Recurso no encontrado

**Tests con Jest** (`forum.service.spec.ts`):
1. Crear consulta: válida, falta título, falta body, falta topicId, excede límites
2. Crear respuesta: válida, falta body, excede 2000 caracteres
3. Acceso: Alumno inscripto OK, Alumno no inscripto 403, Usuario otra institución 404, Profesor ajeno 403, Profesor propietario OK
4. Listar: paginación de 20, orden descendente por fecha, filtro por topicId
5. Detalle: respuestas en orden cronológico
6. Eliminar: autor puede eliminar propia, Profesor propietario puede eliminar cualquiera, eliminar consulta borra respuestas
7. Tema eliminado: consultas se conservan y se muestran con "Tema eliminado"
8. Curso despublicado: Alumnos inscriptos mantienen acceso

---

### 3. Frontend (React)

**Ruta**: `frontend/src/pages/ForumPage.tsx`

**Componentes**:

1. **`pages/ForumPage.tsx`** (página principal)
   - Props: `courseId`, `userRole`, `userId`
   - Estado: `page`, `topicFilter`, `threads`, `loading`, `error`
   - Secciones:
     - Filtro por tema (dropdown con topics del curso)
     - Botón "Nueva consulta" (solo Alumnos inscriptos)
     - Listado paginado (20 consultas)
     - Paginación (anterior/siguiente)
   - Evento: clic en consulta abre `ForumThreadDetailModal`

2. **`components/ForumThreadList.tsx`**
   - Props: `threads`, `loading`, `onSelectThread`
   - Renderiza lista de consultas con:
     - Título, Tema (o "Tema eliminado"), Autor, Fecha, Cantidad de respuestas
     - Botón delete (mostrado si: usuario es autor o es Profesor propietario)

3. **`components/ForumThreadForm.tsx`**
   - Props: `courseId`, `topics`, `onSubmit`, `onCancel`
   - Campos:
     - Select de tema (obligatorio)
     - Input de título (máx 120, obligatorio)
     - Textarea de body (máx 2000, obligatorio)
   - Validación en cliente (feedback visual)
   - Envía a `api/forum.ts`

4. **`components/ForumThreadDetailModal.tsx`**
   - Props: `threadId`, `courseId`, `userRole`, `userId`, `onClose`
   - Secciones:
     - Encabezado: título, tema, autor, fecha
     - Botón delete (si permiso)
     - Listado de respuestas (orden cronológico)
     - Formulario para responder (Alumnos inscriptos + Profesor)
   - Evento: submit envía a `api/forum.ts`

5. **`components/ConfirmDialog.tsx` (refactorizado de `TopicMediaUploader.tsx`)**
   - Props: `title`, `message`, `onConfirm`, `onCancel`
   - Botones: "Confirmar", "Cancelar"
   - Usado por: eliminar consultas, eliminar respuestas

6. **`api/forum.ts`**
   - Funciones:
     - `getThreads(courseId, page, topicId?)` → GET
     - `createThread(courseId, dto)` → POST
     - `getThread(id)` → GET
     - `createPost(threadId, dto)` → POST
     - `deleteThread(id)` → DELETE
     - `deletePost(id)` → DELETE
   - Usa cliente HTTP Axios con interceptor JWT

**Integración**:
- `CourseLearningPage.tsx`: Agregar enlace "Foro" para Alumnos inscriptos
- `CourseEditorPage.tsx`: Agregar enlace "Foro" para Profesor propietario
- Navega a `ForumPage` pasando `courseId`

**Validaciones en cliente**:
- Límites de caracteres con feedback en tiempo real
- Campos obligatorios
- Mensajes de error del servidor

**Seguridad**:
- Renderizar contenido siempre como texto (React escapa HTML por defecto)
- No usar `dangerouslySetInnerHTML`
- Validar permisos en UI para mostrar/ocultar botones (pero confiar en backend para enforcement)

---

### 4. Tests

#### Jest (Backend)

**Archivo**: `backend/src/forum/forum.service.spec.ts`

Casos a cubrir:
1. **Validaciones de campos**:
   - Crear consulta: título falta, excede 120 caracteres
   - Crear consulta: body falta, excede 2000 caracteres
   - Crear respuesta: body falta, excede 2000 caracteres
   - Topic obligatorio al crear consulta

2. **Control de acceso**:
   - Alumno inscripto puede crear y responder ✓
   - Alumno no inscripto recibe 403 ✗
   - Usuario de otra institución recibe 404 ✗
   - Profesor ajeno al curso recibe 403 ✗
   - Profesor propietario puede crear (si regla permite), responder, eliminar cualquiera ✓

3. **Gestión de contenido**:
   - Listar consultas: orden descendente por fecha
   - Listar consultas: paginación de 20
   - Listar consultas: filtro por topicId
   - Detalle de consulta: respuestas en orden cronológico
   - Eliminar consulta: elimina también sus respuestas

4. **Tema eliminado**:
   - Consulta con topic eliminado (topicId = null) se muestra con "Tema eliminado"

5. **Curso despublicado**:
   - Alumno inscripto mantiene acceso (leer y participar)
   - Alumno no inscripto sigue sin acceso

6. **Permisos de eliminación**:
   - Autor puede eliminar propia consulta/respuesta
   - Profesor propietario puede eliminar cualquiera
   - Otros usuarios reciben 403

#### Cypress (E2E)

**Archivo**: `frontend/cypress/e2e/forum.cy.ts`

Casos a cubrir:
1. **Crear consulta**: Alumno inscripto llena el formulario y crea una consulta
2. **Responder consulta**: Profesor propietario accede a la consulta y la responde
3. **Eliminar con confirmación**: Alumno abre consulta, hace clic en eliminar, ve modal de confirmación, hace clic en "Cancelar" (no elimina), repite y hace clic en "Confirmar" (elimina)
4. **Seguridad XSS**: Crear consulta con título `<script>alert('xss')</script>` → se muestra como texto, no se ejecuta
5. **Paginación**: Crear 21 consultas, verificar que la primera página tiene 20, segunda página tiene 1
6. **Filtro por tema**: Crear 2 consultas en temas diferentes, filtrar por uno, verificar que se muestra solo 1

#### Postman

**Colección**: `postman/PECOD.postman_collection.json`

Requests a agregar/actualizar:
1. `POST /courses/:courseId/forum/threads` (crear consulta)
   - Caso exitoso: 201
   - Acceso denegado (Alumno no inscripto): 403
   - Validación fallida (título vacío): 400

2. `GET /courses/:courseId/forum/threads` (listar consultas)
   - Con `?page=1&topicId=?`
   - Caso exitoso: 200 con array de 20 elementos

3. `POST /forum/threads/:id/posts` (crear respuesta)
   - Caso exitoso: 201
   - Acceso denegado (Alumno no inscripto): 403

4. `DELETE /forum/threads/:id` (eliminar consulta)
   - Caso exitoso: 204
   - Acceso denegado: 403

---

## Riesgos y Mitigaciones

| Riesgo | Severidad | Mitigación |
|--------|-----------|-----------|
| Colisión de nombre `Question` vs foro | Alta | Usar nombres `ForumThread`/`ForumPost` explícitamente |
| Validación de institución olvidada | Alta | Helper centralizado + tests de acceso |
| XSS en contenido del foro | Alta | Nunca usar `dangerouslySetInnerHTML`, escapar en backend |
| Paginación sin índices | Media | Índices en Prisma: `(courseId, createdAt)` |
| Duplicación de `ConfirmDialog` | Baja | Refactorizar `TopicMediaUploader` primero |
| Migraciones no reversibles | Media | Testear migración up/down en BD limpia |
| Tests de acceso incompletos | Media | Cubrir 6 roles × 3 estados (propio/ajeno/otro) |

---

## Decisiones de Diseño Confirmadas

- **Modelos**: `ForumThread` y `ForumPost` con índices optimizados
- **Límites de caracteres**: Título 120, body/respuesta 2000 (validado en backend + frontend)
- **Paginación**: 20 consultas por página, más reciente primero
- **Control de acceso**: Centralizado en helper, aplicado en cada endpoint
- **Contenido**: Solo texto (sin HTML ni adjuntos)
- **Tema eliminado**: Consultas se conservan, `topicId` se anula (SetNull)
- **Borrado en cascada**: Eliminar consulta elimina respuestas
- **Sin notificaciones**: No tocar el módulo `Notification` en V3
- **Curso despublicado**: Mantiene acceso de inscriptos (reutiliza lógica de HU-8)

---

## Orden de Implementación

1. ✅ Crear plan (este documento)
2. → Crear modelos Prisma + migración
3. → Actualizar `mock-prisma.ts` con nuevos modelos
4. → Crear módulo `forum` con service, controller, DTOs, helper
5. → Escribir tests del service
6. → Refactorizar `ConfirmDialog` en frontend
7. → Crear `api/forum.ts`
8. → Crear página y componentes del foro
9. → Integrar en `CourseLearningPage` y `CourseEditorPage`
10. → Escribir Cypress e2e
11. → Agregar requests a Postman
12. → Actualizar README

---

## Definition of Done

- [ ] Modelos Prisma creados y migración ejecutada
- [ ] Backend: todos los endpoints funcionan con validaciones y control de acceso
- [ ] Frontend: página del foro, formularios, listado paginado, detalle
- [ ] `npm test` en backend pasa (cobertura de negocio)
- [ ] `npm run build` y `npm run lint` en frontend pasan
- [ ] Cypress e2e incluye todos los criterios de aceptación
- [ ] Postman actualizado con tests
- [ ] Migraciones reversibles
- [ ] README actualizado
- [ ] No hay secretos ni XSS

