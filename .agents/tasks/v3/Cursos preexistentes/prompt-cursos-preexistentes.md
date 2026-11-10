OBJETIVO
Restaurar en la base de datos de PECOD V3 información que existía en V2 y se perdió. Alcance exacto:

A) Profesor francolmartinez@uade.edu.ar: todos los cursos que creó, con todo su contenido: Course (todos los campos), Topic (orden, videoUrl, screenRecordingUrl, videoDurationSeconds, contentText), Material, Evaluation, Question y QuestionOption.

B) Alumno efernandezraffo@uade.edu.ar: todas sus inscripciones (Enrollment) con acceso completo al contenido y su avance: TopicProgress, EvaluationAttempt, Certificate y Notification (con su estado de leída).
   - Si el Alumno está inscripto en cursos de OTROS profesores (por ejemplo apotente@uade.edu.ar), restaurar también esos cursos con todo su contenido, o el acceso quedaría roto por claves foráneas.

REGLAS (no negociables)
1. NO ejecutes prisma migrate reset, prisma db push --force-reset, docker compose down -v, ni nada que borre datos. Antes de tocar la base, hacé un backup (pg_dump) de la BD actual de V3 y guardalo en backend/backups/ con timestamp.
2. NO inventes datos. Si no encontrás una fuente real de los datos de V2, detenete y reportame qué buscaste y qué necesitás de mi parte.
3. El script debe ser idempotente (se puede correr varias veces sin duplicar), transaccional (todo o nada) y tener un modo --dry-run que solo informe qué insertaría.
4. Conservá los IDs originales (uuid) de Course, Topic, Material, Evaluation, Question, QuestionOption, Enrollment, EvaluationAttempt y Certificate, para que las referencias externas (claves S3, Mux, códigos de certificado) sigan válidas.
5. No sobrescribas ni borres nada existente en V3. Usá upsert por id; si hay conflicto de unicidad (Enrollment studentId+courseId, Certificate.code, Certificate.enrollmentId), registralo y seguí.
6. No migres tablas que no existían en V2 (CourseReview, ForumThread/ForumPost, Payment, PasswordResetToken, EmailVerificationToken, InstitutionEmailDomain, recomendaciones).

FASE 0 – DIAGNÓSTICO (solo lectura)
- Leé backend/prisma/schema.prisma (V3) y conectate a la BD actual (DATABASE_URL de backend/.env). Contá filas de users, courses, topics, materials, evaluations, enrollments, topic_progress, certificates, notifications.
- Revisá _prisma_migrations: si todas las migraciones tienen finished_at reciente y casi simultáneo, hubo un reset.
- Listá volúmenes y contenedores de Docker (docker volume ls, docker ps -a): buscá volúmenes viejos tipo *pecod_postgres_data* que sigan existiendo bajo otro nombre de proyecto/carpeta.
- Buscá en el disco dumps o backups: *.sql, *.dump, *.backup, *.bak, y otras carpetas del proyecto (Pecod-main_V2, etc.) con un docker-compose propio.
- Revisá si hay otra instancia de Postgres local (puerto 5432/5433) con una base pecod.
Reportame los hallazgos antes de seguir.

FASE 1 – FUENTE DE LOS DATOS V2 (en este orden de preferencia)
a) Volumen o BD de V2 sobreviviente: levantá un Postgres 16 TEMPORAL y de solo lectura lógica (puerto 5433, volumen viejo montado) sin tocar el de V3.
b) Dump (.sql/.dump): restauralo en una base temporal pecod_v2_restore en el puerto 5433 con pg_restore/psql.
c) Sin fuente de BD: intentá reconstruir lo posible desde los archivos en S3 (listá el bucket AWS_S3_BUCKET y los assets en Mux) cruzando claves con nombres de curso/tema; presentame lo encontrado y pedime los textos faltantes (nombres, descripciones, temario, preguntas) en un archivo JSON con el formato exacto que necesita el script. No generes contenido propio.

FASE 2 – SCRIPT DE RESTAURACIÓN
Creá backend/scripts/restore-v2-data.ts (ts-node, Prisma Client; para la BD origen usá una segunda conexión con SOURCE_DATABASE_URL). Debe:
1. Resolver usuarios POR EMAIL, no por id: en V3 los usuarios ya existen (los creó el seed) con ids distintos a los de V2. Armá un mapa idV2 -> idV3 para el Profesor, el Alumno, los demás profesores involucrados y la institución (dominio uade.edu.ar). Si un profesor de otro curso no existe en V3, abortá y avisame (no lo crees).
2. Remapear professorId, institutionId, studentId, authorId y cualquier FK hacia usuarios/institución usando ese mapa.
3. Copiar en orden de dependencias: Course -> Topic -> Material -> Evaluation -> Question -> QuestionOption -> Enrollment -> TopicProgress -> EvaluationAttempt (con el contenido preservado, ver migración 20261024000000_preserve_evaluation_attempt_content) -> Certificate -> Notification.
4. Valores de campos nuevos de V3: Course.price = null (gratuito, así no se exige pago), Evaluation.maxAttempts = 2, Notification.topicTitle se mantiene. Mantené isPublished tal como estaba en V2. No crees registros de Payment.
5. Respetar los límites de V1/V2: no modificar videoDurationSeconds, tamaños ni formatos.
6. Imprimir un resumen: filas leídas / insertadas / omitidas por tabla.

FASE 3 – VERIFICACIÓN (obligatoria antes de dar por terminado)
- Comparación de conteos origen vs destino por tabla y por curso (temas, materiales, evaluaciones, preguntas).
- Que el % de avance del Alumno por curso en V3 (vistos/total, Math.round) coincida con el de V2.
- Que cada videoUrl, screenRecordingUrl y fileUrl apunte a un objeto existente en S3/Mux (HEAD o listado). Reportá los rotos sin modificarlos.
- Probar por API con el backend levantado: login como francolmartinez@uade.edu.ar (Profesor123!) y verificar GET /courses/mine y el detalle de cada curso; login como efernandezraffo@uade.edu.ar (Alumno123!) y verificar "Mis cursos", acceso al contenido de cada curso, avance, intentos de evaluación y certificados descargables. Si esas contraseñas no funcionan, no las cambies: avisame.
- Correr los tests existentes (npm test en backend) para confirmar que nada se rompió.

PREVENCIÓN (al final)
- Agregá backend/scripts/backup-db.ts (o un script npm "db:backup") que haga pg_dump con timestamp.
- Actualizá el README con una advertencia: usar prisma migrate deploy (no migrate dev) en bases con datos, y nunca aceptar el prompt de reset.
- Confirmá que el seed no borra datos (usa solo findUnique/create).

ENTREGABLE
Un reporte final con: causa probable de la pérdida, fuente de datos usada, resumen por tabla, problemas encontrados (archivos rotos, conflictos) y los comandos exactos para repetir la restauración.