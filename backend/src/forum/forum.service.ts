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
import { CreateForumThreadDto } from './dto/create-forum-thread.dto';
import { CreateForumPostDto } from './dto/create-forum-post.dto';
import { ForumAccessHelper } from './helpers/forum-access.helper';

// HU25: Servicio del foro de consultas por curso
@Injectable()
export class ForumService {
  constructor(
    private prisma: PrismaService,
    private forumAccess: ForumAccessHelper,
  ) {}

  // HU25 CA1: Listar consultas del curso paginadas
  async listThreads(
    courseId: string,
    user: AuthenticatedUser,
    page: number = 1,
    topicId?: string,
  ) {
    // Validar acceso al foro del curso
    const accessResult = await this.forumAccess.checkThreadAccess(
      user.userId,
      user.institutionId!,
      courseId,
      user.role,
    );

    if (!accessResult.allowed) {
      throw new ForbiddenException(accessResult.reason || 'No tenés acceso a este foro.');
    }

    const pageSize = 20;
    const skip = (page - 1) * pageSize;

    // Construir filtro dinámico
    const where: any = { courseId };
    if (topicId) {
      where.topicId = topicId;
    }

    // Contar total de consultas (para paginación)
    const total = await this.prisma.forumThread.count({ where });

    // Obtener consultas: más reciente primero, con cantidad de respuestas
    const threads = await this.prisma.forumThread.findMany({
      where,
      select: {
        id: true,
        title: true,
        topicId: true,
        topic: { select: { title: true } },
        author: { select: { id: true, name: true } },
        createdAt: true,
        _count: { select: { posts: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    });

    // Mapear respuesta
    const mappedThreads = threads.map((t) => ({
      id: t.id,
      title: t.title,
      topic: t.topic ? t.topic.title : 'Tema eliminado',
      author: t.author.name,
      createdAt: t.createdAt,
      replyCount: t._count.posts,
    }));

    return {
      data: mappedThreads,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  // HU25 CA1: Crear una consulta
  async createThread(
    courseId: string,
    user: AuthenticatedUser,
    dto: CreateForumThreadDto,
  ) {
    // Solo Alumnos inscriptos pueden crear consultas
    if (user.role !== Role.STUDENT) {
      throw new ForbiddenException('Solo los Alumnos inscriptos pueden crear consultas.');
    }

    // Validar acceso al foro del curso
    const accessResult = await this.forumAccess.checkThreadAccess(
      user.userId,
      user.institutionId!,
      courseId,
      user.role,
    );

    if (!accessResult.allowed) {
      throw new ForbiddenException(accessResult.reason || 'No tenés acceso a este foro.');
    }

    // Validar que el tema existe en el curso
    const topic = await this.prisma.topic.findUnique({
      where: { id: dto.topicId },
      select: { id: true, courseId: true },
    });

    if (!topic || topic.courseId !== courseId) {
      throw new BadRequestException('El tema seleccionado no existe en este curso.');
    }

    // Trim y validar longitudes
    const trimmedTitle = dto.title.trim();
    const trimmedBody = dto.body.trim();

    if (trimmedTitle.length === 0 || trimmedTitle.length > 120) {
      throw new BadRequestException('El título debe tener entre 1 y 120 caracteres.');
    }

    if (trimmedBody.length === 0 || trimmedBody.length > 2000) {
      throw new BadRequestException('El contenido debe tener entre 1 y 2000 caracteres.');
    }

    // Crear la consulta
    return this.prisma.forumThread.create({
      data: {
        courseId,
        topicId: dto.topicId,
        authorId: user.userId,
        title: trimmedTitle,
        body: trimmedBody,
      },
      select: {
        id: true,
        title: true,
        body: true,
        topicId: true,
        topic: { select: { title: true } },
        author: { select: { id: true, name: true } },
        createdAt: true,
      },
    });
  }

  // HU25 CA3: Obtener detalle de una consulta con sus respuestas
  async getThread(threadId: string, user: AuthenticatedUser) {
    const thread = await this.prisma.forumThread.findUnique({
      where: { id: threadId },
      select: {
        id: true,
        courseId: true,
        topicId: true,
        topic: { select: { title: true } },
        title: true,
        body: true,
        author: { select: { id: true, name: true } },
        createdAt: true,
        course: { select: { institutionId: true, professorId: true } },
      },
    });

    if (!thread) {
      throw new NotFoundException('Consulta no encontrada.');
    }

    // Validar acceso
    const accessResult = await this.forumAccess.checkThreadAccess(
      user.userId,
      user.institutionId!,
      thread.courseId,
      user.role,
      { institutionId: thread.course.institutionId, professorId: thread.course.professorId },
    );

    if (!accessResult.allowed) {
      throw new ForbiddenException(accessResult.reason || 'No tenés acceso a esta consulta.');
    }

    // Obtener respuestas en orden cronológico
    const posts = await this.prisma.forumPost.findMany({
      where: { threadId },
      select: {
        id: true,
        body: true,
        author: { select: { id: true, name: true } },
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      id: thread.id,
      title: thread.title,
      body: thread.body,
      topic: thread.topic ? thread.topic.title : 'Tema eliminado',
      author: thread.author.name,
      createdAt: thread.createdAt,
      canDelete: user.userId === thread.author.id || user.role === Role.PROFESSOR,
      posts: posts.map((p) => ({
        id: p.id,
        body: p.body,
        author: p.author.name,
        createdAt: p.createdAt,
        canDelete: user.userId === p.author.id || user.role === Role.PROFESSOR,
      })),
    };
  }

  // HU25 CA2: Crear una respuesta a una consulta
  async createPost(
    threadId: string,
    user: AuthenticatedUser,
    dto: CreateForumPostDto,
  ) {
    // Validar que el hilo existe
    const thread = await this.prisma.forumThread.findUnique({
      where: { id: threadId },
      select: {
        id: true,
        courseId: true,
        course: { select: { institutionId: true, professorId: true } },
      },
    });

    if (!thread) {
      throw new NotFoundException('Consulta no encontrada.');
    }

    // Validar acceso al foro del curso
    const accessResult = await this.forumAccess.checkThreadAccess(
      user.userId,
      user.institutionId!,
      thread.courseId,
      user.role,
      { institutionId: thread.course.institutionId, professorId: thread.course.professorId },
    );

    if (!accessResult.allowed) {
      throw new ForbiddenException(accessResult.reason || 'No tenés acceso a este foro.');
    }

    // Solo Alumnos inscriptos y Profesor propietario pueden responder
    if (user.role === Role.STUDENT) {
      // Ya validado en checkThreadAccess (debe estar inscripto)
    } else if (user.role === Role.PROFESSOR) {
      // Solo el profesor propietario del curso puede responder
      if (thread.course.professorId !== user.userId) {
        throw new ForbiddenException('Solo el Profesor propietario puede responder en este foro.');
      }
    } else {
      throw new ForbiddenException('No tenés permiso para responder en este foro.');
    }

    // Trim y validar longitud
    const trimmedBody = dto.body.trim();

    if (trimmedBody.length === 0 || trimmedBody.length > 2000) {
      throw new BadRequestException(
        'La respuesta debe tener entre 1 y 2000 caracteres.',
      );
    }

    // Crear la respuesta
    return this.prisma.forumPost.create({
      data: {
        threadId,
        authorId: user.userId,
        body: trimmedBody,
      },
      select: {
        id: true,
        body: true,
        author: { select: { id: true, name: true } },
        createdAt: true,
      },
    });
  }

  // HU25 CA6: Eliminar una consulta
  async deleteThread(threadId: string, user: AuthenticatedUser) {
    const thread = await this.prisma.forumThread.findUnique({
      where: { id: threadId },
      select: {
        id: true,
        authorId: true,
        course: { select: { professorId: true } },
      },
    });

    if (!thread) {
      throw new NotFoundException('Consulta no encontrada.');
    }

    // Validar permisos: autor o profesor propietario
    const canDelete = await this.forumAccess.canDeleteThread(
      user.userId,
      threadId,
      user.role,
      { authorId: thread.authorId, course: thread.course },
    );

    if (!canDelete) {
      throw new ForbiddenException('No tenés permiso para eliminar esta consulta.');
    }

    // Las respuestas se eliminan en cascada
    await this.prisma.forumThread.delete({
      where: { id: threadId },
    });

    return { message: 'Consulta eliminada correctamente.' };
  }

  // HU25 CA6: Eliminar una respuesta
  async deletePost(postId: string, user: AuthenticatedUser) {
    const post = await this.prisma.forumPost.findUnique({
      where: { id: postId },
      select: {
        id: true,
        authorId: true,
        thread: { select: { course: { select: { professorId: true } } } },
      },
    });

    if (!post) {
      throw new NotFoundException('Respuesta no encontrada.');
    }

    // Validar permisos: autor o profesor propietario
    const canDelete = await this.forumAccess.canDeletePost(
      user.userId,
      postId,
      user.role,
      { authorId: post.authorId, thread: post.thread },
    );

    if (!canDelete) {
      throw new ForbiddenException('No tenés permiso para eliminar esta respuesta.');
    }

    await this.prisma.forumPost.delete({
      where: { id: postId },
    });

    return { message: 'Respuesta eliminada correctamente.' };
  }
}
