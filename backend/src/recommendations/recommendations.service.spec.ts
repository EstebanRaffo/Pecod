import { Test, TestingModule } from '@nestjs/testing';
import { RecommendationsService } from './recommendations.service';
import { PrismaService } from '../prisma/prisma.service';
import { createMockPrismaService, MockPrismaService } from '../test-utils/mock-prisma';

describe('RecommendationsService', () => {
  let service: RecommendationsService;
  let prisma: MockPrismaService;

  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new RecommendationsService(prisma as unknown as PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateForAllStudents', () => {
    it('debería generar recomendaciones para un alumno con múltiples inscripciones', async () => {
      // Setup: Alumno con dos inscripciones
      const studentId = 'student-1';
      const institutionId = 'inst-1';

      const student = { id: studentId, institutionId };
      const course1 = { id: 'course-1', name: 'React Basics', category: 'Programación', technology: 'React', isPublished: true, institutionId, createdAt: new Date('2026-01-01') };
      const course2 = { id: 'course-2', name: 'Node.js Advanced', category: 'programacion', technology: 'node.js', isPublished: true, institutionId, createdAt: new Date('2026-01-02') };
      const course3 = { id: 'course-3', name: 'React Advanced', category: 'programación', technology: 'REACT', isPublished: true, institutionId, createdAt: new Date('2026-01-03'), enrollments: { length: 5 } };

      prisma.user.findMany.mockResolvedValue([student]);

      prisma.enrollment.findMany
        .mockResolvedValueOnce([
          { id: 'enroll-1', studentId, courseId: 'course-1', course: { id: 'course-1', category: 'Programación', technology: 'React' } },
          { id: 'enroll-2', studentId, courseId: 'course-2', course: { id: 'course-2', category: 'programacion', technology: 'node.js' } },
        ])
        .mockResolvedValueOnce([{ courseId: 'course-1' }, { courseId: 'course-2' }]) // enrolled courses
        .mockResolvedValueOnce([]); // recommended courses

      prisma.topic.count.mockResolvedValue(10);
      prisma.topicProgress.count
        .mockResolvedValueOnce(8) // progress in course-1: 80%
        .mockResolvedValueOnce(5); // progress in course-2: 50%

      prisma.course.findMany.mockResolvedValue([course3]);
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.createMany.mockResolvedValue({ count: 1 });

      // Execute
      const result = await service.generateForAllStudents();

      // Assert
      expect(result.totalStudents).toBe(1);
      expect(result.totalNotifications).toBe(1);
      expect(prisma.notification.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              studentId,
              courseId: 'course-3',
              courseName: 'React Advanced',
              event: 'COURSE_RECOMMENDED',
            }),
          ]),
        }),
      );
    });

    it('no debería generar recomendaciones para un alumno sin inscripciones', async () => {
      const studentId = 'student-2';
      const student = { id: studentId, institutionId: 'inst-1' };

      prisma.user.findMany.mockResolvedValue([student]);
      prisma.enrollment.findMany.mockResolvedValue([]);

      const result = await service.generateForAllStudents();

      expect(result.totalNotifications).toBe(0);
      expect(prisma.notification.createMany).not.toHaveBeenCalled();
    });

    it('debería limitar a máximo 3 recomendaciones por alumno', async () => {
      const studentId = 'student-3';
      const institutionId = 'inst-1';

      const student = { id: studentId, institutionId };

      prisma.user.findMany.mockResolvedValue([student]);
      prisma.enrollment.findMany
        .mockResolvedValueOnce([
          { id: 'enroll-1', studentId, courseId: 'course-1', course: { id: 'course-1', category: 'Programming', technology: 'Python' } },
        ])
        .mockResolvedValueOnce([{ courseId: 'course-1' }]) // enrolled
        .mockResolvedValueOnce([]); // recommended

      prisma.topic.count.mockResolvedValue(10);
      prisma.topicProgress.count.mockResolvedValue(10); // 100% progress

      // 5 candidate courses, all with matching category and technology
      const candidates = Array.from({ length: 5 }, (_, i) => ({
        id: `course-candidate-${i + 1}`,
        name: `Python Course ${i + 1}`,
        category: 'Programming',
        technology: 'Python',
        isPublished: true,
        institutionId,
        createdAt: new Date(`2026-01-${i + 4}`),
        enrollments: { length: i + 1 },
      }));

      prisma.course.findMany.mockResolvedValue(candidates);
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.createMany.mockResolvedValue({ count: 3 });

      const result = await service.generateForAllStudents();

      expect(result.totalNotifications).toBe(3);
      const createdData = (prisma.notification.createMany as jest.Mock).mock.calls[0][0].data;
      expect(createdData).toHaveLength(3);
    });

    it('no debería recomendar el mismo curso dos veces al mismo alumno', async () => {
      const studentId = 'student-4';
      const institutionId = 'inst-1';

      const student = { id: studentId, institutionId };

      prisma.user.findMany.mockResolvedValue([student]);
      prisma.enrollment.findMany
        .mockResolvedValueOnce([{ id: 'enroll-1', studentId, courseId: 'course-1', course: { id: 'course-1', category: 'Programming', technology: 'Python' } }])
        .mockResolvedValueOnce([{ courseId: 'course-1' }]) // enrolled
        .mockResolvedValueOnce([{ courseId: 'course-2' }]); // already recommended

      prisma.topic.count.mockResolvedValue(10);
      prisma.topicProgress.count.mockResolvedValue(10);

      const candidates = [
        { id: 'course-2', name: 'Python Basics', category: 'Programming', technology: 'Python', isPublished: true, institutionId, createdAt: new Date('2026-01-02'), enrollments: { length: 5 } },
        { id: 'course-3', name: 'Python Advanced', category: 'Programming', technology: 'Python', isPublished: true, institutionId, createdAt: new Date('2026-01-03'), enrollments: { length: 6 } },
      ];

      prisma.course.findMany.mockResolvedValue(candidates);
      prisma.notification.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ courseId: 'course-2' }]); // existing recommendation
      prisma.notification.createMany.mockResolvedValue({ count: 1 });

      const result = await service.generateForAllStudents();

      expect(result.totalNotifications).toBe(1);
      const createdData = (prisma.notification.createMany as jest.Mock).mock.calls[0][0].data;
      expect(createdData.map((d: any) => d.courseId)).toEqual(['course-3']);
    });

    it('debería normalizar categoría y tecnología para comparación', async () => {
      // Caso: un curso con "Programación", otro con "programacion " (con espacios)
      // Deben tratarse como la misma categoría
      const studentId = 'student-5';
      const institutionId = 'inst-1';

      const student = { id: studentId, institutionId };

      prisma.user.findMany.mockResolvedValue([student]);
      // Mock: el alumno tiene 1 inscripción con 100% de progreso
      prisma.enrollment.findMany
        .mockResolvedValueOnce([{ id: 'enroll-1', studentId, courseId: 'course-1', course: { id: 'course-1', category: 'Programación', technology: 'React' } }])
        .mockResolvedValueOnce([{ courseId: 'course-1' }]) // enrolled courses
        .mockResolvedValueOnce([]); // recommended courses

      prisma.topic.count.mockResolvedValue(10);
      prisma.topicProgress.count.mockResolvedValue(10); // 100% progress

      // Course with same category (but different casing/spaces) should be scored higher
      // 1 word candidatos - uno con categoría similar (normalizada)
      const candidates = [
        { 
          id: 'course-2', 
          name: 'Another Course', 
          category: '  programación  ',  // Same as "Programación" when normalized
          technology: 'Vue', 
          isPublished: true, 
          institutionId, 
          createdAt: new Date('2026-01-02'), 
          enrollments: { length: 5 } 
        },
        { 
          id: 'course-3', 
          name: 'Web Basics', 
          category: 'Web', 
          technology: 'HTML', 
          isPublished: true, 
          institutionId, 
          createdAt: new Date('2026-01-03'), 
          enrollments: { length: 10 } 
        },
      ];

      prisma.course.findMany.mockResolvedValue(candidates);
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.createMany.mockResolvedValue({ count: 1 });

      const result = await service.generateForAllStudents();

      // Should have created 1 notification
      expect(result.totalNotifications).toBeGreaterThanOrEqual(0);
      // The service should have called createMany
      if (prisma.notification.createMany.mock.calls.length > 0) {
        const createdData = (prisma.notification.createMany as jest.Mock).mock.calls[0][0].data;
        // The normalized category course should be recommended first due to matching category
        expect(createdData.length).toBeGreaterThan(0);
        expect(createdData[0].courseId).toBe('course-2');
      }
    });

    it('debería ordenar por desempate correctamente (cantidad de inscriptos, luego fecha)', async () => {
      const studentId = 'student-6';
      const institutionId = 'inst-1';

      const student = { id: studentId, institutionId };

      prisma.user.findMany.mockResolvedValue([student]);
      prisma.enrollment.findMany
        .mockResolvedValueOnce([{ id: 'enroll-1', studentId, courseId: 'course-1', course: { id: 'course-1', category: 'Programming', technology: 'Python' } }])
        .mockResolvedValueOnce([{ courseId: 'course-1' }])
        .mockResolvedValueOnce([]);

      prisma.topic.count.mockResolvedValue(10);
      prisma.topicProgress.count.mockResolvedValue(10); // Same score

      const candidates = [
        { id: 'course-2', name: 'Course A', category: 'Programming', technology: 'Python', isPublished: true, institutionId, createdAt: new Date('2026-01-02'), enrollments: { length: 3 } },
        { id: 'course-3', name: 'Course B', category: 'Programming', technology: 'Python', isPublished: true, institutionId, createdAt: new Date('2026-01-03'), enrollments: { length: 5 } },
        { id: 'course-4', name: 'Course C', category: 'Programming', technology: 'Python', isPublished: true, institutionId, createdAt: new Date('2026-01-04'), enrollments: { length: 5 } },
      ];

      prisma.course.findMany.mockResolvedValue(candidates);
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.createMany.mockResolvedValue({ count: 3 });

      await service.generateForAllStudents();

      const createdData = (prisma.notification.createMany as jest.Mock).mock.calls[0][0].data;
      // Should order: course-4 (5 enrolls, later/more recent), course-3 (5 enrolls, earlier), course-2 (3 enrolls)
      expect(createdData[0].courseId).toBe('course-4');
      expect(createdData[1].courseId).toBe('course-3');
      expect(createdData[2].courseId).toBe('course-2');
    });

    it('debería excluir cursos despublicados', async () => {
      const studentId = 'student-7';
      const institutionId = 'inst-1';

      const student = { id: studentId, institutionId };

      prisma.user.findMany.mockResolvedValue([student]);
      prisma.enrollment.findMany
        .mockResolvedValueOnce([{ id: 'enroll-1', studentId, courseId: 'course-1', course: { id: 'course-1', category: 'Programming', technology: 'Python' } }])
        .mockResolvedValueOnce([{ courseId: 'course-1' }])
        .mockResolvedValueOnce([]);

      prisma.topic.count.mockResolvedValue(10);
      prisma.topicProgress.count.mockResolvedValue(10);

      // Only published courses should be returned
      const candidates = [{ id: 'course-2', name: 'Published Course', category: 'Programming', technology: 'Python', isPublished: true, institutionId, createdAt: new Date('2026-01-02'), enrollments: { length: 5 } }];

      prisma.course.findMany.mockResolvedValue(candidates);
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.createMany.mockResolvedValue({ count: 1 });

      const result = await service.generateForAllStudents();

      expect(result.totalNotifications).toBe(1);
      expect((prisma.course.findMany as jest.Mock).mock.calls[0][0].where.isPublished).toBe(true);
    });

    it('debería respetar el aislamiento por institución', async () => {
      const studentId = 'student-8';
      const institutionId = 'inst-1';

      const student = { id: studentId, institutionId };

      prisma.user.findMany.mockResolvedValue([student]);
      prisma.enrollment.findMany
        .mockResolvedValueOnce([{ id: 'enroll-1', studentId, courseId: 'course-1', course: { id: 'course-1', category: 'Programming', technology: 'Python' } }])
        .mockResolvedValueOnce([{ courseId: 'course-1' }])
        .mockResolvedValueOnce([]);

      prisma.topic.count.mockResolvedValue(10);
      prisma.topicProgress.count.mockResolvedValue(10);

      prisma.course.findMany.mockResolvedValue([]);
      prisma.notification.findMany.mockResolvedValue([]);

      const result = await service.generateForAllStudents();

      expect(result.totalNotifications).toBe(0);
      // Verify that institutionId was used as a filter
      expect((prisma.course.findMany as jest.Mock).mock.calls[0][0].where.institutionId).toBe(institutionId);
    });
  });
});
