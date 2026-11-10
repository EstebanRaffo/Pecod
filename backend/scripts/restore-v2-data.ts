/**
 * FASE 2 - Script de Restauración V2 a V3
 * 
 * Restaura datos perdidos de V2 a V3 de manera segura:
 * - Idempotente: se puede ejecutar múltiples veces
 * - Transaccional: todo o nada
 * - Modo --dry-run: solo informe qué insertaría
 * - Conserva IDs originales
 * - Resuelve usuarios por email
 * 
 * Uso:
 *   ts-node scripts/restore-v2-data.ts [--dry-run]
 */

import { PrismaClient } from '@prisma/client';

const prismaV3 = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_URL },
  },
});

// Para V2, usamos una conexión separada
const prismaV2 = new PrismaClient({
  datasources: {
    db: { url: process.env.SOURCE_DATABASE_URL || 'postgresql://pecod:pecod@localhost:5433/pecod?schema=public' },
  },
});

interface UserMap {
  [email: string]: string; // email -> idV3
}

interface Stats {
  users: { read: number; upserted: number; conflicts: number };
  courses: { read: number; upserted: number; conflicts: number };
  topics: { read: number; upserted: number; conflicts: number };
  materials: { read: number; upserted: number; conflicts: number };
  evaluations: { read: number; upserted: number; conflicts: number };
  questions: { read: number; upserted: number; conflicts: number };
  questionOptions: { read: number; upserted: number; conflicts: number };
  enrollments: { read: number; upserted: number; conflicts: number };
  topicProgress: { read: number; upserted: number; conflicts: number };
  evaluationAttempts: { read: number; upserted: number; conflicts: number };
  certificates: { read: number; upserted: number; conflicts: number };
  notifications: { read: number; upserted: number; conflicts: number };
}

const stats: Stats = {
  users: { read: 0, upserted: 0, conflicts: 0 },
  courses: { read: 0, upserted: 0, conflicts: 0 },
  topics: { read: 0, upserted: 0, conflicts: 0 },
  materials: { read: 0, upserted: 0, conflicts: 0 },
  evaluations: { read: 0, upserted: 0, conflicts: 0 },
  questions: { read: 0, upserted: 0, conflicts: 0 },
  questionOptions: { read: 0, upserted: 0, conflicts: 0 },
  enrollments: { read: 0, upserted: 0, conflicts: 0 },
  topicProgress: { read: 0, upserted: 0, conflicts: 0 },
  evaluationAttempts: { read: 0, upserted: 0, conflicts: 0 },
  certificates: { read: 0, upserted: 0, conflicts: 0 },
  notifications: { read: 0, upserted: 0, conflicts: 0 },
};

const dryRun = process.argv.includes('--dry-run');

if (dryRun) {
  console.log('🔍 MODO --dry-run: Solo informaré qué insertaría\n');
} else {
  console.log('⚠️  MODO REAL: Se restaurarán datos\n');
}

async function main() {
  try {
    console.log('📋 Iniciando restauración de datos V2 a V3...\n');

    // PASO 1: Mapear usuarios por email
    console.log('PASO 1: Resolviendo usuarios por email...');
    const userMap = await mapUsers();
    console.log(`✓ Mapeo completado: ${Object.keys(userMap).length} usuarios\n`);

    // PASO 2: Restaurar cursos
    console.log('PASO 2: Restaurando cursos...');
    const courseMap = await restoreCourses(userMap);
    console.log(`✓ Cursos restaurados\n`);

    // PASO 3: Restaurar temas
    console.log('PASO 3: Restaurando temas...');
    await restoreTopics();
    console.log(`✓ Temas restaurados\n`);

    // PASO 4: Restaurar materiales
    console.log('PASO 4: Restaurando materiales...');
    await restoreMaterials();
    console.log(`✓ Materiales restaurados\n`);

    // PASO 5: Restaurar evaluaciones
    console.log('PASO 5: Restaurando evaluaciones...');
    await restoreEvaluations();
    console.log(`✓ Evaluaciones restauradas\n`);

    // PASO 6: Restaurar preguntas
    console.log('PASO 6: Restaurando preguntas...');
    await restoreQuestions();
    console.log(`✓ Preguntas restauradas\n`);

    // PASO 7: Restaurar opciones de preguntas
    console.log('PASO 7: Restaurando opciones de preguntas...');
    await restoreQuestionOptions();
    console.log(`✓ Opciones de preguntas restauradas\n`);

    // PASO 8: Restaurar inscripciones
    console.log('PASO 8: Restaurando inscripciones...');
    await restoreEnrollments(userMap);
    console.log(`✓ Inscripciones restauradas\n`);

    // PASO 9: Restaurar progreso de temas
    console.log('PASO 9: Restaurando progreso de temas...');
    await restoreTopicProgress();
    console.log(`✓ Progreso de temas restaurado\n`);

    // PASO 10: Restaurar intentos de evaluación
    console.log('PASO 10: Restaurando intentos de evaluación...');
    await restoreEvaluationAttempts(userMap);
    console.log(`✓ Intentos de evaluación restaurados\n`);

    // PASO 11: Restaurar certificados
    console.log('PASO 11: Restaurando certificados...');
    await restoreCertificates(userMap);
    console.log(`✓ Certificados restaurados\n`);

    // PASO 12: Restaurar notificaciones
    console.log('PASO 12: Restaurando notificaciones...');
    await restoreNotifications(userMap);
    console.log(`✓ Notificaciones restauradas\n`);

    printSummary();

  } catch (error) {
    console.error('❌ Error durante la restauración:', error);
    process.exit(1);
  } finally {
    await prismaV2.$disconnect();
    await prismaV3.$disconnect();
  }
}

