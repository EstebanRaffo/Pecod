import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class EnrollmentsService {
  constructor(private prisma: PrismaService) {}

  // HU2
  async enroll(courseId: string, student: AuthenticatedUser) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Curso no encontrado.');

    // "No es posible inscribirse a un curso despublicado"
    if (!course.isPublished) {
      throw new BadRequestException('Este curso no está disponible para inscripción.');
    }

    // "El Alumno solo puede inscribirse a cursos de su institución"
    if (course.institutionId !== student.institutionId) {
      throw new BadRequestException('Solo podés inscribirte a cursos de tu institución.');
    }

    try {
      return await this.prisma.enrollment.create({
        data: { studentId: student.userId, courseId },
      });
    } catch (error: any) {
      // Constraint única (studentId, courseId) -> doble inscripción
      if (error.code === 'P2002') {
        throw new ConflictException('Ya estás inscripto en este curso.');
      }
      throw error;
    }
  }

  // HU3 & HU18: "Mis cursos" - incluye cursos despublicados luego de la inscripción
  // (se marcan como no disponibles en el frontend según course.isPublished)
  // e identifica los cursos finalizados con certificado disponible (HU18 CA9).
  async myCourses(student: AuthenticatedUser) {
    this.requireStudent(student);
    const enrollments = await this.prisma.enrollment.findMany({
      where: { studentId: student.userId },
      include: {
        certificate: { select: { id: true, code: true, issuedAt: true } },
        course: {
          include: {
            _count: { select: { topics: true } },
            evaluations: { select: { id: true } },
          },
        },
        topicProgress: { select: { topicId: true } },
      },
      orderBy: { enrolledAt: 'desc' },
    });

    const allEvalIds = enrollments.flatMap((e: any) => e.course?.evaluations?.map((ev: any) => ev.id) ?? []);
    const passedAttempts = allEvalIds.length > 0
      ? await this.prisma.evaluationAttempt.findMany({
          where: { evaluationId: { in: allEvalIds }, studentId: student.userId, passed: true },
          select: { evaluationId: true },
        })
      : [];
    const passedEvalSet = new Set(passedAttempts.map((a) => a.evaluationId));

    return enrollments.map(({ topicProgress, course, certificate, ...enrollment }: any) => {
      const { _count, evaluations, ...courseData } = course ?? {};
      const isIssued = !!certificate;
      const totalTopics = _count?.topics ?? 0;
      const allTopicsViewed = totalTopics > 0 && (topicProgress?.length ?? 0) >= totalTopics;
      const courseEvals = evaluations ?? [];
      const allEvalsPassed = courseEvals.every((ev: any) => passedEvalSet.has(ev.id));
      const certificateAvailable = isIssued || (allTopicsViewed && allEvalsPassed);

      return {
        ...enrollment,
        course: courseData,
        progress: this.summarizeProgress(topicProgress ?? [], totalTopics),
        certificateAvailable,
        certificate: certificate ?? null,
      };
    });
  }

  async getProgress(courseId: string, student: AuthenticatedUser) {
    this.requireStudent(student);
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId: student.userId, courseId } },
      include: {
        course: { select: { _count: { select: { topics: true } } } },
        topicProgress: { select: { topicId: true } },
      },
    });
    if (!enrollment) throw new ForbiddenException('Necesitás estar inscripto para registrar o ver el progreso.');
    return this.summarizeProgress(enrollment.topicProgress, enrollment.course._count.topics);
  }

  async setTopicViewed(courseId: string, topicId: string, student: AuthenticatedUser, viewed: boolean) {
    this.requireStudent(student);
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId: student.userId, courseId } },
    });
    if (!enrollment) throw new ForbiddenException('Necesitás estar inscripto para registrar o ver el progreso.');

    const topic = await this.prisma.topic.findUnique({ where: { id: topicId } });
    if (!topic || topic.courseId !== courseId) throw new NotFoundException('Tema no encontrado en este curso.');

    if (viewed) {
      await this.prisma.topicProgress.upsert({
        where: { enrollmentId_topicId: { enrollmentId: enrollment.id, topicId } },
        create: { enrollmentId: enrollment.id, topicId },
        update: {},
      });
    } else {
      await this.prisma.topicProgress.deleteMany({ where: { enrollmentId: enrollment.id, topicId } });
    }
    return this.getProgress(courseId, student);
  }

  private requireStudent(student: AuthenticatedUser) {
    if (student.role !== Role.STUDENT) throw new ForbiddenException('Solo un Alumno puede acceder al progreso.');
  }

  private summarizeProgress(topicProgress: { topicId: string }[], total: number) {
    const viewedTopicIds = topicProgress.map(({ topicId }) => topicId);
    const viewed = viewedTopicIds.length;
    return { viewed, total, percentage: total === 0 ? 0 : Math.round(viewed / total * 100), viewedTopicIds };
  }
}
