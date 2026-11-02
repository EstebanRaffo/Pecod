import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsResponseDto } from './dto/analytics-response.dto';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  /**
   * HU21: Obtiene los indicadores analíticos de todos los cursos del profesor
   * - Cantidad de Alumnos inscriptos
   * - Porcentaje de avance promedio (redondeado)
   * - Calificación promedio (1 decimal)
   * - Cantidad de reseñas
   * 
   * Incluye cursos publicados, despublicados y borradores
   */
  async getAnalyticsByProfessor(professorId: string, institutionId: string): Promise<AnalyticsResponseDto[]> {
    // HU21 CA7: Obtener solo los cursos del profesor autenticado
    const courses = await this.prisma.course.findMany({
      where: {
        professorId,
        institutionId,
      },
      select: {
        id: true,
        name: true,
        isPublished: true,
        topics: { select: { id: true } },
        enrollments: {
          select: {
            id: true,
            studentId: true,
            topicProgress: { select: { topicId: true } },
          },
        },
        reviews: {
          select: {
            rating: true,
          },
        },
      },
    });

    return courses.map((course) => {
      // HU21 CA2: Porcentaje de avance promedio
      const totalTopics = course.topics.length;
      let averageProgress = 0;

      if (course.enrollments.length > 0) {
        if (totalTopics > 0) {
          // Calcular progreso individual de cada alumno
          const progressPercentages = course.enrollments.map((enrollment) => {
            const viewedTopics = enrollment.topicProgress.length;
            return Math.round((viewedTopics / totalTopics) * 100);
          });

          // Promediar los porcentajes (CA2: Math.round)
          averageProgress = Math.round(
            progressPercentages.reduce((sum, pct) => sum + pct, 0) / progressPercentages.length,
          );
        } else {
          // Sin temas: 0%
          averageProgress = 0;
        }
      } else {
        // Sin inscriptos: 0%
        averageProgress = 0;
      }

      // HU21 CA3: Calificación promedio
      let ratingAverage: number | null = null;
      if (course.reviews.length > 0) {
        const avgRating = course.reviews.reduce((sum, review) => sum + review.rating, 0) / course.reviews.length;
        // Redondear a 1 decimal
        ratingAverage = Math.round(avgRating * 10) / 10;
      }

      // HU21 CA1: Status del curso
      const status: 'published' | 'unpublished' | 'draft' = course.isPublished
        ? 'published'
        : course.enrollments.length > 0
          ? 'unpublished'
          : 'draft';

      return {
        courseId: course.id,
        title: course.name,
        status,
        enrolledCount: course.enrollments.length,
        averageProgress,
        ratingAverage,
        ratingCount: course.reviews.length,
      };
    });
  }
}
