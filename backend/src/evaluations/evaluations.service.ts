import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';
import { UpdateEvaluationDto } from './dto/update-evaluation.dto';
import { SubmitAttemptDto } from './dto/submit-attempt.dto';

const MAX_ATTEMPTS = 2; // HU12: "el Alumno tiene hasta 2 intentos por evaluación en V1"

interface EvaluationSnapshot {
  id: string;
  title: string;
  minScore: number;
  questions: {
    id: string;
    text: string;
    options: { id: string; text: string; isCorrect: boolean }[];
  }[];
}

@Injectable()
export class EvaluationsService {
  constructor(private prisma: PrismaService) {}

  // Lista de evaluaciones de un curso, sin revelar las respuestas correctas.
  // La usan tanto el Profesor (para administrarlas) como el Alumno inscripto (para rendirlas).
  async listByCourse(courseId: string, user: AuthenticatedUser) {
    if (user.role === Role.STUDENT) {
      await this.assertEnrolled(courseId, user);
    }
    const evaluations = await this.prisma.evaluation.findMany({
      where: { courseId },
      select: { id: true, title: true, minScore: true, topicId: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    return evaluations;
  }

  // HU11
  async create(courseId: string, professor: AuthenticatedUser, dto: CreateEvaluationDto) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Curso no encontrado.');
    if (course.professorId !== professor.userId) {
      throw new ForbiddenException('No podés crear evaluaciones en un curso que no te pertenece.');
    }

    // Defensa adicional más allá del DTO: cada pregunta debe tener EXACTAMENTE una opción correcta.
    for (const question of dto.questions) {
      const correctCount = question.options.filter((o) => o.isCorrect).length;
      if (correctCount !== 1) {
        throw new BadRequestException(
          `La pregunta "${question.text}" debe tener exactamente una opción correcta.`,
        );
      }
    }

    return this.prisma.evaluation.create({
      data: {
        courseId,
        topicId: dto.topicId,
        title: dto.title,
        minScore: dto.minScore,
        questions: {
          create: dto.questions.map((q, index) => ({
            text: q.text,
            order: index + 1,
            options: { create: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })) },
          })),
        },
      },
      include: { questions: { include: { options: true } } },
    });
  }

  async update(evaluationId: string, professor: AuthenticatedUser, dto: UpdateEvaluationDto) {
    const evaluation = await this.getEvaluationOrThrow(evaluationId);
    const course = await this.prisma.course.findUnique({ where: { id: evaluation.courseId } });
    if (!course || course.professorId !== professor.userId) {
      throw new ForbiddenException('No podés modificar una evaluación de un curso que no te pertenece.');
    }
    return this.prisma.evaluation.update({
      where: { id: evaluation.id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.minScore !== undefined ? { minScore: dto.minScore } : {}),
      },
    });
  }

  async getForEditing(evaluationId: string, professor: AuthenticatedUser) {
    const evaluation = await this.getEvaluationOrThrow(evaluationId);
    const course = await this.prisma.course.findUnique({ where: { id: evaluation.courseId } });
    if (!course || course.professorId !== professor.userId) {
      throw new ForbiddenException('No podés modificar una evaluación de un curso que no te pertenece.');
    }
    return evaluation;
  }

  async updateText(
    evaluationId: string,
    professor: AuthenticatedUser,
    targetId: string,
    text: string,
    kind: 'question' | 'option',
  ) {
    const evaluation = await this.getForEditing(evaluationId, professor);
    if (!text?.trim()) throw new BadRequestException('El texto no puede estar vacío.');
    const question = evaluation.questions.find((item) =>
      kind === 'question' ? item.id === targetId : item.options.some((option) => option.id === targetId),
    );
    if (!question) throw new NotFoundException('Pregunta o respuesta no encontrada en esta evaluación.');
    return this.prisma.evaluation.update({
      where: { id: evaluationId },
      data: {
        questions: {
          update: {
            where: { id: question.id },
            data: kind === 'question'
              ? { text }
              : { options: { update: { where: { id: targetId }, data: { text } } } },
          },
        },
      },
      include: { questions: { orderBy: { order: 'asc' }, include: { options: true } } },
    });
  }

  // HU12: trae la evaluación para que el Alumno la rinda, sin revelar cuál opción es correcta.
  async getForTaking(evaluationId: string, student: AuthenticatedUser) {
    const evaluation = await this.getEvaluationOrThrow(evaluationId);
    await this.assertEnrolled(evaluation.courseId, student);

    const attempts = await this.prisma.evaluationAttempt.findMany({
      where: { evaluationId, studentId: student.userId },
      orderBy: { attemptNumber: 'asc' },
    });
    this.assertCanAttempt(attempts);
    const version = this.getAttemptVersion(evaluation, attempts);

    return {
      id: version.id,
      title: version.title,
      minScore: version.minScore,
      attemptsUsed: attempts.length,
      maxAttempts: MAX_ATTEMPTS,
      questions: version.questions.map((q) => ({
        id: q.id,
        text: q.text,
        options: q.options.map((o) => ({ id: o.id, text: o.text })), // sin isCorrect
      })),
    };
  }

  // HU12: corrige automáticamente y aplica el límite de 2 intentos.
  async submit(evaluationId: string, student: AuthenticatedUser, dto: SubmitAttemptDto) {
    const evaluation = await this.getEvaluationOrThrow(evaluationId);
    await this.assertEnrolled(evaluation.courseId, student);

    const attempts = await this.prisma.evaluationAttempt.findMany({
      where: { evaluationId, studentId: student.userId },
      orderBy: { attemptNumber: 'asc' },
    });
    this.assertCanAttempt(attempts);
    const version = this.getAttemptVersion(evaluation, attempts);

    let correctCount = 0;
    const feedback = version.questions.map((question) => {
      const answer = dto.answers.find((a) => a.questionId === question.id);
      const correctOption = question.options.find((o) => o.isCorrect);
      const isCorrect = !!answer && answer.selectedOptionId === correctOption?.id;
      if (isCorrect) correctCount += 1;
      return {
        questionId: question.id,
        correct: isCorrect,
        correctOptionId: correctOption?.id,
      };
    });

    const score = Math.round((correctCount / version.questions.length) * 100);
    const passed = score >= version.minScore;

    const attempt = await this.prisma.evaluationAttempt.create({
      data: {
        evaluationId,
        studentId: student.userId,
        attemptNumber: attempts.length + 1,
        score,
        passed,
        evaluationSnapshot: {
          id: version.id,
          title: version.title,
          minScore: version.minScore,
          questions: version.questions.map((question) => ({
            id: question.id,
            text: question.text,
            options: question.options.map((option) => ({
              id: option.id, text: option.text, isCorrect: option.isCorrect,
            })),
          })),
        },
      },
    });

    const { evaluationSnapshot, ...publicAttempt } = attempt;
    return { attempt: publicAttempt, score, passed, feedback };
  }

  private getAttemptVersion(
    evaluation: EvaluationSnapshot,
    attempts: { evaluationSnapshot?: Prisma.JsonValue }[],
  ): EvaluationSnapshot {
    const snapshot = attempts[0]?.evaluationSnapshot;
    return snapshot ? snapshot as unknown as EvaluationSnapshot : evaluation;
  }

  private async getEvaluationOrThrow(evaluationId: string) {
    const evaluation = await this.prisma.evaluation.findUnique({
      where: { id: evaluationId },
      include: { questions: { orderBy: { order: 'asc' }, include: { options: true } } },
    });
    if (!evaluation) throw new NotFoundException('Evaluación no encontrada.');
    return evaluation;
  }

  private async assertEnrolled(courseId: string, student: AuthenticatedUser) {
    // HU12: "un Alumno no inscripto no puede acceder a la evaluación del curso"
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId: student.userId, courseId } },
    });
    if (!enrollment) {
      throw new ForbiddenException('Necesitás estar inscripto en el curso para rendir esta evaluación.');
    }
  }

  private assertCanAttempt(attempts: { passed: boolean }[]) {
    // HU12: "si la evaluación ya fue aprobada, el sistema informa la restricción correspondiente"
    if (attempts.some((a) => a.passed)) {
      throw new BadRequestException('Ya aprobaste esta evaluación; no podés volver a rendirla.');
    }
    // HU12: "el Alumno tiene hasta 2 intentos... si desaprueba ambos, no permite un nuevo intento"
    if (attempts.length >= MAX_ATTEMPTS) {
      throw new BadRequestException(
        `Alcanzaste el límite de ${MAX_ATTEMPTS} intentos para esta evaluación.`,
      );
    }
  }
}
