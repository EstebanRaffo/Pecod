# INSTRUCCIONES DE RESTAURACIÓN V2 a V3

## Requisitos Previos

1. **PostgreSQL V2 debe estar accesible** en puerto 5433
   - El volumen `pecod-v1_pecod_postgres_data` ya está disponible
   - Un contenedor temporal está ejecutándose: `pecod-v2-temp-postgres`

2. **PostgreSQL V3 debe estar ejecutándose** en puerto 5432
   - Contenedor: `pecod-postgres`
   - Base de datos: `pecod`

3. **Backup V3 debe estar completado**
   - ✅ Realizado: `backend/backups/pecod_v3_backup_2026-11-09_21-31-01.sql`

## FASE 2: Ejecución del Script de Restauración

### Paso 1: Configurar SOURCE_DATABASE_URL (Optional)

El script usa por defecto:
```
postgresql://pecod:pecod@localhost:5433/pecod?schema=public
```

Si necesitas cambiar la conexión a V2, edita el `.env`:
```bash
SOURCE_DATABASE_URL="postgresql://pecod:pecod@localhost:5433/pecod?schema=public"
```

### Paso 2: Ejecutar en Modo --dry-run (Recomendado primero)

```bash
cd backend
npm run restore:v2-data:dry-run
```

Este comando:
- ✓ Lee los datos de V2
- ✓ Resuelve usuarios por email
- ✓ Muestra qué insertaría
- ✓ NO modifica V3

Verifica el resumen y confirma que todo es correcto.

### Paso 3: Ejecutar la Restauración Real

```bash
cd backend
npm run restore:v2-data
```

Este comando:
- ✓ Restaura todos los datos en V3
- ✓ Conserva IDs originales de V2
- ✓ Maneja conflictos de unicidad
- ✓ Transaccional: todo o nada

### Paso 4: Verificar Integridad

Después de la restauración, verifica:

```bash
# Verificar conteos de datos
psql -U pecod -d pecod -c "SELECT 'users' as table_name, COUNT(*) as row_count FROM users UNION ALL SELECT 'courses', COUNT(*) FROM courses;"

# Verificar cursos del profesor Franco
psql -U pecod -d pecod -c "SELECT name, isPublished FROM courses ORDER BY name;"

# Verificar inscripciones del alumno Esteban
psql -U pecod -d pecod -c "SELECT e.id, c.name FROM enrollments e JOIN courses c ON e.courseId = c.id;"
```

## FASE 3: Verificación Funcional

### 1. Tests Unitarios

```bash
cd backend
npm test
```

### 2. Pruebas Manuales por API

**Login como Profesor Franco:**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "francolmartinez@uade.edu.ar",
    "password": "Profesor123!"
  }'
```

Guardar el token y verificar:
```bash
curl -X GET http://localhost:3000/courses/mine \
  -H "Authorization: Bearer <TOKEN>"
```

Esperado: 3 cursos restaurados

**Login como Alumno Esteban:**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "efernandezraffo@uade.edu.ar",
    "password": "Alumno123!"
  }'
```

Verificar:
```bash
curl -X GET http://localhost:3000/enrollments/my-courses \
  -H "Authorization: Bearer <TOKEN>"
```

Esperado: 1 curso inscripto

### 3. Comprobar Contenido Específico

```bash
# GET /courses/:id - Verificar tema, evaluaciones, preguntas
curl -X GET http://localhost:3000/courses/0857a86f-4a1c-4f93-8702-e40702850866 \
  -H "Authorization: Bearer <TOKEN>"

# Verificar evaluaciones del curso
curl -X GET http://localhost:3000/evaluations/course/0857a86f-4a1c-4f93-8702-e40702850866 \
  -H "Authorization: Bearer <TOKEN>"

# Verificar preguntas de una evaluación
curl -X GET http://localhost:3000/evaluations/5255af79-c24a-4a95-90b3-bf85c856ce6d/questions \
  -H "Authorization: Bearer <TOKEN>"
```

## FASE 4: Prevención (Actualizaciones de Documentación)

### 1. Crear alias npm para backup automatizado

Ya está en package.json:
```bash
npm run db:backup
```

### 2. Documentación en README

Agregar sección:
```markdown
## Restauración de Datos (PECOD V2 → V3)

En caso de pérdida de datos, sigue estos pasos:

1. Verifica que el volumen V2 esté disponible:
   ```bash
   docker volume ls | grep pecod
   ```

2. Ejecuta el script de restauración en modo dry-run:
   ```bash
   cd backend
   npm run restore:v2-data:dry-run
   ```

3. Si todo es correcto, ejecuta la restauración real:
   ```bash
   npm run restore:v2-data
   ```

4. Verifica la integridad:
   ```bash
   npm test
   ```

### Prevención Futura

- **Usa `prisma migrate deploy`** (no `migrate dev`) en bases con datos
- **Nunca aceptes prompts de reset** en Prisma
- **Realiza backups regulares**:
  ```bash
  npm run db:backup
  ```
- Los backups se guardan en `backend/backups/` con timestamp
```

### 3. Instrucción en Entorno

Crear archivo `.env.restore`:
```
SOURCE_DATABASE_URL=postgresql://pecod:pecod@localhost:5433/pecod?schema=public
```

## Comandos Rápidos

```bash
# Backup manual
npm run db:backup

# Verificación en seco
npm run restore:v2-data:dry-run

# Restauración real
npm run restore:v2-data

# Detener V2 temporal
docker rm -f pecod-v2-temp-postgres

# Ver backups disponibles
ls -lh backend/backups/
```

## Troubleshooting

### "SOURCE_DATABASE_URL no está definida"
Solución: El script usa `localhost:5433` por defecto. Si V2 no está en ese puerto, edita `scripts/restore-v2-data.ts` línea ~63.

### "Profesor/Alumno no existe en V3"
Solución: Los usuarios se crean en el seed. Verifica que el seed se ejecutó:
```bash
npm run prisma:seed
```

### "Conflicto de unicidad en Enrollment"
Solución: Si el alumno ya estaba inscripto en V3, el script lo detecta y reporta. Verifica:
```bash
psql -U pecod -d pecod -c "SELECT * FROM enrollments WHERE studentId = '<ID>';"
```

### "Error de conexión a V2"
Solución: Verifica que `pecod-v2-temp-postgres` está corriendo:
```bash
docker ps | grep pecod-v2
```

Si no está, reanúdalo:
```bash
docker run -d --name pecod-v2-temp-postgres -p 5433:5432 \
  -e POSTGRES_USER=pecod -e POSTGRES_PASSWORD=pecod \
  -e POSTGRES_DB=pecod \
  -v pecod-v1_pecod_postgres_data:/var/lib/postgresql/data \
  postgres:16-alpine
```

## Limpieza Final

Después de verificar que todo funciona:

```bash
# Detener contenedor temporal V2
docker rm -f pecod-v2-temp-postgres

# Opcional: Archivar dumps
mv backend/backups/pecod_v2_dump_*.sql backend/backups/archive/

# Verificar que no quedan referencias
docker volume ls | grep pecod
```

---

**Fecha**: 2026-11-09
**Status**: LISTO PARA EJECUTAR
**Próximos pasos**: Ejecutar `npm run restore:v2-data:dry-run` en backend/
