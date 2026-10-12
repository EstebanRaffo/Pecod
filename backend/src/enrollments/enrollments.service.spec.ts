import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { EnrollmentsService } from './enrollments.service';
import { createMockPrismaService, MockPrismaService } from '../test-utils/mock-prisma';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';

describe('EnrollmentsService (HU2, HU3)', () => {
  let service: EnrollmentsService;
  let prisma: MockPrismaService;

  const student: AuthenticatedUser = {
    userId: 'student-1',
    email: 's@uade.edu.ar',
    role: Role.STUDENT,
    institutionId: 'inst-1',
  };

  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new EnrollmentsService(prisma as any);
  });

  it('CA: el Alumno puede inscribirse a un curso publicado de su institución', async () => {
    prisma.course.findUnique.mockResolvedValue({
      id: 'course-1',
      isPublished: true,
      institutionId: 'inst-1',
    });
    prisma.enrollment.create.mockResolvedValue({ id: 'enr-1' });

    const result = await service.enroll('course-1', student);
    expect(result.id).toBe('enr-1');
  });

  it('CA: no es posible inscribirse a un curso despublicado', async () => {
    prisma.course.findUnique.mockResolvedValue({
      id: 'course-1',
      isPublished: false,
      institutionId: 'inst-1',
    });

    await expect(service.enroll('course-1', student)).rejects.toThrow(BadRequestException);
    expect(prisma.enrollment.create).not.toHaveBeenCalled();
  });

  it('CA: el Alumno solo puede inscribirse a cursos de su propia institución', async () => {
    prisma.course.findUnique.mockResolvedValue({
      id: 'course-1',
      isPublished: true,
      institutionId: 'otra-institucion',
    });

    await expect(service.enroll('course-1', student)).rejects.toThrow(BadRequestException);
  });

  it('CA: no se permite la doble inscripción a un mismo curso', async () => {
    prisma.course.findUnique.mockResolvedValue({
      id: 'course-1',
      isPublished: true,
      institutionId: 'inst-1',
    });
    prisma.enrollment.create.mockRejectedValue({ code: 'P2002' });

    await expect(service.enroll('course-1', student)).rejects.toThrow(ConflictException);
  });

  it('CA: inscribirse a un curso inexistente lanza NotFoundException', async () => {
    prisma.course.findUnique.mockResolvedValue(null);

    await expect(service.enroll('no-existe', student)).rejects.toThrow(NotFoundException);
  });

  it('CA (HU3): "Mis cursos" devuelve solo las inscripciones del Alumno autenticado', async () => {
    prisma.enrollment.findMany.mockResolvedValue([{
      id: 'enr-1', course: { id: 'course-1', _count: { topics: 3 } }, topicProgress: [{ topicId: 'topic-1' }],
    }]);

    const result = await service.myCourses(student);

    expect(prisma.enrollment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { studentId: 'student-1' } }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].progress).toEqual({ viewed: 1, total: 3, percentage: 33, viewedTopicIds: ['topic-1'] });
  });

  describe('HU18 CA9: "Mis cursos" identifica cursos finalizados con certificado disponible', () => {
    it('identifica como disponible cuando ya tiene un certificado emitido', async () => {
      prisma.enrollment.findMany.mockResolvedValue([
        {
          id: 'enr-1',
          certificate: { id: 'cert-1', code: 'CERT-001', issuedAt: new Date() },
          course: { id: 'course-1', _count: { topics: 2 }, evaluations: [] },
          topicProgress: [{ topicId: 'topic-1' }],
        },
      ]);

      const result = await service.myCourses(student);
      expect(result[0].certificateAvailable).toBe(true);
      expect(result[0].certificate?.code).toBe('CERT-001');
    });

    it('identifica como disponible cuando cumple 100% de avance y evaluaciones aprobadas', async () => {
      prisma.enrollment.findMany.mockResolvedValue([
        {
          id: 'enr-1',
          certificate: null,
          course: { id: 'course-1', _count: { topics: 2 }, evaluations: [{ id: 'eval-1' }] },
          topicProgress: [{ topicId: 'topic-1' }, { topicId: 'topic-2' }],
        },
      ]);
      prisma.evaluationAttempt.findMany.mockResolvedValue([
        { evaluationId: 'eval-1' },
      ]);

      const result = await service.myCourses(student);
      expect(result[0].certificateAvailable).toBe(true);
    });

    it('identifica como no disponible si aún faltan temas o evaluaciones', async () => {
      prisma.enrollment.findMany.mockResolvedValue([
        {
          id: 'enr-1',
          certificate: null,
          course: { id: 'course-1', _count: { topics: 2 }, evaluations: [{ id: 'eval-1' }] },
          topicProgress: [{ topicId: 'topic-1' }],
        },
      ]);
      prisma.evaluationAttempt.findMany.mockResolvedValue([]);

      const result = await service.myCourses(student);
      expect(result[0].certificateAvailable).toBe(false);
    });
  });

  describe('HU16: progreso individual', () => {
    const enrollment = (total = 3, viewedTopicIds = ['topic-1']) => ({
      id: 'enr-1', course: { _count: { topics: total } },
      topicProgress: viewedTopicIds.map((topicId) => ({ topicId })),
    });

    it.each([
      [0, [], 0], [3, [], 0], [3, ['topic-1'], 33],
      [3, ['topic-1', 'topic-2'], 67], [2, ['topic-1', 'topic-2'], 100],
    ])('calcula el porcentaje con %i temas y %j vistos', async (total, ids, percentage) => {
      prisma.enrollment.findUnique.mockResolvedValue(enrollment(total as number, ids as string[]));
      expect(await service.getProgress('course-1', student)).toEqual({
        viewed: (ids as string[]).length, total, percentage, viewedTopicIds: ids,
      });
      expect(prisma.enrollment.findUnique).toHaveBeenCalledWith(expect.objectContaining({
        where: { studentId_courseId: { studentId: student.userId, courseId: 'course-1' } },
      }));
      expect(prisma.evaluation.findMany).not.toHaveBeenCalled();
    });

    it('marca de forma idempotente para la propia inscripcion', async () => {
      prisma.enrollment.findUnique.mockResolvedValue(enrollment());
      prisma.topic.findUnique.mockResolvedValue({ id: 'topic-1', courseId: 'course-1' });
      await service.setTopicViewed('course-1', 'topic-1', student, true);
      expect(prisma.topicProgress.upsert).toHaveBeenCalledWith({
        where: { enrollmentId_topicId: { enrollmentId: 'enr-1', topicId: 'topic-1' } },
        create: { enrollmentId: 'enr-1', topicId: 'topic-1' }, update: {},
      });
    });

    it('desmarca solo el tema de la propia inscripcion', async () => {
      prisma.enrollment.findUnique.mockResolvedValue(enrollment(3, []));
      prisma.topic.findUnique.mockResolvedValue({ id: 'topic-1', courseId: 'course-1' });
      expect((await service.setTopicViewed('course-1', 'topic-1', student, false)).percentage).toBe(0);
      expect(prisma.topicProgress.deleteMany).toHaveBeenCalledWith({
        where: { enrollmentId: 'enr-1', topicId: 'topic-1' },
      });
    });

    it('rechaza consultar, marcar y desmarcar sin inscripcion', async () => {
      prisma.enrollment.findUnique.mockResolvedValue(null);
      await expect(service.getProgress('course-1', student)).rejects.toThrow(ForbiddenException);
      for (const viewed of [true, false]) {
        await expect(service.setTopicViewed('course-1', 'topic-1', student, viewed)).rejects.toThrow(ForbiddenException);
      }
      expect(prisma.topicProgress.upsert).not.toHaveBeenCalled();
      expect(prisma.topicProgress.deleteMany).not.toHaveBeenCalled();
    });

    it.each([Role.PROFESSOR, Role.ADMIN])('rechaza el rol %s', async (role) => {
      const user = { ...student, role };
      await expect(service.getProgress('course-1', user)).rejects.toThrow(ForbiddenException);
      await expect(service.myCourses(user)).rejects.toThrow(ForbiddenException);
      await expect(service.setTopicViewed('course-1', 'topic-1', user, true)).rejects.toThrow(ForbiddenException);
      expect(prisma.enrollment.findUnique).not.toHaveBeenCalled();
    });

    it.each([null, { id: 'topic-1', courseId: 'otro-curso' }])('rechaza temas inexistentes o de otro curso', async (topic) => {
      prisma.enrollment.findUnique.mockResolvedValue(enrollment());
      prisma.topic.findUnique.mockResolvedValue(topic);
      await expect(service.setTopicViewed('course-1', 'topic-1', student, true)).rejects.toThrow(NotFoundException);
      expect(prisma.topicProgress.upsert).not.toHaveBeenCalled();
    });

    it('recalcula al agregar o eliminar temas', async () => {
      prisma.enrollment.findUnique
        .mockResolvedValueOnce(enrollment(2, ['topic-1']))
        .mockResolvedValueOnce(enrollment(3, ['topic-1']))
        .mockResolvedValueOnce(enrollment(2, []));
      expect((await service.getProgress('course-1', student)).percentage).toBe(50);
      expect((await service.getProgress('course-1', student)).percentage).toBe(33);
      expect((await service.getProgress('course-1', student)).percentage).toBe(0);
    });
  });
});
