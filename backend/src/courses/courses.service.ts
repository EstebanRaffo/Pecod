import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CatalogQueryDto } from './dto/catalog-query.dto';

@Injectable()
export class CoursesService {
  constructor(private prisma: PrismaService) {}

  // HU1: catálogo con filtro combinable por categoría y/o tecnología.
  // El catálogo respeta el aislamiento multi-tenant: cada usuario ve solo
  // los cursos de su institución (el ADMIN, con alcance global, ve todos).
  async catalog(user: AuthenticatedUser, query: CatalogQueryDto) {
    return this.prisma.course.findMany({
      where: {
        isPublished: true,
        ...(user.role !== Role.ADMIN ? { institutionId: user.institutionId! } : {}),
        ...(query.category ? { category: { equals: query.category, mode: 'insensitive' } } : {}),
        ...(query.technology
          ? { tools: { contains: query.technology, mode: 'insensitive' } }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Cursos propios del Profesor, incluyendo borradores (no solo los publicados).
  findMine(user: AuthenticatedUser) {
    return this.prisma.course.findMany({
      where: { professorId: user.userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // HU4: detalle de un curso. Un Alumno no inscripto ve la descripción pero no el contenido
  // (el contenido de las clases se sirve desde el módulo topics, que valida la inscripción).
  async findDetail(id: string, user: AuthenticatedUser) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: { topics: { orderBy: { order: 'asc' }, select: { id: true, title: true, order: true, videoUrl: true } } },
    });
    if (!course) throw new NotFoundException('Curso no encontrado.');

    let isEnrolled = false;
    if (user.role === Role.STUDENT) {
      const enrollment = await this.prisma.enrollment.findUnique({
        where: { studentId_courseId: { studentId: user.userId, courseId: id } },
      });
      isEnrolled = !!enrollment;
    }

    return { ...course, isEnrolled };
  }

  // HU5: alta de curso. Queda sin publicar hasta que el Profesor lo publique (HU8).
  create(user: AuthenticatedUser, dto: CreateCourseDto) {
    return this.prisma.course.create({
      data: {
        ...dto,
        professorId: user.userId,
        institutionId: user.institutionId!,
        isPublished: false,
      },
    });
  }

  // HU8: editar curso existente. Solo el Profesor dueño del curso puede editarlo.
  async update(id: string, user: AuthenticatedUser, dto: UpdateCourseDto) {
    const course = await this.getOwnedCourseOrThrow(id, user);
    return this.prisma.course.update({ where: { id: course.id }, data: dto });
  }

  // HU8: publicar / despublicar. Se permite despublicar con alumnos inscriptos
  // (mantienen acceso a su contenido; ver módulo enrollments/topics).
  async setPublished(id: string, user: AuthenticatedUser, isPublished: boolean) {
    const course = await this.getOwnedCourseOrThrow(id, user);
    return this.prisma.course.update({ where: { id: course.id }, data: { isPublished } });
  }

  private async getOwnedCourseOrThrow(id: string, user: AuthenticatedUser) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) throw new NotFoundException('Curso no encontrado.');
    // HU8: "un Profesor no puede editar cursos que no le pertenecen"
    if (course.professorId !== user.userId) {
      throw new ForbiddenException('No podés modificar un curso que no te pertenece.');
    }
    return course;
  }
}
