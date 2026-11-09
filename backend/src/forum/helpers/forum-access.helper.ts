import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

// HU25: Helper centralizado de control de acceso al foro
// Un usuario accede si es Alumno inscripto en el curso (de su institución) o Profesor propietario
export interface ForumAccessResult {
  allowed: boolean;
  reason?: string;
}

@Injectable()
export class ForumAccessHelper {
  constructor(private prisma: PrismaService) {}

  async checkThreadAccess(
    userId: string,
    institutionId: string,
    courseId: string,
    userRole: Role,
    courseData?: { institutionId: string; professorId: string } | null,
  ): Promise<ForumAccessResult> {
    // Validar que el curso existe y pertenece a la institución
    let course = courseData;

    if (!course) {
      const courseRecord = await this.prisma.course.findUnique({
        where: { id: courseId },
        select: { id: true, institutionId: true, professorId: true },
      });

      if (!courseRecord) {
        return { allowed: false, reason: 'Curso no encontrado.' };
      }

      course = courseRecord;
    }

    // Usuario de otra institución → no delegar información (404)
    if (course.institutionId !== institutionId) {
      return { allowed: false, reason: 'No tenés acceso a este foro.' };
    }

    // Profesor propietario → permitido
    if (userRole === Role.PROFESSOR && course.professorId === userId) {
      return { allowed: true };
    }

    // Alumno inscripto → permitido
    if (userRole === Role.STUDENT) {
      const enrollment = await this.prisma.enrollment.findUnique({
        where: { studentId_courseId: { studentId: userId, courseId } },
        select: { id: true },
      });

      if (enrollment) {
        return { allowed: true };
      }

      return { allowed: false, reason: 'No estás inscripto en este curso.' };
    }

    // Cualquier otro caso (profesor ajeno, admin, etc.)
    return { allowed: false, reason: 'No tenés acceso a este foro.' };
  }

  async checkPostAccess(
    userId: string,
    institutionId: string,
    postId: string,
    userRole: Role,
  ): Promise<ForumAccessResult> {
    // Validar que el post existe y obtener el curso asociado
    const post = await this.prisma.forumPost.findUnique({
      where: { id: postId },
      select: {
        id: true,
        thread: {
          select: {
            courseId: true,
            course: {
              select: { institutionId: true, professorId: true },
            },
          },
        },
      },
    });

    if (!post) {
      return { allowed: false, reason: 'Respuesta no encontrada.' };
    }

    const courseId = post.thread.courseId;
    return this.checkThreadAccess(userId, institutionId, courseId, userRole);
  }

  async canDeleteThread(
    userId: string,
    threadId: string,
    userRole: Role,
    thread?: { authorId: string; course: { professorId: string } } | null,
  ): Promise<boolean> {
    let threadData = thread;

    if (!threadData) {
      threadData = await this.prisma.forumThread.findUnique({
        where: { id: threadId },
        select: {
          authorId: true,
          course: {
            select: { professorId: true },
          },
        },
      });
    }

    if (!threadData) return false;

    // El autor puede borrar su propia consulta
    if (threadData.authorId === userId) return true;

    // El Profesor propietario puede borrar cualquier consulta
    if (userRole === Role.PROFESSOR && threadData.course.professorId === userId) return true;

    return false;
  }

  async canDeletePost(
    userId: string,
    postId: string,
    userRole: Role,
    post?: { authorId: string; thread: { course: { professorId: string } } } | null,
  ): Promise<boolean> {
    let postData = post;

    if (!postData) {
      postData = await this.prisma.forumPost.findUnique({
        where: { id: postId },
        select: {
          authorId: true,
          thread: {
            select: {
              course: {
                select: { professorId: true },
              },
            },
          },
        },
      });
    }

    if (!postData) return false;

    // El autor puede borrar su propia respuesta
    if (postData.authorId === userId) return true;

    // El Profesor propietario puede borrar cualquier respuesta
    if (userRole === Role.PROFESSOR && postData.thread.course.professorId === userId) return true;

    return false;
  }
}