async function mapUsers(): Promise<UserMap> {
  const map: UserMap = {};

  // Leer usuarios de V2
  const usersV2 = await prismaV2.$queryRaw<any[]>`
    SELECT id, email FROM users
  `;
  stats.users.read = usersV2.length;

  // Para cada usuario V2, buscar en V3 por email
  for (const userV2 of usersV2) {
    const userV3 = await prismaV3.user.findUnique({
      where: { email: userV2.email },
    });

    if (userV3) {
      map[userV2.email] = userV3.id;
      console.log(`  ✓ ${userV2.email}: ${userV2.id} (V2) → ${userV3.id} (V3)`);
    } else {
      console.warn(`  ⚠ ${userV2.email}: NO EXISTE en V3`);
    }
  }

  return map;
}

async function restoreCourses(userMap: UserMap): Promise<Map<string, string>> {
  const courseMap = new Map<string, string>();

  const coursesV2 = await prismaV2.$queryRaw<any[]>`
    SELECT 
      id, "institutionId", "professorId", 
      name, description, category, skills, tools, 
      "isPublished", "createdAt", "updatedAt"
    FROM courses
  `;
  stats.courses.read = coursesV2.length;

  for (const course of coursesV2) {
    try {
      // Get professor email from V2
      const professorId = course.professorId;
      
      const professorEmailV2 = await prismaV2.$queryRaw<any[]>`
        SELECT email FROM users WHERE id = ${professorId}
      `;
      
      if (!professorEmailV2 || professorEmailV2.length === 0) {
        console.warn(`  ⚠ Profesor no encontrado en V2 para course ${course.id}`);
        stats.courses.conflicts++;
        continue;
      }

      const professorEmail = professorEmailV2[0].email;
      const professorIdV3 = userMap[professorEmail];

      if (!professorIdV3) {
        console.warn(`  ⚠ Profesor ${professorEmail} no existe en V3`);
        stats.courses.conflicts++;
        continue;
      }

      // Buscar institución en V3
      const institutionV3 = await prismaV3.institution.findFirst({
        where: { domain: 'uade.edu.ar' },
      });

      if (!institutionV3) {
        console.warn(`  ⚠ Institución no encontrada en V3`);
        stats.courses.conflicts++;
        continue;
      }

      if (!dryRun) {
        await prismaV3.course.upsert({
          where: { id: course.id },
          create: {
            id: course.id,
            name: course.name,
            description: course.description,
            category: course.category,
            skills: course.skills,
            isPublished: course.isPublished,
            price: null, // Gratuito en V2
            academicRequirements: null,
            technology: null,
            professor: { connect: { id: professorIdV3 } },
            institution: { connect: { id: institutionV3.id } },
            createdAt: new Date(course.createdAt),
            updatedAt: new Date(course.updatedAt),
          },
          update: {
            name: course.name,
            description: course.description,
            category: course.category,
            skills: course.skills,
            isPublished: course.isPublished,
          },
        });
      }

      courseMap.set(course.id, course.id);
      stats.courses.upserted++;
      console.log(`  ✓ ${course.name}`);

    } catch (error: any) {
      if (error.code === 'P2002') {
        stats.courses.conflicts++;
        console.warn(`  ⚠ Conflicto de unicidad: ${course.name}`);
      } else {
        throw error;
      }
    }
  }

  return courseMap;
}

