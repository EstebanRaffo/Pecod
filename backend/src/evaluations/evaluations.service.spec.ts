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

  describe('editing evaluation text', () => {
    const evaluation = {
      id: 'eval-1', courseId: 'course-1', title: 'Parcial', minScore: 60,
      questions: [{ id: 'q1', text: 'Original', options: [{ id: 'o1', text: 'Respuesta', isCorrect: true }] }],
    };

    beforeEach(() => {
      prisma.evaluation.findUnique.mockResolvedValue(evaluation);
      prisma.course.findUnique.mockResolvedValue({ professorId: professor.userId });
      prisma.evaluation.update.mockResolvedValue(evaluation);
    });

    it('returns the detail only to the owner', async () => {
      expect(await service.getForEditing('eval-1', professor)).toEqual(evaluation);
      prisma.course.findUnique.mockResolvedValue({ professorId: 'other' });
      await expect(service.getForEditing('eval-1', professor)).rejects.toThrow(ForbiddenException);
      await expect(service.updateText('eval-1', professor, 'q1', 'New', 'question')).rejects.toThrow(ForbiddenException);
      expect(prisma.evaluation.update).not.toHaveBeenCalled();
    });

    it.each(['question', 'option'] as const)('updates only the %s text without changing grading or attempts', async (kind) => {
      const targetId = kind === 'question' ? 'q1' : 'o1';
      await service.updateText('eval-1', professor, targetId, 'Nuevo texto', kind);
      expect(prisma.evaluation.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'eval-1' },
        data: { questions: { update: {
          where: { id: 'q1' },
          data: kind === 'question' ? { text: 'Nuevo texto' }
            : { options: { update: { where: { id: 'o1' }, data: { text: 'Nuevo texto' } } } },
        } } },
      }));
      expect(prisma.evaluationAttempt.update).not.toHaveBeenCalled();
    });

    it.each(['question', 'option'] as const)('rejects a %s from another evaluation', async (kind) => {
      await expect(service.updateText('eval-1', professor, 'foreign-id', 'New', kind)).rejects.toThrow(NotFoundException);
      expect(prisma.evaluation.update).not.toHaveBeenCalled();
    });

    it('rejects blank text', async () => {
      await expect(service.updateText('eval-1', professor, 'q1', '  ', 'question')).rejects.toThrow(BadRequestException);
      expect(prisma.evaluation.update).not.toHaveBeenCalled();
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

  describe('preserving graded evaluations', () => {
    const original = {
      id: 'eval-1', courseId: 'course-1', title: 'Parcial', minScore: 60,
      questions: [{ id: 'q1', text: 'Original question', options: [
        { id: 'o1', text: 'Original answer', isCorrect: true },
        { id: 'o2', text: 'Wrong answer', isCorrect: false },
      ] }],
    };
    const edited = {
      ...original,
      questions: [{ ...original.questions[0], text: 'Edited question', options: [
        { ...original.questions[0].options[0], text: 'Edited answer' },
        original.questions[0].options[1],
      ] }],
    };

    beforeEach(() => {
      prisma.evaluation.findUnique.mockResolvedValue(edited);
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' });
      prisma.evaluationAttempt.create.mockImplementation(({ data }: any) => Promise.resolve(data));
    });

    it('students without a grade see the edited text', async () => {
      prisma.evaluationAttempt.findMany.mockResolvedValue([]);
      const result = await service.getForTaking('eval-1', student);
      expect(result.questions[0].text).toBe('Edited question');
      expect(result.questions[0].options[0].text).toBe('Edited answer');
    });

    it('students with a failed grade see the original text on their second attempt', async () => {
      prisma.evaluationAttempt.findMany.mockResolvedValue([
        { attemptNumber: 1, score: 0, passed: false, evaluationSnapshot: original },
      ]);
      const result = await service.getForTaking('eval-1', student);
      expect(result.questions[0].text).toBe('Original question');
      expect(result.questions[0].options[0].text).toBe('Original answer');
      expect(JSON.stringify(result)).not.toContain('isCorrect');
      expect(JSON.stringify(result)).not.toContain('evaluationSnapshot');
    });

    it('stores the version taken and does not expose the answer-key snapshot', async () => {
      prisma.evaluationAttempt.findMany.mockResolvedValue([]);
      const result = await service.submit('eval-1', student, {
        answers: [{ questionId: 'q1', selectedOptionId: 'o1' }],
      });
      expect(prisma.evaluationAttempt.create).toHaveBeenCalledWith({ data: expect.objectContaining({
        evaluationSnapshot: { id: edited.id, title: edited.title, minScore: edited.minScore, questions: edited.questions },
      }) });
      expect(JSON.stringify(result)).not.toContain('evaluationSnapshot');
      expect(JSON.stringify(result)).not.toContain('isCorrect');
    });

    it('grades a second attempt with the preserved version and leaves the previous grade untouched', async () => {
      const previousAttempt = { attemptNumber: 1, score: 0, passed: false, evaluationSnapshot: original };
      prisma.evaluationAttempt.findMany.mockResolvedValue([previousAttempt]);
      prisma.evaluation.findUnique.mockResolvedValue({ ...edited, minScore: 100, questions: [
        { ...edited.questions[0], options: [
          { ...edited.questions[0].options[0], isCorrect: false },
          { ...edited.questions[0].options[1], isCorrect: true },
        ] },
      ] });
      const result = await service.submit('eval-1', student, {
        answers: [{ questionId: 'q1', selectedOptionId: 'o1' }],
      });
      expect(result.score).toBe(100);
      expect(result.passed).toBe(true);
      expect(prisma.evaluationAttempt.create).toHaveBeenCalledWith({ data: expect.objectContaining({
        evaluationSnapshot: { id: original.id, title: original.title, minScore: original.minScore, questions: original.questions },
      }) });
      expect(previousAttempt.score).toBe(0);
      expect(prisma.evaluationAttempt.update).not.toHaveBeenCalled();
    });
  });

  it('evaluación inexistente lanza NotFoundException', async () => {
    prisma.evaluation.findUnique.mockResolvedValue(null);
    await expect(service.getForTaking('no-existe', student)).rejects.toThrow(NotFoundException);
  });
});
