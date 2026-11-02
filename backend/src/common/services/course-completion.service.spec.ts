import { Test, TestingModule } from '@nestjs/testing';
import { CourseCompletionService } from './course-completion.service';
import { createMockPrismaService } from '../../test-utils/mock-prisma';
import { PrismaService } from '../../prisma/prisma.service';

describe('CourseCompletionService', () => {
  let service: CourseCompletionService;
  let mockPrisma: any;

  const studentId = 'student-1';
  const courseId = 'course-1';

  beforeEach(async () => {
    mockPrisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [CourseCompletionService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<CourseCompletionService>(CourseCompletionService);
  });

  describe('getProgressPercentage', () => {
    it('Retorna 0% si el alumno no está inscripto', async () => {
      mockPrisma.enrollment.findUnique.mockResolvedValueOnce(null);

      const progress = await service.getProgressPercentage(courseId, studentId);

      expect(progress).toBe(0);
    });

    it('Retorna 0% si el curso no tiene temas', async () => {
      mockPrisma.enrollment.findUnique.mockResolvedValueOnce({
        course: { _count: { topics: 0 } },
        topicProgress: [],
      });

      const progress = await service.getProgressPercentage(courseId, studentId);

      expect(progress).toBe(0);
    });

    it('Calcula progreso correctamente: 1 de 2 temas = 50%', async () => {
      mockPrisma.enrollment.findUnique.mockResolvedValueOnce({
        course: { _count: { topics: 2 } },
        topicProgress: [{ topicId: 'topic-1' }],
      });

      const progress = await service.getProgressPercentage(courseId, studentId);

      expect(progress).toBe(50);
    });

    it('Calcula progreso correctamente: 2 de 3 temas = 67%', async () => {
      mockPrisma.enrollment.findUnique.mockResolvedValueOnce({
        course: { _count: { topics: 3 } },
        topicProgress: [{ topicId: 'topic-1' }, { topicId: 'topic-2' }],
      });

      const progress = await service.getProgressPercentage(courseId, studentId);

      expect(progress).toBe(67);
    });

    it('Retorna 100% si todos los temas están vistos', async () => {
      mockPrisma.enrollment.findUnique.mockResolvedValueOnce({
        course: { _count: { topics: 3 } },
        topicProgress: [{ topicId: 'topic-1' }, { topicId: 'topic-2' }, { topicId: 'topic-3' }],
      });

      const progress = await service.getProgressPercentage(courseId, studentId);

      expect(progress).toBe(100);
    });
  });

  describe('isCourseFinalizado', () => {
    it('Retorna false si el alumno no está inscripto', async () => {
      mockPrisma.enrollment.findUnique.mockResolvedValueOnce(null);

      const isFinalized = await service.isCourseFinalizado(courseId, studentId);

      expect(isFinalized).toBe(false);
    });

    it('Retorna false si el curso no tiene temas (HU18 CA2)', async () => {
      mockPrisma.enrollment.findUnique.mockResolvedValueOnce({
        course: { _count: { topics: 0 }, evaluations: [] },
        topicProgress: [],
      });

      const isFinalized = await service.isCourseFinalizado(courseId, studentId);

      expect(isFinalized).toBe(false);
    });

    it('Retorna false si no todos los temas están vistos', async () => {
      mockPrisma.enrollment.findUnique.mockResolvedValueOnce({
        course: { _count: { topics: 3 }, evaluations: [] },
        topicProgress: [{ topicId: 'topic-1' }, { topicId: 'topic-2' }],
      });

      const isFinalized = await service.isCourseFinalizado(courseId, studentId);

      expect(isFinalized).toBe(false);
    });

    it('Retorna true si todos los temas vistos y sin evaluaciones', async () => {
      mockPrisma.enrollment.findUnique.mockResolvedValueOnce({
        course: { _count: { topics: 2 }, evaluations: [] },
        topicProgress: [{ topicId: 'topic-1' }, { topicId: 'topic-2' }],
      });

      const isFinalized = await service.isCourseFinalizado(courseId, studentId);

      expect(isFinalized).toBe(true);
    });

    it('Retorna false si tiene evaluaciones sin aprobar', async () => {
      mockPrisma.enrollment.findUnique.mockResolvedValueOnce({
        course: {
          _count: { topics: 2 },
          evaluations: [{ id: 'eval-1' }, { id: 'eval-2' }],
        },
        topicProgress: [{ topicId: 'topic-1' }, { topicId: 'topic-2' }],
      });

      mockPrisma.evaluationAttempt.findMany.mockResolvedValueOnce([
        { evaluationId: 'eval-1', passed: true },
        { evaluationId: 'eval-2', passed: false },
      ]);

      const isFinalized = await service.isCourseFinalizado(courseId, studentId);

      expect(isFinalized).toBe(false);
    });

    it('Retorna true si todos los temas vistos y todas evaluaciones aprobadas', async () => {
      mockPrisma.enrollment.findUnique.mockResolvedValueOnce({
        course: {
          _count: { topics: 2 },
          evaluations: [{ id: 'eval-1' }, { id: 'eval-2' }],
        },
        topicProgress: [{ topicId: 'topic-1' }, { topicId: 'topic-2' }],
      });

      mockPrisma.evaluationAttempt.findMany.mockResolvedValueOnce([
        { evaluationId: 'eval-1', passed: true },
        { evaluationId: 'eval-2', passed: true },
      ]);

      const isFinalized = await service.isCourseFinalizado(courseId, studentId);

      expect(isFinalized).toBe(true);
    });
  });

  describe('canReviewCourse', () => {
    it('Retorna no elegible si no está inscripto', async () => {
      mockPrisma.enrollment.findUnique.mockResolvedValueOnce(null);

      const result = await service.canReviewCourse(courseId, studentId);

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('No estás inscripto en este curso.');
    });

    it('Retorna elegible si el curso está finalizado', async () => {
      mockPrisma.enrollment.findUnique.mockResolvedValueOnce({
        course: { _count: { topics: 2 }, evaluations: [] },
        topicProgress: [{ topicId: 'topic-1' }, { topicId: 'topic-2' }],
      });

      mockPrisma.evaluationAttempt.findMany.mockResolvedValueOnce([]);

      const result = await service.canReviewCourse(courseId, studentId);

      expect(result.eligible).toBe(true);
    });

    it('Retorna elegible si tiene 50% de avance (HU20 CA1)', async () => {
      mockPrisma.enrollment.findUnique.mockResolvedValueOnce({
        course: { _count: { topics: 2 }, evaluations: [] },
        topicProgress: [{ topicId: 'topic-1' }],
      });

      mockPrisma.evaluationAttempt.findMany.mockResolvedValueOnce([]);

      const result = await service.canReviewCourse(courseId, studentId);

      expect(result.eligible).toBe(true);
    });

    it('Retorna elegible si tiene > 50% de avance', async () => {
      mockPrisma.enrollment.findUnique.mockResolvedValueOnce({
        course: { _count: { topics: 3 }, evaluations: [] },
        topicProgress: [{ topicId: 'topic-1' }, { topicId: 'topic-2' }],
      });

      mockPrisma.evaluationAttempt.findMany.mockResolvedValueOnce([]);

      const result = await service.canReviewCourse(courseId, studentId);

      // 2/3 = 66.67% > 50%
      expect(result.eligible).toBe(true);
    });

    it('Retorna no elegible si tiene < 50% de avance (HU20 CA1)', async () => {
      mockPrisma.enrollment.findUnique.mockResolvedValueOnce({
        course: { _count: { topics: 3 }, evaluations: [] },
        topicProgress: [{ topicId: 'topic-1' }],
      });

      mockPrisma.evaluationAttempt.findMany.mockResolvedValueOnce([]);

      const result = await service.canReviewCourse(courseId, studentId);

      // 1/3 = 33.33% < 50%
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('33%');
    });

    it('Retorna elegible si tiene 49% pero < 50% exacto', async () => {
      mockPrisma.enrollment.findUnique.mockResolvedValueOnce({
        course: { _count: { topics: 100 }, evaluations: [] },
        topicProgress: Array.from({ length: 49 }, (_, i) => ({ topicId: `topic-${i}` })),
      });

      mockPrisma.evaluationAttempt.findMany.mockResolvedValueOnce([]);

      const result = await service.canReviewCourse(courseId, studentId);

      // 49/100 = 49%
      expect(result.eligible).toBe(false);
    });
  });
});