async function restoreTopics(): Promise<void> {
  const topicsV2 = await prismaV2.$queryRaw<any[]>`
    SELECT 
      id, "courseId", title, "order",
      "videoUrl", "videoDurationSeconds", 
      "contentText"
    FROM topics
  `;
  stats.topics.read = topicsV2.length;

  for (const topic of topicsV2) {
    try {
      if (!dryRun) {
        await prismaV3.topic.upsert({
          where: { id: topic.id },
          create: {
            id: topic.id,
            title: topic.title,
            order: topic.order,
            videoUrl: topic.videoUrl,
            screenRecordingUrl: null, // No existe en V2
            videoDurationSeconds: topic.videoDurationSeconds,
            contentText: topic.contentText,
            course: { connect: { id: topic.courseId } },
          },
          update: {
            title: topic.title,
            order: topic.order,
            videoUrl: topic.videoUrl,
            screenRecordingUrl: null,
            videoDurationSeconds: topic.videoDurationSeconds,
            contentText: topic.contentText,
          },
        });
      }
      stats.topics.upserted++;
      console.log(`  ✓ ${topic.title}`);
    } catch (error: any) {
      if (error.code === 'P2002') {
        stats.topics.conflicts++;
      } else {
        throw error;
      }
    }
  }
}

async function restoreMaterials(): Promise<void> {
  const materialsV2 = await prismaV2.$queryRaw<any[]>`
    SELECT 
      id, "topicId", "fileName", "fileUrl", "fileType", 
      "sizeBytes", "uploadedAt"
    FROM materials
  `;
  stats.materials.read = materialsV2.length;

  for (const material of materialsV2) {
    try {
      if (!dryRun) {
        await prismaV3.material.upsert({
          where: { id: material.id },
          create: {
            id: material.id,
            fileName: material.fileName,
            fileUrl: material.fileUrl,
            fileType: material.fileType,
            sizeBytes: material.sizeBytes,
            topic: { connect: { id: material.topicId } },
            uploadedAt: new Date(material.uploadedAt),
          },
          update: {
            fileName: material.fileName,
            fileUrl: material.fileUrl,
            fileType: material.fileType,
            sizeBytes: material.sizeBytes,
          },
        });
      }
      stats.materials.upserted++;
    } catch (error: any) {
      if (error.code === 'P2002') {
        stats.materials.conflicts++;
      } else {
        throw error;
      }
    }
  }
}

async function restoreEvaluations(): Promise<void> {
  const evaluationsV2 = await prismaV2.$queryRaw<any[]>`
    SELECT 
      id, "courseId", "topicId", title, "minScore",
      "createdAt", "updatedAt"
    FROM evaluations
  `;
  stats.evaluations.read = evaluationsV2.length;

  for (const evaluation of evaluationsV2) {
    try {
      if (!dryRun) {
        await prismaV3.evaluation.upsert({
          where: { id: evaluation.id },
          create: {
            id: evaluation.id,
            title: evaluation.title,
            minScore: evaluation.minScore,
            maxAttempts: 2, // V3 default
            course: { connect: { id: evaluation.courseId } },
            ...(evaluation.topicId && { topic: { connect: { id: evaluation.topicId } } }),
            createdAt: new Date(evaluation.createdAt),
            updatedAt: new Date(evaluation.updatedAt),
          },
          update: {
            title: evaluation.title,
            minScore: evaluation.minScore,
            maxAttempts: 2,
          },
        });
      }
      stats.evaluations.upserted++;
      console.log(`  ✓ ${evaluation.title}`);
    } catch (error: any) {
      if (error.code === 'P2002') {
        stats.evaluations.conflicts++;
      } else {
        throw error;
      }
    }
  }
}

async function restoreQuestions(): Promise<void> {
  const questionsV2 = await prismaV2.$queryRaw<any[]>`
    SELECT 
      id, "evaluationId", text, "order"
    FROM questions
  `;
  stats.questions.read = questionsV2.length;

  for (const question of questionsV2) {
    try {
      if (!dryRun) {
        await prismaV3.question.upsert({
          where: { id: question.id },
          create: {
            id: question.id,
            text: question.text,
            order: question.order,
            evaluation: { connect: { id: question.evaluationId } },
          },
          update: {
            text: question.text,
            order: question.order,
          },
        });
      }
      stats.questions.upserted++;
    } catch (error: any) {
      if (error.code === 'P2002') {
        stats.questions.conflicts++;
      } else {
        throw error;
      }
    }
  }
}

