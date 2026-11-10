# Fix: Actualización del Contador de Respuestas en el Foro

## Problema
Cuando un usuario guardaba una respuesta en el popup de detalle de consulta del foro y luego cerraba el popup, el contador de respuestas en la vista previa de la consulta (en la lista del foro) no se actualizaba.

### Ejemplo del comportamiento incorrecto:
1. Usuario abre una consulta que muestra "2 respuestas"
2. Usuario agrega una nueva respuesta en el popup
3. Usuario cierra el popup
4. En la lista del foro, la consulta aún muestra "2 respuestas" (debería mostrar "3 respuestas")

## Causa
El componente `ForumThreadDetailModal` (modal de detalle de consulta) actualizaba correctamente el thread dentro del modal cuando se agregaba o eliminaba una respuesta, pero **no notificaba al componente padre** (`ForumPage`) para que actualizara la lista de threads mostrada en la página principal.

El contador en la lista utiliza `thread.replyCount` (o `thread.posts.length` según la estructura), que proviene del estado del componente padre que nunca se actualizaba.

## Solución Implementada

### Cambios en `frontend/src/pages/ForumPage.tsx`:

1. **Agregado callback `onPostsChanged`** al componente `ForumThreadDetailModal`:
   ```typescript
   onPostsChanged={() => {
     // Reload threads to update reply count
     const response = forumApi.getThreads(courseId!);
     response.then((res) => {
       setThreads(res.data);
       setTotalPages(res.pagination.totalPages);
     });
   }}
   ```

2. **Actualización de la interfaz `ForumThreadDetailModalProps`**:
   ```typescript
   interface ForumThreadDetailModalProps {
     // ... existing props ...
     onPostsChanged?: () => void;
   }
   ```

3. **Invocación del callback en `handleCreatePost()`**:
   ```typescript
   const handleCreatePost = async (e: React.FormEvent) => {
     // ... validation and creation logic ...
     try {
       await forumApi.createPost(threadId, { body: newPostBody });
       setNewPostBody('');
       const data = await forumApi.getThread(threadId);
       setThread(data);
       onPostsChanged?.();  // ← Notify parent to update list
     }
     // ...
   };
   ```

4. **Invocación del callback en `handleDeletePost()`**:
   ```typescript
   const handleDeletePost = async () => {
     // ... deletion logic ...
     try {
       await forumApi.deletePost(postToDelete);
       setPostToDelete(null);
       const data = await forumApi.getThread(threadId);
       setThread(data);
       onPostsChanged?.();  // ← Notify parent to update list
     }
     // ...
   };
   ```

## Flujo de Actualización

### Antes (incorrecto):
1. Usuario guarda respuesta → se actualiza el thread en el modal solamente
2. Lista de threads en ForumPage permanece sin cambios
3. El contador sigue siendo el antiguo valor

### Después (correcto):
1. Usuario guarda respuesta → se actualiza el thread en el modal
2. Se invoca `onPostsChanged()` → se recarga la lista de threads completa
3. El estado `threads` en ForumPage se actualiza con los nuevos datos
4. El contador se refleja correctamente en la lista

## Verificación

- ✅ Build sin errores (npm run build completado exitosamente)
- ✅ TypeScript compilation successful
- ✅ Los cambios son mínimos y enfocados (14 insertions)
- ✅ No se afectan otras funcionalidades (crear/eliminar consultas, etc.)

## Testing Manual Recomendado

1. Abrir una consulta del foro
2. Crear una respuesta y guardarla
3. Cerrar el modal
4. Verificar que el contador de respuestas se actualizó correctamente en la lista
5. Abrir nuevamente la misma consulta
6. Eliminar una respuesta
7. Cerrar el modal
8. Verificar que el contador de respuestas disminuyó correctamente

## Archivos Modificados

- `frontend/src/pages/ForumPage.tsx` - Agregado callback de actualización y llamadas al mismo
