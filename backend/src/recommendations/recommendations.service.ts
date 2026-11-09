import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface InterestProfile {
  categoryWeights: Record<string, number>;
  technologyWeights: Record<string, number>;
}

// HU24: Recomendación de cursos basada en el historial de inscripciones
// y el avance del Alumno
@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Normaliza strings para comparación: lowercase y sin espacios sobrantes
   */
  private normalize(str: string | null | undefined): string {
    if (!str) return '';
    return str.toLowerCase().trim();
  }

  /**
   * Calcula el perfil de intereses de un Alumno basado en su historial
   * de inscripciones y su avance en cada curso
   */
  private async calculateStudentProfile(studentId: string): Promise<InterestProfile> {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { studentId },
      include: {
        course: { select: { id: true, category: true, technology: true } },
      },
    });

    if (enrollments.length === 0) {
      return { categoryWeights: {}, technologyWeights: {} };
    }

    const categoryWeights: Record<string, number> = {};
    const technologyWeights: Record<string, number> = {};

    for (const enrollment of enrollments) {
      // Obtener el avance (porcentaje de topics vistos)
      const topicsInCourse = await this.prisma.topic.count({
        where: { courseId: enrollment.courseId },
      });

      if (topicsInCourse === 0) continue;

      const viewedTopics = await this.prisma.topicProgress.count({
        where: { enrollment: { id: enrollment.id } },
      });

      const progress = topicsInCourse > 0 ? Math.min(100, Math.round((viewedTopics / topicsInCourse) * 100)) : 0;
      const weight = 1 + progress / 100;

      // Acumular peso por categoría (normalizada)
      const normalizedCategory = this.normalize(enrollment.course.category);
      if (normalizedCategory) {
        categoryWeights[normalizedCategory] = (categoryWeights[normalizedCategory] || 0) + weight;
      }

      // Acumular peso por tecnología (normalizada)
      const normalizedTechnology = this.normalize(enrollment.course.technology);
      if (normalizedTechnology) {
        technologyWeights[normalizedTechnology] = (technologyWeights[normalizedTechnology] || 0) + weight;
      }
    }

    return { categoryWeights, technologyWeights };
  }

  /**
   * Obtiene los cursos candidatos para recomendación:
   * - Publicados y activos
   * - De la misma institución del Alumno
   * - En los que el Alumno NO está inscripto
   * - Que no se le hayan recomendado ya
   */
  private async getCandidateCourses(
    studentId: string,
    institutionId: string,
  ): Promise<Array<{ id: string; name: string; category: string; technology: string | null; enrollmentCount: number; createdAt: Date }>> {
    // Obtener IDs de cursos en los que ya está inscripto
    const enrolledCourseIds = await this.prisma.enrollment.findMany({
      where: { studentId },
      select: { courseId: true },
    });
    const enrolledIds = enrolledCourseIds.map((e) => e.courseId);

    // Obtener IDs de cursos ya recomendados
    const recommendedCourseIds = await this.prisma.notification.findMany({
      where: {
        studentId,
        event: 'COURSE_RECOMMENDED',
      },
      select: { courseId: true },
    });
    const recommendedIds = recommendedCourseIds.map((n) => n.courseId);

    // Excluir inscriptos y recomendados
    const excludeIds = [...new Set([...enrolledIds, ...recommendedIds])];

    // Obtener cursos publicados y activos
    const candidates = await this.prisma.course.findMany({
      where: {
        isPublished: true,
        institutionId,
        NOT: { id: { in: excludeIds } },
      },
      select: {
        id: true,
        name: true,
        category: true,
        technology: true,
        enrollments: { select: { id: true } },
        createdAt: true,
      },
    });

    return candidates.map((c) => ({
      id: c.id,
      name: c.name,
      category: c.category,
      technology: c.technology,
      enrollmentCount: c.enrollments.length,
      createdAt: c.createdAt,
    }));
  }

  /**
   * Rankea y selecciona los mejores cursos basado en el perfil de intereses
   * Puntaje = pesoCategoria + pesoTecnologia (ambos normalizados)
   * Desempate: cantidad de inscriptos (desc) y luego fecha de creación (desc)
   */
  private rankAndSelectCourses(
    candidates: Array<{ id: string; name: string; category: string; technology: string | null; enrollmentCount: number; createdAt: Date }>,
    profile: InterestProfile,
  ): Array<{ id: string; name: string; category: string; technology: string | null }> {
    const scoredCourses = candidates
      .map((course) => {
        const normalizedCategory = this.normalize(course.category);
        const normalizedTechnology = this.normalize(course.technology);

        const categoryWeight = profile.categoryWeights[normalizedCategory] || 0;
        const technologyWeight = profile.technologyWeights[normalizedTechnology] || 0;

        const score = categoryWeight + technologyWeight;

        return {
          ...course,
          score,
        };
      })
      .filter((c) => c.score > 0)
      .sort((a, b) => {
        // Ordenar por puntaje descendente
        if (b.score !== a.score) return b.score - a.score;
        // Desempate: cantidad de inscriptos descendente
        if (b.enrollmentCount !== a.enrollmentCount) return b.enrollmentCount - a.enrollmentCount;
        // Desempate: fecha de creación descendente (más recientes primero)
        return b.createdAt.getTime() - a.createdAt.getTime();
      })
      .slice(0, 3); // Máximo 3 recomendaciones

    return scoredCourses.map(({ id, name, category, technology }) => ({ id, name, category, technology }));
  }

  /**
   * Crea notificaciones para los cursos recomendados, evitando duplicados
   */
  private async createNotifications(
    studentId: string,
    recommendedCourses: Array<{ id: string; name: string; category: string; technology: string | null }>,
  ): Promise<number> {
    if (recommendedCourses.length === 0) {
      return 0;
    }

    // Verificar que no existan duplicados (adicional a la validación previa)
    const existingRecommendations = await this.prisma.notification.findMany({
      where: {
        studentId,
        courseId: { in: recommendedCourses.map((c) => c.id) },
        event: 'COURSE_RECOMMENDED',
      },
      select: { courseId: true },
    });
    const existingIds = new Set(existingRecommendations.map((n) => n.courseId));

    const toCreate = recommendedCourses.filter((c) => !existingIds.has(c.id));

    if (toCreate.length === 0) {
      return 0;
    }

    await this.prisma.notification.createMany({
      data: toCreate.map((course) => ({
        studentId,
        courseId: course.id,
        courseName: course.name,
        topicId: null,
        topicTitle: null,
        event: 'COURSE_RECOMMENDED',
      })),
    });

    return toCreate.length;
  }

  /**
   * Método principal: genera recomendaciones para todos los estudiantes
   * Se ejecuta una vez por semana (vía @Cron)
   */
  async generateForAllStudents(): Promise<{ totalStudents: number; totalNotifications: number }> {
    this.logger.log('Iniciando generación de recomendaciones de cursos...');

    try {
      // Obtener todos los estudiantes de todas las instituciones
      const students = await this.prisma.user.findMany({
        where: { role: 'STUDENT' },
        select: { id: true, institutionId: true },
      });

      let totalNotifications = 0;

      for (const student of students) {
        if (!student.institutionId) {
          // Los estudiantes siempre deben tener una institución
          continue;
        }

        try {
          // 1. Calcular perfil de intereses
          const profile = await this.calculateStudentProfile(student.id);

          // Si no tiene pesos de interés (sin inscripciones), no generar recomendaciones
          if (Object.keys(profile.categoryWeights).length === 0 && Object.keys(profile.technologyWeights).length === 0) {
            continue;
          }

          // 2. Obtener cursos candidatos
          const candidates = await this.getCandidateCourses(student.id, student.institutionId);

          // Si no hay candidatos, no generar nada
          if (candidates.length === 0) {
            continue;
          }

          // 3. Rankear y seleccionar
          const recommended = this.rankAndSelectCourses(candidates, profile);

          // 4. Crear notificaciones
          const created = await this.createNotifications(student.id, recommended);
          totalNotifications += created;

          if (created > 0) {
            this.logger.debug(`${created} recomendaciones creadas para estudiante ${student.id}`);
          }
        } catch (error) {
          this.logger.error(`Error al procesar recomendaciones para estudiante ${student.id}: ${error}`);
          // Continuar con el siguiente estudiante
        }
      }

      this.logger.log(`Generación de recomendaciones completada. Total: ${totalNotifications} notificaciones creadas.`);
      return { totalStudents: students.length, totalNotifications };
    } catch (error) {
      this.logger.error(`Error durante la generación de recomendaciones: ${error}`);
      throw error;
    }
  }
}