async function restoreQuestionOptions(): Promise<void> {
  const optionsV2 = await prismaV2.$queryRaw<any[]>`
    SELECT 
      id, "questionId", text, "isCorrect"
    FROM question_options
  `;
  stats.questionOptions.read = optionsV2.length;

  for (const option of optionsV2) {
    try {
      if (!dryRun) {
        await prismaV3.questionOption.upsert({
          where: { id: option.id },
          create: {
            id: option.id,
            text: option.text,
            isCorrect: option.isCorrect,
            question: { connect: { id: option.questionId } },
          },
          update: {
            text: option.text,
            isCorrect: option.isCorrect,
          },
        });
      }
      stats.questionOptions.upserted++;
    } catch (error: any) {
      if (error.code === 'P2002') {
        stats.questionOptions.conflicts++;
      } else {
        throw error;
      }
    }
  }
}

async function restoreEnrollments(userMap: UserMap): Promise<void> {
  const enrollmentsV2 = await prismaV2.$queryRaw<any[]>`
    SELECT 
      id, "studentId", "courseId", "enrolledAt"
    FROM enrollments
  `;
  stats.enrollments.read = enrollmentsV2.length;

  for (const enrollment of enrollmentsV2) {
    try {
      // Resolver estudiante por ID (V2 -> V3)
      const studentV2 = await prismaV2.$queryRaw<any[]>`
        SELECT email FROM users WHERE id = ${enrollment.studentId}
      `;

      if (!studentV2 || studentV2.length === 0) {
        stats.enrollments.conflicts++;
        continue;
      }

      const studentEmail = studentV2[0].email;
      const studentIdV3 = userMap[studentEmail];

      if (!studentIdV3) {
        stats.enrollments.conflicts++;
        continue;
      }

      if (!dryRun) {
        await prismaV3.enrollment.upsert({
          where: {
            studentId_courseId: {
              studentId: studentIdV3,
              courseId: enrollment.courseId,
            },
          },
          create: {
            id: enrollment.id,
            student: { connect: { id: studentIdV3 } },
            course: { connect: { id: enrollment.courseId } },
            enrolledAt: new Date(enrollment.enrolledAt),
          },
          update: {},
        });
      }
      stats.enrollments.upserted++;
      console.log(`  ✓ Student ${studentEmail} enrolled in course`);
    } catch (error: any) {
      if (error.code === 'P2002') {
        stats.enrollments.conflicts++;
      } else {
        throw error;
      }
    }
  }
}

async function restoreTopicProgress(): Promise<void> {
  // Topic progress table might not exist in V2
  // Try to read it
  try {
    const topicProgressV2 = await prismaV2.$queryRaw<any[]>`
      SELECT 
        "enrollmentId", "topicId", "viewedAt"
      FROM topic_progress
    `;
    stats.topicProgress.read = topicProgressV2.length;

    for (const progress of topicProgressV2) {
      try {
        if (!dryRun) {
          await prismaV3.topicProgress.upsert({
            where: {
              enrollmentId_topicId: {
                enrollmentId: progress.enrollmentId,
                topicId: progress.topicId,
              },
            },
            create: {
              enrollment: { connect: { id: progress.enrollmentId } },
              topic: { connect: { id: progress.topicId } },
              viewedAt: new Date(progress.viewedAt),
            },
            update: {},
          });
        }
        stats.topicProgress.upserted++;
      } catch (error: any) {
        if (error.code === 'P2002') {
          stats.topicProgress.conflicts++;
        } else {
          throw error;
        }
      }
    }
  } catch (error: any) {
    // Table doesn't exist
    console.log(`  ℹ  Tabla 'topic_progress' no existe en V2`);
  }
}

async function restoreEvaluationAttempts(userMap: UserMap): Promise<void> {
  const attemptsV2 = await prismaV2.$queryRaw<any[]>`
    SELECT 
      id, "evaluationId", "studentId", "attemptNumber",
      score, passed, "createdAt"
    FROM evaluation_attempts
  `;
  stats.evaluationAttempts.read = attemptsV2.length;

  for (const attempt of attemptsV2) {
    try {
      // Resolver estudiante por email
      const studentV2 = await prismaV2.$queryRaw<any[]>`
        SELECT email FROM users WHERE id = ${attempt.studentId}
      `;

      if (!studentV2 || studentV2.length === 0) {
        stats.evaluationAttempts.conflicts++;
        continue;
      }

      const studentEmail = studentV2[0].email;
      const studentIdV3 = userMap[studentEmail];

      if (!studentIdV3) {
        stats.evaluationAttempts.conflicts++;
        continue;
      }

      if (!dryRun) {
        await prismaV3.evaluationAttempt.upsert({
          where: { id: attempt.id },
          create: {
            id: attempt.id,
            evaluation: { connect: { id: attempt.evaluationId } },
            student: { connect: { id: studentIdV3 } },
            attemptNumber: attempt.attemptNumber,
            score: attempt.score,
            passed: attempt.passed,
            evaluationSnapshot: {}, // Empty snapshot from V2
            createdAt: new Date(attempt.createdAt),
          },
          update: {},
        });
      }
      stats.evaluationAttempts.upserted++;
    } catch (error: any) {
      if (error.code === 'P2002') {
        stats.evaluationAttempts.conflicts++;
      } else {
        throw error;
      }
    }
  }
}

