import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CourseCompletionService } from '../common/services/course-completion.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

@Injectable()
export class ReviewsService {
  constructor(
    private prisma: PrismaService,
    private courseCompletion: CourseCompletionService,
  ) {}

  // HU20: Crear reseña
  async create(courseId: string, student: AuthenticatedUser, dto: CreateReviewDto) {
    this.requireStudent(student);

    // Validar que el curso existe
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, institutionId: true },
    });
    if (!course) throw new NotFoundException('Curso no encontrado.');

    // HU20 CA9: Validar que el alumno es de la misma institución
    if (course.institutionId !== student.institutionId) {
      throw new ForbiddenException('Solo podés reseñar cursos de tu institución.');
    }

    // HU20 CA1: Validar elegibilidad
    const eligibility = await this.courseCompletion.canReviewCourse(courseId, student.userId);
    if (!eligibility.eligible) {
      throw new BadRequestException(eligibility.reason || 'No podés reseñar este curso.');
    }

    // HU20 CA4: Validar que no existe reseña previa
    const existingReview = await this.prisma.courseReview.findUnique({
      where: { courseId_studentId: { courseId, studentId: student.userId } },
    });
    if (existingReview) {
      throw new ConflictException('Ya tenés una reseña para este curso. Podés editarla o eliminarla.');
    }

    // HU20 CA3: Comentario opcional, máx 1000 caracteres (ya validado en DTO)
    return this.prisma.courseReview.create({
      data: {
        courseId,
        studentId: student.userId,
        rating: dto.rating,
        comment: dto.comment || null,
      },
    });
  }

  // HU20: Editar reseña propia
  async update(courseId: string, student: AuthenticatedUser, dto: UpdateReviewDto) {
    this.requireStudent(student);

    // Validar que el curso existe
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { institutionId: true },
    });
    if (!course) throw new NotFoundException('Curso no encontrado.');

    // HU20 CA9: Validar institución
    if (course.institutionId !== student.institutionId) {
      throw new ForbiddenException('Solo podés editar reseñas de cursos de tu institución.');
    }

    // Validar que existe la reseña propia
    const review = await this.prisma.courseReview.findUnique({
      where: { courseId_studentId: { courseId, studentId: student.userId } },
    });
    if (!review) {
      throw new NotFoundException('No tenés una reseña en este curso.');
    }

    // HU20 CA4: Actualizar la reseña (updatedAt se actualiza automáticamente en Prisma)
    return this.prisma.courseReview.update({
      where: { id: review.id },
      data: {
        rating: dto.rating,
        comment: dto.comment || null,
      },
    });
  }

  // HU20: Eliminar reseña propia
  async delete(courseId: string, student: AuthenticatedUser) {
    this.requireStudent(student);

    // Validar que el curso existe
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { institutionId: true },
    });
    if (!course) throw new NotFoundException('Curso no encontrado.');

    // HU20 CA9: Validar institución
    if (course.institutionId !== student.institutionId) {
      throw new ForbiddenException('Solo podés eliminar reseñas de cursos de tu institución.');
    }

    // Validar que existe la reseña propia
    const review = await this.prisma.courseReview.findUnique({
      where: { courseId_studentId: { courseId, studentId: student.userId } },
    });
    if (!review) {
      throw new NotFoundException('No tenés una reseña en este curso.');
    }

    // HU20 CA4: Eliminar
    await this.prisma.courseReview.delete({
      where: { id: review.id },
    });
  }

  // HU20: Obtener reseñas de un curso (más reciente primero)
  async getByCourse(courseId: string, user: AuthenticatedUser) {
    // Validar que el curso existe
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, institutionId: true, isPublished: true },
    });
    if (!course) throw new NotFoundException('Curso no encontrado.');

    // HU20 CA9: El usuario debe ser de la misma institución
    if (user.role !== Role.ADMIN && course.institutionId !== user.institutionId) {
      throw new ForbiddenException('Solo podés ver reseñas de cursos de tu institución.');
    }

    // HU20 CA6: Listar reseñas ordenadas de más reciente a más antigua
    const reviews = await this.prisma.courseReview.findMany({
      where: { courseId },
      include: {
        student: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // HU20 CA6: Calcular promedio y cantidad
    const ratingCount = reviews.length;
    const ratingAverage =
      ratingCount > 0 ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / ratingCount) * 10) / 10 : null;

    // Mapear respuesta
    const mappedReviews = reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      studentName: review.student.name,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    }));

    return {
      ratingAverage,
      ratingCount,
      reviews: mappedReviews,
    };
  }

  // HU20 CA6: Obtener estadísticas de reseñas para múltiples cursos (evita N+1)
  async getStatisticsByCourses(courseIds: string[]): Promise<
    Map<
      string,
      {
        ratingAverage: number | null;
        ratingCount: number;
      }
    >
  > {
    if (courseIds.length === 0) {
      return new Map();
    }

    // Usar aggregation para obtener promedio y conteo en una sola query
    const stats = await this.prisma.courseReview.groupBy({
      by: ['courseId'],
      where: { courseId: { in: courseIds } },
      _avg: { rating: true },
      _count: { id: true },
    });

    const result = new Map<string, { ratingAverage: number | null; ratingCount: number }>();

    // Inicializar con valores por defecto para todos los cursos
    courseIds.forEach((courseId) => {
      result.set(courseId, { ratingAverage: null, ratingCount: 0 });
    });

    // Llenar con estadísticas calculadas
    stats.forEach((stat) => {
      const ratingAverage = stat._avg.rating ? Math.round(stat._avg.rating * 10) / 10 : null;
      result.set(stat.courseId, {
        ratingAverage,
        ratingCount: stat._count.id,
      });
    });

    return result;
  }

  // HU20 CA4: Obtener reseña propia del usuario (si existe)
  async getOwnReview(courseId: string, student: AuthenticatedUser) {
    return this.prisma.courseReview.findUnique({
      where: { courseId_studentId: { courseId, studentId: student.userId } },
    });
  }

  private requireStudent(user: AuthenticatedUser) {
    if (user.role !== Role.STUDENT) {
      throw new ForbiddenException('Solo los Alumnos pueden reseñar cursos.');
    }
  }
}
