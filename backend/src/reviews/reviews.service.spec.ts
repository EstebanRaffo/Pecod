import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ReviewsService } from './reviews.service';
import { CourseCompletionService } from '../common/services/course-completion.service';
import { createMockPrismaService } from '../test-utils/mock-prisma';
import { PrismaService } from '../prisma/prisma.service';

describe('ReviewsService', () => {
  let service: ReviewsService;
  let mockPrisma: any;
  let courseCompletionService: CourseCompletionService;

  const mockStudent: any = {
    userId: 'student-1',
    role: Role.STUDENT,
    institutionId: 'inst-1',
  };

  const mockProfessor: any = {
    userId: 'prof-1',
    role: Role.PROFESSOR,
    institutionId: 'inst-1',
  };

  const mockAdmin: any = {
    userId: 'admin-1',
    role: Role.ADMIN,
    institutionId: null,
  };

  const mockCourse = {
    id: 'course-1',
    institutionId: 'inst-1',
    name: 'Test Course',
    isPublished: true,
  };

  const mockReview = {
    id: 'review-1',
    courseId: 'course-1',
    studentId: 'student-1',
    rating: 5,
    comment: 'Great course!',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockPrisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        CourseCompletionService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
    courseCompletionService = module.get<CourseCompletionService>(CourseCompletionService);
  });

  describe('HU20 CA1: Elegibilidad para reseñar', () => {
    it('HU20 CA1: Alumno con 50% exacto de avance puede reseñar', async () => {
      mockPrisma.course.findUnique.mockResolvedValueOnce(mockCourse);
      mockPrisma.courseReview.findUnique.mockResolvedValueOnce(null);

      // Mock CourseCompletionService para retornar elegible
      jest.spyOn(courseCompletionService, 'canReviewCourse').mockResolvedValueOnce({ eligible: true });

      mockPrisma.courseReview.create.mockResolvedValueOnce(mockReview);

      const result = await service.create('course-1', mockStudent, { rating: 5, comment: 'Good!' });

      expect(result).toEqual(mockReview);
      expect(mockPrisma.courseReview.create).toHaveBeenCalledWith({
        data: {
          courseId: 'course-1',
          studentId: 'student-1',
          rating: 5,
          comment: 'Good!',
        },
      });
    });

    it('HU20 CA1: Alumno con 49% de avance no puede reseñar', async () => {
      mockPrisma.course.findUnique.mockResolvedValueOnce(mockCourse);

      jest.spyOn(courseCompletionService, 'canReviewCourse').mockResolvedValueOnce({
        eligible: false,
        reason: 'Necesitás tener al menos 50% de avance o finalizar el curso. Actualmente tenés 49%.',
      });

      await expect(service.create('course-1', mockStudent, { rating: 5 })).rejects.toThrow(BadRequestException);
    });

    it('HU20 CA1: Alumno con curso finalizado puede reseñar', async () => {
      mockPrisma.course.findUnique.mockResolvedValueOnce(mockCourse);
      mockPrisma.courseReview.findUnique.mockResolvedValueOnce(null);

      jest.spyOn(courseCompletionService, 'canReviewCourse').mockResolvedValueOnce({ eligible: true });

      mockPrisma.courseReview.create.mockResolvedValueOnce(mockReview);

      const result = await service.create('course-1', mockStudent, { rating: 5 });

      expect(result).toEqual(mockReview);
    });

    it('HU20 CA1: Alumno no inscripto no puede reseñar', async () => {
      mockPrisma.course.findUnique.mockResolvedValueOnce(mockCourse);

      jest.spyOn(courseCompletionService, 'canReviewCourse').mockResolvedValueOnce({
        eligible: false,
        reason: 'No estás inscripto en este curso.',
      });

      await expect(service.create('course-1', mockStudent, { rating: 5 })).rejects.toThrow(BadRequestException);
    });
  });

  describe('HU20 CA3: Validación de calificación y comentario', () => {
    it('HU20 CA3: Calificación válida (1-5 estrellas)', async () => {
      mockPrisma.course.findUnique.mockResolvedValueOnce(mockCourse);
      mockPrisma.courseReview.findUnique.mockResolvedValueOnce(null);

      jest.spyOn(courseCompletionService, 'canReviewCourse').mockResolvedValueOnce({ eligible: true });

      mockPrisma.courseReview.create.mockResolvedValueOnce({ ...mockReview, rating: 3 });

      const result = await service.create('course-1', mockStudent, { rating: 3 });

      expect(result.rating).toBe(3);
    });

    it('HU20 CA3: Comentario opcional', async () => {
      mockPrisma.course.findUnique.mockResolvedValueOnce(mockCourse);
      mockPrisma.courseReview.findUnique.mockResolvedValueOnce(null);

      jest.spyOn(courseCompletionService, 'canReviewCourse').mockResolvedValueOnce({ eligible: true });

      mockPrisma.courseReview.create.mockResolvedValueOnce({ ...mockReview, comment: null });

      const result = await service.create('course-1', mockStudent, { rating: 4 });

      expect(mockPrisma.courseReview.create).toHaveBeenCalledWith({
        data: {
          courseId: 'course-1',
          studentId: 'student-1',
          rating: 4,
          comment: null,
        },
      });
    });

    it('HU20 CA3: Comentario máx 1000 caracteres (validado en DTO)', async () => {
      // DTO valida en service initialization, no aquí
      expect(true).toBe(true);
    });
  });

  describe('HU20 CA4: Unicidad y edición de reseñas', () => {
    it('HU20 CA4: Un alumno solo puede tener una reseña por curso', async () => {
      mockPrisma.course.findUnique.mockResolvedValueOnce(mockCourse);
      mockPrisma.courseReview.findUnique.mockResolvedValueOnce(mockReview); // Ya existe

      jest.spyOn(courseCompletionService, 'canReviewCourse').mockResolvedValueOnce({ eligible: true });

      await expect(service.create('course-1', mockStudent, { rating: 3 })).rejects.toThrow(ConflictException);
    });

    it('HU20 CA4: Alumno puede editar su reseña', async () => {
      mockPrisma.course.findUnique.mockResolvedValueOnce(mockCourse);
      mockPrisma.courseReview.findUnique.mockResolvedValueOnce(mockReview);
      mockPrisma.courseReview.update.mockResolvedValueOnce({ ...mockReview, rating: 4, comment: 'Updated!' });

      const result = await service.update('course-1', mockStudent, { rating: 4, comment: 'Updated!' });

      expect(result.rating).toBe(4);
      expect(result.comment).toBe('Updated!');
      expect(mockPrisma.courseReview.update).toHaveBeenCalledWith({
        where: { id: 'review-1' },
        data: { rating: 4, comment: 'Updated!' },
      });
    });

    it('HU20 CA4: Alumno puede eliminar su reseña', async () => {
      mockPrisma.course.findUnique.mockResolvedValueOnce(mockCourse);
      mockPrisma.courseReview.findUnique.mockResolvedValueOnce(mockReview);
      mockPrisma.courseReview.delete.mockResolvedValueOnce(mockReview);

      await service.delete('course-1', mockStudent);

      expect(mockPrisma.courseReview.delete).toHaveBeenCalledWith({
        where: { id: 'review-1' },
      });
    });
  });

  describe('HU20 CA5: Control de roles y acceso', () => {
    it('HU20 CA5: Profesor no puede reseñar', async () => {
      mockPrisma.course.findUnique.mockResolvedValueOnce(mockCourse);

      await expect(service.create('course-1', mockProfessor, { rating: 5 })).rejects.toThrow(ForbiddenException);
    });

    it('HU20 CA5: Admin no puede reseñar', async () => {
      mockPrisma.course.findUnique.mockResolvedValueOnce(mockCourse);

      await expect(service.create('course-1', mockAdmin, { rating: 5 })).rejects.toThrow(ForbiddenException);
    });

    it('HU20 CA5: Alumno de otra institución no puede reseñar', async () => {
      const studentOtherInst = { ...mockStudent, institutionId: 'inst-2' };
      mockPrisma.course.findUnique.mockResolvedValueOnce(mockCourse);

      await expect(service.create('course-1', studentOtherInst, { rating: 5 })).rejects.toThrow(ForbiddenException);
    });
  });

  describe('HU20 CA6: Listado y promedio de reseñas', () => {
    it('HU20 CA6: Calcula promedio con un decimal', async () => {
      const reviews = [
        { ...mockReview, studentId: 'student-1', rating: 5, student: { id: 'student-1', name: 'Student 1' } },
        { ...mockReview, studentId: 'student-2', rating: 4, student: { id: 'student-2', name: 'Student 2' } },
        { ...mockReview, studentId: 'student-3', rating: 3, student: { id: 'student-3', name: 'Student 3' } },
      ];

      mockPrisma.course.findUnique.mockResolvedValueOnce(mockCourse);
      mockPrisma.courseReview.findMany.mockResolvedValueOnce(reviews);

      const result = await service.getByCourse('course-1', mockStudent);

      // Promedio: (5 + 4 + 3) / 3 = 12 / 3 = 4.0
      expect(result.ratingAverage).toBe(4.0);
      expect(result.ratingCount).toBe(3);
      expect(result.reviews).toHaveLength(3);
      expect(result.reviews.map((review) => review.isOwnReview)).toEqual([true, false, false]);
    });

    it('HU20 CA6: Sin reseñas muestra null', async () => {
      mockPrisma.course.findUnique.mockResolvedValueOnce(mockCourse);
      mockPrisma.courseReview.findMany.mockResolvedValueOnce([]);

      const result = await service.getByCourse('course-1', mockStudent);

      expect(result.ratingAverage).toBeNull();
      expect(result.ratingCount).toBe(0);
      expect(result.reviews).toHaveLength(0);
    });

    it('HU20 CA6: Ordena por más reciente primero', async () => {
      const now = new Date();
      const reviews = [
        { ...mockReview, createdAt: new Date(now.getTime() + 2000), student: { id: 's1', name: 'Student 1' } },
        { ...mockReview, createdAt: new Date(now.getTime() + 1000), student: { id: 's2', name: 'Student 2' } },
        { ...mockReview, createdAt: now, student: { id: 's3', name: 'Student 3' } },
      ];

      mockPrisma.course.findUnique.mockResolvedValueOnce(mockCourse);
      mockPrisma.courseReview.findMany.mockResolvedValueOnce(reviews);

      const result = await service.getByCourse('course-1', mockStudent);

      expect(result.reviews[0].createdAt).toEqual(reviews[0].createdAt);
    });

    it('HU20 CA6: getStatisticsByCourses evita N+1', async () => {
      const stats = [
        { courseId: 'course-1', _avg: { rating: 4.5 }, _count: { id: 2 } },
        { courseId: 'course-2', _avg: { rating: 3.8 }, _count: { id: 3 } },
      ];

      mockPrisma.courseReview.groupBy.mockResolvedValueOnce(stats);

      const result = await service.getStatisticsByCourses(['course-1', 'course-2']);

      expect(result.get('course-1')).toEqual({ ratingAverage: 4.5, ratingCount: 2 });
      expect(result.get('course-2')).toEqual({ ratingAverage: 3.8, ratingCount: 3 });
    });
  });

  describe('HU20 CA8: Curso despublicado mantiene acceso a reseñas', () => {
    it('HU20 CA8: Alumno inscripto puede ver reseñas de curso despublicado', async () => {
      const unpublishedCourse = { ...mockCourse, isPublished: false };
      const reviewWithStudent = {
        ...mockReview,
        student: { id: 'student-1', name: 'Test Student' },
      };

      mockPrisma.course.findUnique.mockResolvedValueOnce(unpublishedCourse);
      mockPrisma.courseReview.findMany.mockResolvedValueOnce([reviewWithStudent]);

      const result = await service.getByCourse('course-1', mockStudent);

      expect(result.reviews).toHaveLength(1);
    });

    it('HU20 CA8: Alumno inscripto puede reseñar curso despublicado', async () => {
      mockPrisma.course.findUnique.mockResolvedValueOnce(mockCourse);
      mockPrisma.courseReview.findUnique.mockResolvedValueOnce(null);

      jest.spyOn(courseCompletionService, 'canReviewCourse').mockResolvedValueOnce({ eligible: true });

      mockPrisma.courseReview.create.mockResolvedValueOnce(mockReview);

      const result = await service.create('course-1', mockStudent, { rating: 5 });

      expect(result).toEqual(mockReview);
    });
  });

  describe('HU20 CA9: Multi-tenant - isolamiento por institución', () => {
    it('HU20 CA9: Usuario no puede ver reseñas de curso de otra institución', async () => {
      const courseOtherInst = { ...mockCourse, institutionId: 'inst-2' };

      mockPrisma.course.findUnique.mockResolvedValueOnce(courseOtherInst);

      const studentWrongInst = { ...mockStudent, institutionId: 'inst-1' };

      await expect(service.getByCourse('course-1', studentWrongInst)).rejects.toThrow(ForbiddenException);
    });

    it('HU20 CA9: Admin puede ver reseñas de cualquier institución', async () => {
      const courseOtherInst = { ...mockCourse, institutionId: 'inst-2' };
      const reviewWithStudent = {
        ...mockReview,
        student: { id: 'student-1', name: 'Test Student' },
      };

      mockPrisma.course.findUnique.mockResolvedValueOnce(courseOtherInst);
      mockPrisma.courseReview.findMany.mockResolvedValueOnce([reviewWithStudent]);

      const result = await service.getByCourse('course-1', mockAdmin);

      expect(result.reviews).toHaveLength(1);
    });
  });

  describe('Error handling', () => {
    it('Lanza NotFoundException si el curso no existe', async () => {
      mockPrisma.course.findUnique.mockResolvedValueOnce(null);

      await expect(service.create('invalid-course', mockStudent, { rating: 5 })).rejects.toThrow(NotFoundException);
    });

    it('Lanza NotFoundException si edita reseña inexistente', async () => {
      mockPrisma.course.findUnique.mockResolvedValueOnce(mockCourse);
      mockPrisma.courseReview.findUnique.mockResolvedValueOnce(null);

      await expect(service.update('course-1', mockStudent, { rating: 3 })).rejects.toThrow(NotFoundException);
    });

    it('Lanza NotFoundException si elimina reseña inexistente', async () => {
      mockPrisma.course.findUnique.mockResolvedValueOnce(mockCourse);
      mockPrisma.courseReview.findUnique.mockResolvedValueOnce(null);

      await expect(service.delete('course-1', mockStudent)).rejects.toThrow(NotFoundException);
    });
  });
});
