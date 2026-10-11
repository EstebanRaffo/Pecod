import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CatalogQueryDto } from './dto/catalog-query.dto';
import { UploadsService } from '../uploads/uploads.service';

@Injectable()
export class CoursesService {
  constructor(
    private prisma: PrismaService,
    private uploadsService: UploadsService,
  ) {}

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
  // IMPORTANTE: este método NO incluye topics; si se agrega include de topics en el futuro,
  // las URLs deben ser firmadas DESPUÉS de verificar permisos.
  findMine(user: AuthenticatedUser) {
    return this.prisma.course.findMany({
      where: { professorId: user.userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // HU4: detalle de un curso. Un Alumno no inscripto ve la descripción pero no el contenido.
  // Las presigned URLs solo se generan para el Profesor dueño del curso o para un Alumno
  // inscripto; cualquier otro usuario recibe los topics sin URLs firmadas.
  async findDetail(id: string, user: AuthenticatedUser) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: { topics: { orderBy: { order: 'asc' }, select: { id: true, title: true, order: true, videoUrl: true, screenRecordingUrl: true, materials: true } } },
    });
    if (!course) throw new NotFoundException('Curso no encontrado.');

    // Determinar si el usuario tiene derecho a acceder al contenido multimedia.
    let isEnrolled = false;
    const isProfessorOwner = user.role === Role.PROFESSOR && course.professorId === user.userId;

    if (user.role === Role.STUDENT) {
      const enrollment = await this.prisma.enrollment.findUnique({
        where: { studentId_courseId: { studentId: user.userId, courseId: id } },
      });
      isEnrolled = !!enrollment;
    }

    const canAccessContent = isProfessorOwner || isEnrolled;

    const urlToKey = (url: string) => url.replace(/^https?:\/\/[^/]+\//, '');

    // Presigned URLs only for authorized users; others receive null for media fields.
    const topics = await Promise.all(
      course.topics.map(async (topic) => {
        if (!canAccessContent) {
          return {
            ...topic,
            videoUrl: null,
            screenRecordingUrl: null,
            materials: topic.materials.map((m) => ({ ...m, fileUrl: null })),
          };
        }

        const videoUrl = topic.videoUrl
          ? await this.uploadsService.generatePresignedGetUrl(urlToKey(topic.videoUrl))
          : topic.videoUrl;

        const screenRecordingUrl = topic.screenRecordingUrl
          ? await this.uploadsService.generatePresignedGetUrl(urlToKey(topic.screenRecordingUrl))
          : topic.screenRecordingUrl;

        const materials = await Promise.all(
          topic.materials.map(async (m) => ({
            ...m,
            fileUrl: m.fileUrl
              ? await this.uploadsService.generatePresignedGetUrl(urlToKey(m.fileUrl))
              : m.fileUrl,
          })),
        );

        return { ...topic, videoUrl, screenRecordingUrl, materials };
      }),
    );

    return { ...course, topics, isEnrolled };
  }

  // HU5: alta de curso. Queda sin publicar hasta que el Profesor lo publique (HU8).
  create(user: AuthenticatedUser, dto: CreateCourseDto) {
    const { technology, ...rest } = dto;
    const tools = dto.tools ?? technology;
    return this.prisma.course.create({
      data: {
        ...rest,
        ...(tools !== undefined ? { tools } : {}),
        professorId: user.userId,
        institutionId: user.institutionId!,
        isPublished: false,
      },
    });
  }

  // HU8: editar curso existente. Solo el Profesor dueño del curso puede editarlo.
  async update(id: string, user: AuthenticatedUser, dto: UpdateCourseDto) {
    const course = await this.getOwnedCourseOrThrow(id, user);
    const { technology, ...rest } = dto;
    const tools = dto.tools !== undefined ? dto.tools : technology;
    return this.prisma.course.update({
      where: { id: course.id },
      data: {
        ...rest,
        ...(tools !== undefined ? { tools } : {}),
      },
    });
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
