import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ForumService } from './forum.service';
import { ForumAccessHelper } from './helpers/forum-access.helper';
import { createMockPrismaService } from '../test-utils/mock-prisma';
import { PrismaService } from '../prisma/prisma.service';

// HU25: Tests del servicio de foro
describe('ForumService', () => {
  let service: ForumService;
  let mockPrisma: any;
  let forumAccessHelper: ForumAccessHelper;

  const mockStudent = {
    userId: 'student-1',
    role: Role.STUDENT,
    institutionId: 'inst-1',
    email: 'student1@test.com',
  };

  const mockEnrolledStudent = {
    userId: 'student-2',
    role: Role.STUDENT,
    institutionId: 'inst-1',
    email: 'student2@test.com',
  };

  const mockProfessor = {
    userId: 'prof-1',
    role: Role.PROFESSOR,
    institutionId: 'inst-1',
    email: 'prof@test.com',
  };

  const mockOtherInstitutionStudent = {
    userId: 'student-3',
    role: Role.STUDENT,
    institutionId: 'inst-2',
    email: 'student3@test.com',
  };

  const mockCourse = {
    id: 'course-1',
    institutionId: 'inst-1',
    professorId: 'prof-1',
    isPublished: true,
  };

  const mockTopic = {
    id: 'topic-1',
    courseId: 'course-1',
    title: 'Introducción',
  };

  const mockThread = {
    id: 'thread-1',
    courseId: 'course-1',
    topicId: 'topic-1',
    authorId: 'student-2',
    title: 'Duda sobre el tema',
    body: 'No entiendo este concepto',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  const mockPost = {
    id: 'post-1',
    threadId: 'thread-1',
    authorId: 'prof-1',
    body: 'Aquí está la explicación',
    createdAt: new Date('2026-01-02'),
  };

  beforeEach(async () => {
    mockPrisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ForumService,
        ForumAccessHelper,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ForumService>(ForumService);
    forumAccessHelper = module.get<ForumAccessHelper>(ForumAccessHelper);
  });

  describe('HU25 CA1: Crear consulta', () => {
    it('Alumno inscripto puede crear consulta válida', async () => {
      mockPrisma.course.findUnique.mockResolvedValueOnce(mockCourse);
      mockPrisma.enrollment.findUnique.mockResolvedValueOnce({ id: 'enroll-1' });
      mockPrisma.topic.findUnique.mockResolvedValueOnce(mockTopic);
      mockPrisma.forumThread.create.mockResolvedValueOnce({
        id: 'thread-1',
        title: 'Mi duda',
        body: 'No entiendo',
        topicId: 'topic-1',
        topic: mockTopic,
        author: { id: mockEnrolledStudent.userId, name: 'Student' },
        createdAt: new Date(),
      });

      const result = await service.createThread('course-1', mockEnrolledStudent, {
        topicId: 'topic-1',
        title: 'Mi duda',
        body: 'No entiendo',
      });

      expect(result).toBeDefined();
      expect(result.title).toBe('Mi duda');
      expect(mockPrisma.forumThread.create).toHaveBeenCalled();
    });

    it('Falla si el título excede 120 caracteres', async () => {
      mockPrisma.course.findUnique.mockResolvedValueOnce(mockCourse);
      mockPrisma.enrollment.findUnique.mockResolvedValueOnce({ id: 'enroll-1' });
      mockPrisma.topic.findUnique.mockResolvedValueOnce(mockTopic);

      const longTitle = 'a'.repeat(121);

      await expect(
        service.createThread('course-1', mockEnrolledStudent, {
          topicId: 'topic-1',
          title: longTitle,
          body: 'contenido',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('Falla si el body excede 2000 caracteres', async () => {
      mockPrisma.course.findUnique.mockResolvedValueOnce(mockCourse);
      mockPrisma.enrollment.findUnique.mockResolvedValueOnce({ id: 'enroll-1' });
      mockPrisma.topic.findUnique.mockResolvedValueOnce(mockTopic);

      const longBody = 'a'.repeat(2001);

      await expect(
        service.createThread('course-1', mockEnrolledStudent, {
          topicId: 'topic-1',
          title: 'Título válido',
          body: longBody,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('Falla si el Profesor intenta crear consulta', async () => {
      mockPrisma.course.findUnique.mockResolvedValueOnce(mockCourse);

      await expect(
        service.createThread('course-1', mockProfessor, {
          topicId: 'topic-1',
          title: 'Título',
          body: 'contenido',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Falla si alumno no está inscripto en el curso', async () => {
      mockPrisma.course.findUnique.mockResolvedValueOnce(mockCourse);
      mockPrisma.enrollment.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.createThread('course-1', mockStudent, {
          topicId: 'topic-1',
          title: 'Título',
          body: 'contenido',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Falla si el tema no existe en el curso', async () => {
      mockPrisma.course.findUnique.mockResolvedValueOnce(mockCourse);
      mockPrisma.enrollment.findUnique.mockResolvedValueOnce({ id: 'enroll-1' });
      mockPrisma.topic.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.createThread('course-1', mockEnrolledStudent, {
          topicId: 'topic-1',
          title: 'Título',
          body: 'contenido',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('HU25 CA1: Listar consultas', () => {
    it('Alumno inscripto puede listar consultas', async () => {
      mockPrisma.course.findUnique.mockResolvedValueOnce(mockCourse);
      mockPrisma.enrollment.findUnique.mockResolvedValueOnce({ id: 'enroll-1' });
      mockPrisma.forumThread.count.mockResolvedValueOnce(21);
      mockPrisma.forumThread.findMany.mockResolvedValueOnce([
        {
          id: 'thread-1',
          title: 'Duda 1',
          topicId: 'topic-1',
          topic: mockTopic,
          author: { id: 'student-1', name: 'Alumno 1' },
          createdAt: new Date('2026-01-02'),
          _count: { posts: 3 },
        },
        {
          id: 'thread-2',
          title: 'Duda 2',
          topicId: 'topic-1',
          topic: mockTopic,
          author: { id: 'student-2', name: 'Alumno 2' },
          createdAt: new Date('2026-01-01'),
          _count: { posts: 0 },
        },
      ]);

      const result = await service.listThreads('course-1', mockEnrolledStudent, 1);

      expect(result.data).toHaveLength(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.total).toBe(21);
      expect(result.pagination.totalPages).toBe(2);
      expect(result.data[0].title).toBe('Duda 1');
      expect(result.data[0].replyCount).toBe(3);
    });

    it('Paginación de 20 consultas por página', async () => {
      mockPrisma.course.findUnique.mockResolvedValueOnce(mockCourse);
      mockPrisma.enrollment.findUnique.mockResolvedValueOnce({ id: 'enroll-1' });
      mockPrisma.forumThread.count.mockResolvedValueOnce(21);
      mockPrisma.forumThread.findMany.mockResolvedValueOnce([]);

      await service.listThreads('course-1', mockEnrolledStudent, 2);

      expect(mockPrisma.forumThread.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 20,
        }),
      );
    });

    it('Filtro por topicId', async () => {
      mockPrisma.course.findUnique.mockResolvedValueOnce(mockCourse);
      mockPrisma.enrollment.findUnique.mockResolvedValueOnce({ id: 'enroll-1' });
      mockPrisma.forumThread.count.mockResolvedValueOnce(5);
      mockPrisma.forumThread.findMany.mockResolvedValueOnce([]);

      await service.listThreads('course-1', mockEnrolledStudent, 1, 'topic-1');

      expect(mockPrisma.forumThread.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            courseId: 'course-1',
            topicId: 'topic-1',
          },
        }),
      );
    });

    it('Alumno no inscripto no puede listar', async () => {
      mockPrisma.course.findUnique.mockResolvedValueOnce(mockCourse);
      mockPrisma.enrollment.findUnique.mockResolvedValueOnce(null);

      await expect(service.listThreads('course-1', mockStudent, 1)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('HU25 CA3: Obtener detalle de consulta', () => {
    it('Alumno inscripto puede ver detalle', async () => {
      mockPrisma.forumThread.findUnique.mockResolvedValueOnce({
        id: mockThread.id,
        courseId: mockThread.courseId,
        topicId: mockThread.topicId,
        topic: mockTopic,
        title: mockThread.title,
        body: mockThread.body,
        author: { id: mockThread.authorId, name: 'Alumno' },
        createdAt: mockThread.createdAt,
        course: { institutionId: 'inst-1', professorId: 'prof-1' },
      });
      mockPrisma.enrollment.findUnique.mockResolvedValueOnce({ id: 'enroll-1' });
      mockPrisma.forumPost.findMany.mockResolvedValueOnce([
        {
          id: 'post-1',
          body: 'Aquí está la respuesta',
          author: { id: 'prof-1', name: 'Profesor' },
          createdAt: new Date(),
        },
      ]);

      const result = await service.getThread('thread-1', mockEnrolledStudent);

      expect(result.title).toBe('Duda sobre el tema');
      expect(result.posts).toHaveLength(1);
      expect(result.posts[0].body).toBe('Aquí está la respuesta');
    });

    it('Respuestas se muestran en orden cronológico', async () => {
      mockPrisma.forumThread.findUnique.mockResolvedValueOnce({
        id: mockThread.id,
        courseId: mockThread.courseId,
        topicId: mockThread.topicId,
        topic: mockTopic,
        title: mockThread.title,
        body: mockThread.body,
        author: { id: mockThread.authorId, name: 'Alumno' },
        createdAt: mockThread.createdAt,
        course: { institutionId: 'inst-1', professorId: 'prof-1' },
      });
      mockPrisma.enrollment.findUnique.mockResolvedValueOnce({ id: 'enroll-1' });
      mockPrisma.forumPost.findMany.mockResolvedValueOnce([
        {
          id: 'post-1',
          body: 'Primera respuesta',
          author: { id: 'prof-1', name: 'Profesor' },
          createdAt: new Date('2026-01-02'),
        },
        {
          id: 'post-2',
          body: 'Segunda respuesta',
          author: { id: 'student-2', name: 'Alumno 2' },
          createdAt: new Date('2026-01-03'),
        },
      ]);

      const result = await service.getThread('thread-1', mockEnrolledStudent);

      expect(result.posts[0].body).toBe('Primera respuesta');
      expect(result.posts[1].body).toBe('Segunda respuesta');
    });

    it('Alumno no inscripto no puede ver detalle', async () => {
      mockPrisma.forumThread.findUnique.mockResolvedValueOnce({
        ...mockThread,
        course: { institutionId: 'inst-1', professorId: 'prof-1' },
      });
      mockPrisma.enrollment.findUnique.mockResolvedValueOnce(null);

      await expect(service.getThread('thread-1', mockStudent)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('HU25 CA2: Crear respuesta', () => {
    it('Alumno inscripto puede responder consulta', async () => {
      mockPrisma.forumThread.findUnique.mockResolvedValueOnce({
        id: 'thread-1',
        courseId: 'course-1',
        course: { institutionId: 'inst-1', professorId: 'prof-1' },
      });
      mockPrisma.enrollment.findUnique.mockResolvedValueOnce({ id: 'enroll-1' });
      mockPrisma.forumPost.create.mockResolvedValueOnce({
        id: 'post-1',
        body: 'Mi respuesta',
        author: { id: mockEnrolledStudent.userId, name: 'Alumno' },
        createdAt: new Date(),
      });

      const result = await service.createPost('thread-1', mockEnrolledStudent, {
        body: 'Mi respuesta',
      });

      expect(result).toBeDefined();
      expect(result.body).toBe('Mi respuesta');
    });

    it('Profesor propietario puede responder', async () => {
      mockPrisma.forumThread.findUnique.mockResolvedValueOnce({
        id: 'thread-1',
        courseId: 'course-1',
        course: { institutionId: 'inst-1', professorId: 'prof-1' },
      });
      mockPrisma.forumPost.create.mockResolvedValueOnce({
        id: 'post-1',
        body: 'Respuesta del profesor',
        author: { id: 'prof-1', name: 'Profesor' },
        createdAt: new Date(),
      });

      const result = await service.createPost('thread-1', mockProfessor, {
        body: 'Respuesta del profesor',
      });

      expect(result).toBeDefined();
      expect(result.body).toBe('Respuesta del profesor');
    });

    it('Falla si el body excede 2000 caracteres', async () => {
      mockPrisma.forumThread.findUnique.mockResolvedValueOnce({
        id: 'thread-1',
        courseId: 'course-1',
        course: { institutionId: 'inst-1', professorId: 'prof-1' },
      });
      mockPrisma.enrollment.findUnique.mockResolvedValueOnce({ id: 'enroll-1' });

      const longBody = 'a'.repeat(2001);

      await expect(
        service.createPost('thread-1', mockEnrolledStudent, { body: longBody }),
      ).rejects.toThrow(BadRequestException);
    });

    it('Alumno no inscripto no puede responder', async () => {
      mockPrisma.forumThread.findUnique.mockResolvedValueOnce({
        id: 'thread-1',
        courseId: 'course-1',
        course: { institutionId: 'inst-1', professorId: 'prof-1' },
      });
      mockPrisma.enrollment.findUnique.mockResolvedValueOnce(null);

      await expect(service.createPost('thread-1', mockStudent, { body: 'Respuesta' })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('Profesor ajeno no puede responder', async () => {
      const otherProfessor = {
        userId: 'prof-2',
        role: Role.PROFESSOR,
        institutionId: 'inst-1',
        email: 'prof2@test.com',
      };

      mockPrisma.forumThread.findUnique.mockResolvedValueOnce({
        id: 'thread-1',
        courseId: 'course-1',
        course: { institutionId: 'inst-1', professorId: 'prof-1' },
      });

      await expect(
        service.createPost('thread-1', otherProfessor, { body: 'Respuesta' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('HU25 CA6: Eliminar consulta', () => {
    it('Autor puede eliminar su propia consulta', async () => {
      mockPrisma.forumThread.findUnique.mockResolvedValueOnce({
        id: 'thread-1',
        authorId: 'student-2',
        course: { professorId: 'prof-1' },
      });
      mockPrisma.forumThread.delete.mockResolvedValueOnce({ id: 'thread-1' });

      const result = await service.deleteThread('thread-1', mockEnrolledStudent);

      expect(result).toBeDefined();
      expect(mockPrisma.forumThread.delete).toHaveBeenCalledWith({
        where: { id: 'thread-1' },
      });
    });

    it('Profesor propietario puede eliminar cualquier consulta', async () => {
      mockPrisma.forumThread.findUnique.mockResolvedValueOnce({
        id: 'thread-1',
        authorId: 'student-2',
        course: { professorId: 'prof-1' },
      });
      mockPrisma.forumThread.delete.mockResolvedValueOnce({ id: 'thread-1' });

      const result = await service.deleteThread('thread-1', mockProfessor);

      expect(result).toBeDefined();
      expect(mockPrisma.forumThread.delete).toHaveBeenCalled();
    });

    it('Otro usuario no puede eliminar consulta', async () => {
      mockPrisma.forumThread.findUnique.mockResolvedValueOnce({
        id: 'thread-1',
        authorId: 'student-2',
        course: { professorId: 'prof-1' },
      });

      await expect(
        service.deleteThread('thread-1', mockStudent),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('HU25 CA6: Eliminar respuesta', () => {
    it('Autor puede eliminar su propia respuesta', async () => {
      mockPrisma.forumPost.findUnique.mockResolvedValueOnce({
        id: 'post-1',
        authorId: 'prof-1',
      });
      mockPrisma.forumPost.delete.mockResolvedValueOnce({ id: 'post-1' });

      const result = await service.deletePost('post-1', mockProfessor);

      expect(result).toBeDefined();
      expect(mockPrisma.forumPost.delete).toHaveBeenCalled();
    });

    it('Profesor propietario puede eliminar cualquier respuesta', async () => {
      mockPrisma.forumPost.findUnique.mockResolvedValueOnce({
        id: 'post-1',
        authorId: 'student-2',
        thread: {
          course: { professorId: 'prof-1' },
        },
      });
      mockPrisma.forumPost.delete.mockResolvedValueOnce({ id: 'post-1' });

      const result = await service.deletePost('post-1', mockProfessor);

      expect(result).toBeDefined();
    });

    it('Alumno no puede eliminar respuesta de otro', async () => {
      mockPrisma.forumPost.findUnique.mockResolvedValueOnce({
        id: 'post-1',
        authorId: 'prof-1',
      });

      await expect(
        service.deletePost('post-1', mockEnrolledStudent),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('HU25 CA8: Tema eliminado', () => {
    it('Consulta con tema eliminado se muestra como "Tema eliminado"', async () => {
      mockPrisma.forumThread.findUnique.mockResolvedValueOnce({
        id: 'thread-1',
        courseId: 'course-1',
        topicId: null, // Tema fue eliminado
        topic: null,
        title: 'Mi duda',
        body: 'No entiendo',
        author: { id: 'student-2', name: 'Alumno' },
        createdAt: new Date(),
        course: { institutionId: 'inst-1', professorId: 'prof-1' },
      });
      mockPrisma.enrollment.findUnique.mockResolvedValueOnce({ id: 'enroll-1' });
      mockPrisma.forumPost.findMany.mockResolvedValueOnce([]);

      const result = await service.getThread('thread-1', mockEnrolledStudent);

      expect(result.topic).toBe('Tema eliminado');
    });
  });

  describe('HU25 CA5: Curso despublicado', () => {
    it('Alumno inscripto mantiene acceso al foro en curso despublicado', async () => {
      const unpublishedCourse = {
        ...mockCourse,
        isPublished: false,
      };

      mockPrisma.course.findUnique.mockResolvedValueOnce(unpublishedCourse);
      mockPrisma.enrollment.findUnique.mockResolvedValueOnce({ id: 'enroll-1' });
      mockPrisma.forumThread.count.mockResolvedValueOnce(1);
      mockPrisma.forumThread.findMany.mockResolvedValueOnce([
        {
          id: 'thread-1',
          title: 'Duda',
          topicId: 'topic-1',
          topic: mockTopic,
          author: { id: 'student-2', name: 'Alumno' },
          createdAt: new Date(),
          _count: { posts: 0 },
        },
      ]);

      const result = await service.listThreads('course-1', mockEnrolledStudent, 1);

      expect(result.data).toHaveLength(1);
    });
  });

  describe('HU25: Seguridad multi-institución', () => {
    it('Usuario de otra institución no puede acceder al foro', async () => {
      mockPrisma.course.findUnique.mockResolvedValueOnce(mockCourse);

      await expect(
        service.listThreads('course-1', mockOtherInstitutionStudent, 1),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Usuario de otra institución no puede ver detalle de consulta', async () => {
      mockPrisma.forumThread.findUnique.mockResolvedValueOnce({
        ...mockThread,
        course: { institutionId: 'inst-1', professorId: 'prof-1' },
      });
      mockPrisma.course.findUnique.mockResolvedValueOnce(mockCourse);

      await expect(
        service.getThread('thread-1', mockOtherInstitutionStudent),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
