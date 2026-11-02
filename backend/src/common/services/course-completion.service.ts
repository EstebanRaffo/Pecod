import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CourseCompletionService {
  constructor(private prisma: PrismaService) {}

  /**
   * Calcula el porcentaje de progreso en un curso
   * HU16: Math.round(vistos / totales * 100)
   */
  async getProgressPercentage(courseId: string, studentId: string): Promise<number> {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId, courseId } },
      include: {
        course: { select: { _count: { select: { topics: true } } } },
        topicProgress: { select: { topicId: true } },
      },
    });

    if (!enrollment) return 0;

    const totalTopics = enrollment.course._count.topics;
    if (totalTopics === 0) return 0;

    const viewedTopics = enrollment.topicProgress.length;
    return Math.round((viewedTopics / totalTopics) * 100);
  }

  /**
   * Verifica si un curso está finalizado según HU-18 CA2
   * Condiciones:
   * - Todos los temas deben estar vistos (o curso sin temas = no finalizado)
   * - Si hay evaluaciones: todas deben estar aprobadas
   * - Si no hay evaluaciones: con 100% de temas es suficiente
   */
  async isCourseFinalizado(courseId: string, studentId: string): Promise<boolean> {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId, courseId } },
      include: {
        course: {
          select: {
            _count: { select: { topics: true } },
            evaluations: { select: { id: true } },
          },
        },
        topicProgress: { select: { topicId: true } },
      },
    });

    if (!enrollment) return false;

    const totalTopics = enrollment.course._count.topics;
    const viewedTopics = enrollment.topicProgress.length;

    // Curso sin temas no se considera finalizado (HU18 CA2)
    if (totalTopics === 0) return false;

    // Todos los temas deben estar vistos
    if (viewedTopics < totalTopics) return false;

    // Si no hay evaluaciones, con todos los temas es suficiente
    if (enrollment.course.evaluations.length === 0) return true;

    // Verificar que todas las evaluaciones estén aprobadas
    const evaluationIds = enrollment.course.evaluations.map((e) => e.id);
    const attempts = await this.prisma.evaluationAttempt.findMany({
      where: {
        evaluationId: { in: evaluationIds },
        studentId,
      },
      select: { evaluationId: true, passed: true },
    });

    for (const evaluation of enrollment.course.evaluations) {
      const evalAttempts = attempts.filter((a) => a.evaluationId === evaluation.id);
      const hasPassed = evalAttempts.some((a) => a.passed);
      if (!hasPassed) return false;
    }

    return true;
  }

  /**
   * Verifica si un Alumno puede reseñar un curso (HU20 CA1)
   * Debe estar inscripto Y (curso finalizado O >= 50% de avance)
   * Retorna {eligible: bool, reason?: string}
   */
  async canReviewCourse(courseId: string, studentId: string): Promise<{ eligible: boolean; reason?: string }> {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId, courseId } },
      include: {
        course: {
          select: {
            _count: { select: { topics: true } },
            evaluations: { select: { id: true } },
          },
        },
        topicProgress: { select: { topicId: true } },
      },
    });

    if (!enrollment) {
      return { eligible: false, reason: 'No estás inscripto en este curso.' };
    }

    // Calcular progreso basado en el enrollment ya cargado
    const totalTopics = enrollment.course._count.topics;
    const viewedTopics = enrollment.topicProgress.length;
    const progress = totalTopics === 0 ? 0 : Math.round((viewedTopics / totalTopics) * 100);

    // Verificar si está finalizado
    let isFinalized = false;
    if (totalTopics > 0 && viewedTopics >= totalTopics) {
      if (enrollment.course.evaluations.length === 0) {
        isFinalized = true;
      } else {
        // Verificar evaluaciones
        const evaluationIds = enrollment.course.evaluations.map((e) => e.id);
        const attempts = await this.prisma.evaluationAttempt.findMany({
          where: {
            evaluationId: { in: evaluationIds },
            studentId,
          },
          select: { evaluationId: true, passed: true },
        });

        isFinalized = enrollment.course.evaluations.every((evaluation) => {
          const evalAttempts = attempts.filter((a) => a.evaluationId === evaluation.id);
          return evalAttempts.some((a) => a.passed);
        });
      }
    }

    if (isFinalized) {
      return { eligible: true };
    }

    // Verificar si tiene al menos 50% de avance
    if (progress >= 50) {
      return { eligible: true };
    }

    return {
      eligible: false,
      reason: `Necesitás tener al menos 50% de avance o finalizar el curso. Actualmente tenés ${progress}%.`,
    };
  }
}
