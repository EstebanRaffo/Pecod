import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { EvaluationsService } from './evaluations.service';
import { createMockPrismaService, MockPrismaService } from '../test-utils/mock-prisma';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';

describe('EvaluationsService', () => {
  let service: EvaluationsService;
  let prisma: MockPrismaService;

  const professor: AuthenticatedUser = {
    userId: 'prof-1',
    email: 'p@uade.edu.ar',
    role: Role.PROFESSOR,
    institutionId: 'inst-1',
  };
  const student: AuthenticatedUser = {
    userId: 'student-1',
    email: 's@uade.edu.ar',
    role: Role.STUDENT,
    institutionId: 'inst-1',
  };

  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new EvaluationsService(prisma as any);
  });

  describe('create (HU11)', () => {
    const validDto = {
      title: 'Parcial 1',
      minScore: 60,
      questions: [
        {
          text: '¿Qué es una HU?',
          options: [
            { text: 'Historia de Usuario', isCorrect: true },
            { text: 'Hardware Unit', isCorrect: false },
          ],
        },
      ],
    };

    it('CA: un Profesor no puede crear evaluaciones en un curso que no le pertenece', async () => {
      prisma.course.findUnique.mockResolvedValue({ id: 'course-1', professorId: 'otro' });

      await expect(service.create('course-1', professor, validDto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('CA: cada pregunta debe tener exactamente una opción correcta', async () => {
      prisma.course.findUnique.mockResolvedValue({ id: 'course-1', professorId: 'prof-1' });
      const invalidDto = {
        ...validDto,
        questions: [
          {
            text: 'Pregunta con 2 correctas',
            options: [
              { text: 'A', isCorrect: true },
              { text: 'B', isCorrect: true },
            ],
          },
        ],
      };

      await expect(service.create('course-1', professor, invalidDto as any)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.evaluation.create).not.toHaveBeenCalled();
    });

    it('CA: se crea correctamente con preguntas de opción múltiple válidas', async () => {
      prisma.course.findUnique.mockResolvedValue({ id: 'course-1', professorId: 'prof-1' });
      prisma.evaluation.create.mockResolvedValue({ id: 'eval-1', ...validDto });

      const result = await service.create('course-1', professor, validDto);
      expect(result.id).toBe('eval-1');
    });
  });

  describe('submit (HU12)', () => {
    const evaluation = {
      id: 'eval-1',
      courseId: 'course-1',
      minScore: 50,
      questions: [
        {
          id: 'q1',
          options: [
            { id: 'q1-correct', isCorrect: true },
            { id: 'q1-wrong', isCorrect: false },
          ],
        },
        {
          id: 'q2',
          options: [
            { id: 'q2-correct', isCorrect: true },
            { id: 'q2-wrong', isCorrect: false },
          ],
        },
      ],
    };

    beforeEach(() => {
      prisma.evaluation.findUnique.mockResolvedValue(evaluation);
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' }); // inscripto
    });

    it('CA: un Alumno no inscripto no puede acceder a la evaluación', async () => {
      prisma.enrollment.findUnique.mockResolvedValue(null);

      await expect(
        service.submit('eval-1', student, { answers: [] }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('CA: el sistema calcula automáticamente el puntaje y lo compara con el mínimo', async () => {
      prisma.evaluationAttempt.findMany.mockResolvedValue([]); // sin intentos previos
      prisma.evaluationAttempt.create.mockImplementation(({ data }: any) => Promise.resolve(data));

      // responde bien q1, mal q2 -> 50% -> aprueba justo con minScore=50
      const result = await service.submit('eval-1', student, {
        answers: [
          { questionId: 'q1', selectedOptionId: 'q1-correct' },
          { questionId: 'q2', selectedOptionId: 'q2-wrong' },
        ],
      });

      expect(result.score).toBe(50);
      expect(result.passed).toBe(true);
      expect(result.feedback).toEqual([
        { questionId: 'q1', correct: true, correctOptionId: 'q1-correct' },
        { questionId: 'q2', correct: false, correctOptionId: 'q2-correct' },
      ]);
    });

    it('CA: el Alumno tiene hasta 2 intentos por evaluación en V1', async () => {
      // ya tiene 2 intentos (ambos desaprobados)
      prisma.evaluationAttempt.findMany.mockResolvedValue([
        { attemptNumber: 1, passed: false },
        { attemptNumber: 2, passed: false },
      ]);

      await expect(
        service.submit('eval-1', student, {
          answers: [{ questionId: 'q1', selectedOptionId: 'q1-correct' }],
        }),
      ).rejects.toThrow('Alcanzaste el límite de 2 intentos para esta evaluación.');
      expect(prisma.evaluationAttempt.create).not.toHaveBeenCalled();
    });

    it('CA: permite un segundo intento si el primero fue desaprobado (dentro del límite)', async () => {
      prisma.evaluationAttempt.findMany.mockResolvedValue([{ attemptNumber: 1, passed: false }]);
      prisma.evaluationAttempt.create.mockImplementation(({ data }: any) => Promise.resolve(data));

      const result = await service.submit('eval-1', student, {
        answers: [
          { questionId: 'q1', selectedOptionId: 'q1-correct' },
          { questionId: 'q2', selectedOptionId: 'q2-correct' },
        ],
      });

      expect(prisma.evaluationAttempt.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ attemptNumber: 2 }) }),
      );
      expect(result.score).toBe(100);
    });

    it('CA: si la evaluación ya fue aprobada, el sistema informa la restricción (no permite nuevo intento)', async () => {
      prisma.evaluationAttempt.findMany.mockResolvedValue([{ attemptNumber: 1, passed: true }]);

      await expect(
        service.submit('eval-1', student, {
          answers: [{ questionId: 'q1', selectedOptionId: 'q1-correct' }],
        }),
      ).rejects.toThrow('Ya aprobaste esta evaluación; no podés volver a rendirla.');
    });
  });

  describe('getForTaking (HU12)', () => {
    it('CA: no revela cuál opción es correcta al Alumno que va a rendir', async () => {
      prisma.evaluation.findUnique.mockResolvedValue({
        id: 'eval-1',
        courseId: 'course-1',
        title: 'Parcial 1',
        minScore: 50,
        questions: [
          {
            id: 'q1',
            text: '¿...?',
            options: [
              { id: 'o1', text: 'A', isCorrect: true },
              { id: 'o2', text: 'B', isCorrect: false },
            ],
          },
        ],
      });
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' });
      prisma.evaluationAttempt.findMany.mockResolvedValue([]);

      const result = await service.getForTaking('eval-1', student);

      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain('isCorrect');
    });
  });

  it('evaluación inexistente lanza NotFoundException', async () => {
    prisma.evaluation.findUnique.mockResolvedValue(null);
    await expect(service.getForTaking('no-existe', student)).rejects.toThrow(NotFoundException);
  });
});