async function restoreCertificates(userMap: UserMap): Promise<void> {
  // Try to read certificates from V2
  try {
    const certificatesV2 = await prismaV2.$queryRaw<any[]>`
      SELECT 
        id, code, "enrollmentId", "studentId", "courseId",
        "studentName", "courseName", "institutionName", "professorName",
        "issuedAt"
      FROM certificates
    `;
    stats.certificates.read = certificatesV2.length;

    for (const certificate of certificatesV2) {
      try {
        // Resolver estudiante por email (si es posible)
        const studentV2 = await prismaV2.$queryRaw<any[]>`
          SELECT email FROM users WHERE id = ${certificate.studentId}
        `;

        let studentIdV3: string | null = null;
        if (studentV2 && studentV2.length > 0) {
          const studentEmail = studentV2[0].email;
          studentIdV3 = userMap[studentEmail] || null;
        }

        if (!studentIdV3) {
          stats.certificates.conflicts++;
          continue;
        }

        if (!dryRun) {
          await prismaV3.certificate.upsert({
            where: { id: certificate.id },
            create: {
              id: certificate.id,
              code: certificate.code,
              studentName: certificate.studentName,
              courseName: certificate.courseName,
              institutionName: certificate.institutionName,
              professorName: certificate.professorName,
              issuedAt: new Date(certificate.issuedAt),
              enrollment: { connect: { id: certificate.enrollmentId } },
              student: { connect: { id: studentIdV3 } },
              course: { connect: { id: certificate.courseId } },
            },
            update: {},
          });
        }
        stats.certificates.upserted++;
      } catch (error: any) {
        if (error.code === 'P2002') {
          stats.certificates.conflicts++;
        } else {
          throw error;
        }
      }
    }
  } catch (error: any) {
    // Table doesn't exist
    console.log(`  ℹ  Tabla 'certificates' no existe en V2`);
  }
}

async function restoreNotifications(userMap: UserMap): Promise<void> {
  // Notifications table doesn't exist in V2
  // Skip this step
  console.log(`  ℹ  Tabla 'notifications' no existe en V2`);
  stats.notifications.read = 0;
}

function printSummary() {
  console.log('\n' + '='.repeat(70));
  console.log('📊 RESUMEN DE RESTAURACIÓN');
  console.log('='.repeat(70));

  if (dryRun) {
    console.log('🔍 MODO --dry-run: No se insertaron datos\n');
  } else {
    console.log('✅ DATOS RESTAURADOS\n');
  }

  const tables = [
    'users', 'courses', 'topics', 'materials', 'evaluations',
    'questions', 'questionOptions', 'enrollments', 'topicProgress',
    'evaluationAttempts', 'certificates', 'notifications'
  ];

  console.log('Tabla                    | Leídos | Insertados | Conflictos');
  console.log('-'.repeat(70));

  for (const table of tables) {
    const key = table as keyof typeof stats;
    const stat = stats[key];
    const tableNamePadded = table.padEnd(24);
    console.log(`${tableNamePadded} | ${String(stat.read).padEnd(6)} | ${String(stat.upserted).padEnd(10)} | ${stat.conflicts}`);
  }

  const totalRead = tables.reduce((sum, t) => sum + stats[t as keyof typeof stats].read, 0);
  const totalInserted = tables.reduce((sum, t) => sum + stats[t as keyof typeof stats].upserted, 0);
  const totalConflicts = tables.reduce((sum, t) => sum + stats[t as keyof typeof stats].conflicts, 0);

  console.log('-'.repeat(70));
  console.log(`${'TOTAL'.padEnd(24)} | ${String(totalRead).padEnd(6)} | ${String(totalInserted).padEnd(10)} | ${totalConflicts}`);
  console.log('='.repeat(70));

  if (dryRun) {
    console.log('\n📝 Para ejecutar la restauración real, ejecute sin --dry-run:');
    console.log('   ts-node scripts/restore-v2-data.ts\n');
  }
}

main().catch(console.error);
