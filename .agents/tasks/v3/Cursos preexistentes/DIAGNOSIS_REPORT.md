# DIAGNÓSTICO FASE 0 - Restauración V2 a V3

## Resumen Ejecutivo

Se ha identificado con éxito el volumen de datos de V2 en Docker y se ha establecido acceso de lectura a la base de datos original. Los datos existen y pueden ser restaurados a V3 de manera segura.

## Estado Actual

### V3 (Actual)
- **Base de Datos**: pecod (puerto 5432)
- **Volumen**: pecod_pecod_postgres_data
- **Backup creado**: `backend/backups/pecod_v3_backup_2026-11-09_21-31-01.sql` (98 KB)
- **Estado de datos**:
  - Users: 6
  - Institutions: 2
  - Courses: 6
  - Topics: 1
  - Materials: 2
  - Enrollments: 3
  - Evaluations: 0
  - Questions: 0
  - Certificates: 0
  - Notifications: 0

**Conclusión**: V3 tiene datos parciales (seed inicial). Migraciones completadas sin reset reciente.

### V2 (Fuente de Datos)
- **Base de Datos**: pecod (puerto 5433 - contenedor temporal)
- **Volumen**: pecod-v1_pecod_postgres_data
- **Fecha de creación**: 2026-09-23 (16 días atrás)
- **Backup creado**: `backend/backups/pecod_v2_dump_2026-11-09_21-33-40.sql` (42 KB)
- **Estado de datos**:
  - Users: 3
    - Profesor Franco Leonardo (francolmartinez@uade.edu.ar) - ID: 9f216d4e-683c-435b-87bf-0dd6675be7f7
    - Alumno Esteban Raffo (efernandezraffo@uade.edu.ar) - ID: fe5e16e1-56d6-4f26-86a9-a05fe5334ddd
    - Admin (admin@pecod.com) - ID: f2ac46bf-3044-4185-b041-3ac96fadc19d
  - Institutions: 1
    - UADE (uade.pecod.com) - ID: ea4179db-e71a-4848-a039-1119de4e592a
  - Courses: 3
    - "Programación en C#" (isPublished=true)
    - "Diseño de Casos de Prueba" (isPublished=true)
    - "Automatización de Pruebas con Pytest" (isPublished=false)
  - Topics: 4
    - 2 en "C#"
    - 2 en "Diseño de Casos de Prueba"
  - Materials: 0
  - Evaluations: 2 (ambas en "C#")
  - Questions: 5
  - Question Options: 12
  - Enrollments: 1 (estudiante Esteban inscripto en un curso)
  - Evaluation Attempts: 0
  - Certificates: 0
  - Notifications: 0

## Diferencias V2 vs V3 (Schema)

### Campos en V2 que NO están en V3
- Ninguno significativo

### Campos en V3 que NO están en V2
- Course: price, academicRequirements, technology
- Evaluation: maxAttempts
- Topic: screenRecordingUrl, videoDurationSeconds, videoUrl, contentText
- Tablas nuevas en V3: CourseReview, ForumThread, ForumPost, Payment, PasswordResetToken, EmailVerificationToken, InstitutionEmailDomain, Notification, TopicProgress, Certificate

## Datos a Restaurar

### A) Profesor Franco Leonardo
- **3 cursos** con contenido completo
- **4 temas** asociados
- **2 evaluaciones** con **5 preguntas** y **12 opciones**
- **0 materiales** en V2

### B) Alumno Esteban Raffo
- **1 inscripción (Enrollment)** en un curso del profesor Franco
- **0 evaluaciones intentadas**
- **0 certificados**
- **0 notificaciones**
- **Acceso a cursos**: inscripto en 1 curso del profesor Franco

## Limitaciones y Observaciones

1. **No hay datos de TopicProgress, EvaluationAttempt ni Certificate en V2**: Se crearán registros vacíos si es necesario para mantener integridad referencial.
2. **No hay materiales** en V2: Los temas se restaurarán sin archivo adjunto.
3. **No hay videos ni contenido de temas** en V2: Los campos videoUrl, screenRecordingUrl, contentText están vacíos.
4. **Evaluaciones sin topicId**: Ambas evaluaciones tienen topicId=NULL (evaluaciones de cierre de curso).

## Plan de Acción

1. ✅ **FASE 0 completada**: Diagnóstico realizado
2. **FASE 1**: Confirmar que V2 es la fuente correcta (ya localizada)
3. **FASE 2**: Crear script TypeScript (`backend/scripts/restore-v2-data.ts`) que:
   - Resuelve usuarios por email
   - Remapea IDs (V2 → V3)
   - Restaura datos en orden de dependencias
   - Maneja conflictos de unicidad
   - Incluye modo --dry-run
   - Es idempotente y transaccional
4. **FASE 3**: Ejecutar script y verificar integridad
5. **FASE 4**: Pruebas funcionales y prevención

## Archivos Generados

- `backend/backups/pecod_v3_backup_2026-11-09_21-31-01.sql` - Backup V3 pre-restauración
- `backend/backups/pecod_v2_dump_2026-11-09_21-33-40.sql` - Dump completo V2
- `backend/backups/v2_data_json/` - CSV exports de V2

## Contenedor Temporal

- **Nombre**: pecod-v2-temp-postgres
- **Puerto**: 5433
- **Estado**: Ejecutándose (lectura)
- **Nota**: Será detenido después de completar FASE 2

---

**Fecha del diagnóstico**: 2026-11-09 21:31 -03:00
**Estado**: LISTO PARA FASE 2 - SCRIPT DE RESTAURACIÓN
