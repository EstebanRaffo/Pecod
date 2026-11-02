import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { createMockPrismaService } from '../test-utils/mock-prisma';
import { PrismaService } from '../prisma/prisma.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = createMockPrismaService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  describe('getAnalyticsByProfessor', () => {
    const professorId = 'prof-1';
    const institutionId = 'inst-1';

    // HU21 CA8: Si el Profesor no tiene cursos, se retorna array vacío
    it('debería retornar array vacío cuando el profesor no tiene cursos', async () => {
      prismaMock.course.findMany.mockResolvedValue([]);

      const result = await service.getAnalyticsByProfessor(professorId, institutionId);

      expect(result).toEqual([]);
      expect(prismaMock.course.findMany).toHaveBeenCalledWith({
        where: { professorId, institutionId },
        select: expect.objectContaining({
          id: true,
          name: true,
          isPublished: true,
          topics: expect.any(Object),
          enrollments: expect.any(Object),
          reviews: expect.any(Object),
        }),
      });
    });

    // HU21 CA1: Incluir cursos publicados, despublicados y borradores
    it('debería incluir cursos publicados, despublicados y borradores', async () => {
      prismaMock.course.findMany.mockResolvedValue([
        {
          id: 'course-1',
          name: 'Curso Publicado',
          isPublished: true,
          topics: [{ id: 't1' }],
          enrollments: [],
          reviews: [],
        },
        {
          id: 'course-2',
          name: 'Curso Despublicado',
          isPublished: false,
          topics: [{ id: 't1' }],
          enrollments: [{ id: 'e1', studentId: 's1', topicProgress: [{ topicId: 't1' }] }],
          reviews: [],
        },
        {
          id: 'course-3',
          name: 'Curso Borrador',
          isPublished: false,
          topics: [{ id: 't1' }],
          enrollments: [],
          reviews: [],
        },
      ]);

      const result = await service.getAnalyticsByProfessor(professorId, institutionId);

      expect(result).toHaveLength(3);
      expect(result[0].status).toBe('published');
      expect(result[1].status).toBe('unpublished');
      expect(result[2].status).toBe('draft');
    });

    // HU21 CA2: Porcentaje de avance promedio - sin inscriptos
    it('debería retornar 0% de avance si no hay inscriptos', async () => {
      prismaMock.course.findMany.mockResolvedValue([
        {
          id: 'course-1',
          name: 'Curso Sin Inscriptos',
          isPublished: true,
          topics: [{ id: 't1' }, { id: 't2' }],
          enrollments: [],
          reviews: [],
        },
      ]);

      const result = await service.getAnalyticsByProfessor(professorId, institutionId);

      expect(result[0].averageProgress).toBe(0);
      expect(result[0].enrolledCount).toBe(0);
    });

    // HU21 CA2: Porcentaje de avance promedio - sin temas
    it('debería retornar 0% de avance si no hay temas', async () => {
      prismaMock.course.findMany.mockResolvedValue([
        {
          id: 'course-1',
          name: 'Curso Sin Temas',
          isPublished: true,
          topics: [],
          enrollments: [
            { id: 'e1', studentId: 's1', topicProgress: [] },
            { id: 'e2', studentId: 's2', topicProgress: [] },
          ],
          reviews: [],
        },
      ]);

      const result = await service.getAnalyticsByProfessor(professorId, institutionId);

      expect(result[0].averageProgress).toBe(0);
      expect(result[0].enrolledCount).toBe(2);
    });

    // HU21 CA2: Porcentaje de avance promedio - múltiples porcentajes
    it('debería calcular correctamente el promedio de porcentajes individuales', async () => {
      // Curso con 4 temas: 
      // - Alumno 1: 2/4 temas = 50%
      // - Alumno 2: 3/4 temas = 75%
      // - Alumno 3: 4/4 temas = 100%
      // Promedio: (50 + 75 + 100) / 3 = 75%
      prismaMock.course.findMany.mockResolvedValue([
        {
          id: 'course-1',
          name: 'Curso Con Temas',
          isPublished: true,
          topics: [{ id: 't1' }, { id: 't2' }, { id: 't3' }, { id: 't4' }],
          enrollments: [
            {
              id: 'e1',
              studentId: 's1',
              topicProgress: [{ topicId: 't1' }, { topicId: 't2' }],
            },
            {
              id: 'e2',
              studentId: 's2',
              topicProgress: [{ topicId: 't1' }, { topicId: 't2' }, { topicId: 't3' }],
            },
            {
              id: 'e3',
              studentId: 's3',
              topicProgress: [{ topicId: 't1' }, { topicId: 't2' }, { topicId: 't3' }, { topicId: 't4' }],
            },
          ],
          reviews: [],
        },
      ]);

      const result = await service.getAnalyticsByProfessor(professorId, institutionId);

      expect(result[0].averageProgress).toBe(75);
      expect(result[0].enrolledCount).toBe(3);
    });

    // HU21 CA2: Verificar que cada porcentaje se redondea individualmente
    it('debería redondear correctamente porcentajes con decimales', async () => {
      // Curso con 3 temas:
      // - Alumno 1: 1/3 = 33.33... → 33%
      // - Alumno 2: 2/3 = 66.66... → 67%
      // Promedio: (33 + 67) / 2 = 50%
      prismaMock.course.findMany.mockResolvedValue([
        {
          id: 'course-1',
          name: 'Curso Decimales',
          isPublished: true,
          topics: [{ id: 't1' }, { id: 't2' }, { id: 't3' }],
          enrollments: [
            { id: 'e1', studentId: 's1', topicProgress: [{ topicId: 't1' }] },
            { id: 'e2', studentId: 's2', topicProgress: [{ topicId: 't1' }, { topicId: 't2' }] },
          ],
          reviews: [],
        },
      ]);

      const result = await service.getAnalyticsByProfessor(professorId, institutionId);

      // 1/3 * 100 = 33.33 → Math.round = 33
      // 2/3 * 100 = 66.66 → Math.round = 67
      // (33 + 67) / 2 = 50
      expect(result[0].averageProgress).toBe(50);
    });

    // HU21 CA3: Calificación promedio sin reseñas
    it('debería retornar null para calificación si no hay reseñas', async () => {
      prismaMock.course.findMany.mockResolvedValue([
        {
          id: 'course-1',
          name: 'Curso Sin Reseñas',
          isPublished: true,
          topics: [{ id: 't1' }],
          enrollments: [{ id: 'e1', studentId: 's1', topicProgress: [] }],
          reviews: [],
        },
      ]);

      const result = await service.getAnalyticsByProfessor(professorId, institutionId);

      expect(result[0].ratingAverage).toBeNull();
      expect(result[0].ratingCount).toBe(0);
    });

    // HU21 CA3: Calificación promedio con reseñas
    it('debería calcular calificación promedio a 1 decimal', async () => {
      // Reseñas: 4, 5, 3
      // Promedio: 4 (12/3)
      prismaMock.course.findMany.mockResolvedValue([
        {
          id: 'course-1',
          name: 'Curso Con Reseñas',
          isPublished: true,
          topics: [{ id: 't1' }],
          enrollments: [{ id: 'e1', studentId: 's1', topicProgress: [] }],
          reviews: [{ rating: 4 }, { rating: 5 }, { rating: 3 }],
        },
      ]);

      const result = await service.getAnalyticsByProfessor(professorId, institutionId);

      expect(result[0].ratingAverage).toBe(4);
      expect(result[0].ratingCount).toBe(3);
    });

    // HU21 CA3: Calificación con decimales
    it('debería redondear calificación a 1 decimal', async () => {
      // Reseñas: 4, 5
      // Promedio: 4.5 (9/2)
      prismaMock.course.findMany.mockResolvedValue([
        {
          id: 'course-1',
          name: 'Curso Con Decimales',
          isPublished: true,
          topics: [{ id: 't1' }],
          enrollments: [{ id: 'e1', studentId: 's1', topicProgress: [] }],
          reviews: [{ rating: 4 }, { rating: 5 }],
        },
      ]);

      const result = await service.getAnalyticsByProfessor(professorId, institutionId);

      expect(result[0].ratingAverage).toBe(4.5);
    });

    // HU21 CA3: Calificación con muchos decimales
    it('debería truncar correctamente decimales en calificación', async () => {
      // Reseñas: 3, 3, 4
      // Promedio: 3.333... → 3.3
      prismaMock.course.findMany.mockResolvedValue([
        {
          id: 'course-1',
          name: 'Curso Decimales',
          isPublished: true,
          topics: [{ id: 't1' }],
          enrollments: [{ id: 'e1', studentId: 's1', topicProgress: [] }],
          reviews: [{ rating: 3 }, { rating: 3 }, { rating: 4 }],
        },
      ]);

      const result = await service.getAnalyticsByProfessor(professorId, institutionId);

      expect(result[0].ratingAverage).toBe(3.3);
    });

    // HU21 CA6: Curso despublicado mantiene indicadores
    it('debería incluir indicadores de curso despublicado', async () => {
      prismaMock.course.findMany.mockResolvedValue([
        {
          id: 'course-1',
          name: 'Curso Despublicado',
          isPublished: false,
          topics: [{ id: 't1' }, { id: 't2' }],
          enrollments: [
            { id: 'e1', studentId: 's1', topicProgress: [{ topicId: 't1' }] },
            { id: 'e2', studentId: 's2', topicProgress: [{ topicId: 't1' }, { topicId: 't2' }] },
          ],
          reviews: [{ rating: 4 }],
        },
      ]);

      const result = await service.getAnalyticsByProfessor(professorId, institutionId);

      expect(result[0].status).toBe('unpublished');
      expect(result[0].enrolledCount).toBe(2);
      expect(result[0].averageProgress).toBe(75); // (50 + 100) / 2
      expect(result[0].ratingAverage).toBe(4);
    });

    // HU21 CA7: Profesor solo ve sus cursos
    it('debería filtrar por profesorId e institutionId', async () => {
      prismaMock.course.findMany.mockResolvedValue([]);

      await service.getAnalyticsByProfessor(professorId, institutionId);

      expect(prismaMock.course.findMany).toHaveBeenCalledWith({
        where: {
          professorId,
          institutionId,
        },
        select: expect.any(Object),
      });
    });

    // HU21 CA5: Solo datos agregados
    it('debería retornar solo datos agregados sin información de alumnos individuales', async () => {
      prismaMock.course.findMany.mockResolvedValue([
        {
          id: 'course-1',
          name: 'Curso',
          isPublished: true,
          topics: [{ id: 't1' }],
          enrollments: [{ id: 'e1', studentId: 's1', topicProgress: [] }],
          reviews: [],
        },
      ]);

      const result = await service.getAnalyticsByProfessor(professorId, institutionId);

      expect(result[0]).toEqual({
        courseId: 'course-1',
        title: 'Curso',
        status: 'published',
        enrolledCount: 1,
        averageProgress: 0,
        ratingAverage: null,
        ratingCount: 0,
      });

      // Verificar que NO contiene información de alumnos
      expect(JSON.stringify(result[0])).not.toContain('studentId');
      expect(JSON.stringify(result[0])).not.toContain('s1');
    });
  });
});
