import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { generateCertificatePdf } from './pdf.helper';

export interface CertificateStatus {
  eligible: boolean;
  issued: boolean;
  certificate: {
    id: string;
    code: string;
    issuedAt: Date;
  } | null;
  reasons: string[];
  attemptsExhausted: boolean;
  unviewedTopicsCount: number;
  unpassedEvaluationsCount: number;
}

@Injectable()
export class CertificatesService {
  constructor(private prisma: PrismaService) {}

  async getStatus(courseId: string, student: AuthenticatedUser): Promise<CertificateStatus> {
    this.requireStudent(student);

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        topics: { select: { id: true } },
        evaluations: { select: { id: true, title: true } },
      },
    });
    if (!course) throw new NotFoundException('Curso no encontrado.');

    // HU18 CA7: Un Alumno no puede acceder al certificado de cursos de otra institución.
    if (course.institutionId !== student.institutionId) {
      throw new ForbiddenException('No podés acceder a certificados de cursos de otra institución.');
    }

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId: student.userId, courseId } },
      include: {
        certificate: true,
        topicProgress: { select: { topicId: true } },
      },
    });
    if (!enrollment) {
      throw new ForbiddenException('Necesitás estar inscripto en el curso para consultar el certificado.');
    }

    // HU18 CA6: Si ya fue emitido, se mantiene disponible con el mismo certificado.
    if (enrollment.certificate) {
      return {
        eligible: true,
        issued: true,
        certificate: {
          id: enrollment.certificate.id,
          code: enrollment.certificate.code,
          issuedAt: enrollment.certificate.issuedAt,
        },
        reasons: [],
        attemptsExhausted: false,
        unviewedTopicsCount: 0,
        unpassedEvaluationsCount: 0,
      };
    }

    return this.evaluateEligibility(course, enrollment, student.userId);
  }

  async download(courseId: string, student: AuthenticatedUser): Promise<{ buffer: Buffer; code: string }> {
    this.requireStudent(student);

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        institution: { select: { id: true, name: true } },
        professor: { select: { id: true, name: true } },
        topics: { select: { id: true } },
        evaluations: { select: { id: true } },
      },
    });
    if (!course) throw new NotFoundException('Curso no encontrado.');

    // HU18 CA7: Aislamiento multi-tenant
    if (course.institutionId !== student.institutionId) {
      throw new ForbiddenException('No podés acceder a certificados de cursos de otra institución.');
    }

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId: student.userId, courseId } },
      include: {
        certificate: true,
        topicProgress: { select: { topicId: true } },
      },
    });
    if (!enrollment) {
      throw new ForbiddenException('Necesitás estar inscripto en el curso para descargar el certificado.');
    }

    // HU18 CA6: Descargas posteriores entregan el mismo certificado ya emitido.
    if (enrollment.certificate) {
      const buffer = await generateCertificatePdf({
        studentName: enrollment.certificate.studentName,
        courseName: enrollment.certificate.courseName,
        institutionName: enrollment.certificate.institutionName,
        professorName: enrollment.certificate.professorName,
        issuedAt: enrollment.certificate.issuedAt,
        code: enrollment.certificate.code,
      });
      return { buffer, code: enrollment.certificate.code };
    }

    // Primera descarga: validar condiciones
    const status = await this.evaluateEligibility(course, enrollment, student.userId);
    if (!status.eligible) {
      if (status.attemptsExhausted) {
        throw new BadRequestException('Agotaste los intentos de una evaluación sin aprobarla; no podés obtener el certificado.');
      }
      if (course.topics.length === 0) {
        throw new BadRequestException('Un curso sin temas no se considera finalizado.');
      }
      if (status.unviewedTopicsCount > 0 && status.unpassedEvaluationsCount > 0) {
        throw new BadRequestException('Faltan temas por ver y evaluaciones por aprobar para obtener el certificado.');
      }
      if (status.unviewedTopicsCount > 0) {
        throw new BadRequestException('Debés ver todos los temas del curso para obtener el certificado.');
      }
      if (status.unpassedEvaluationsCount > 0) {
        throw new BadRequestException('Debés aprobar todas las evaluaciones del curso para obtener el certificado.');
      }
      throw new BadRequestException('No cumplís con las condiciones requeridas para obtener el certificado.');
    }

    const studentUser = await this.prisma.user.findUnique({
      where: { id: student.userId },
      select: { name: true },
    });
    if (!studentUser) throw new NotFoundException('Alumno no encontrado.');

    // HU18 CA6: Registrar la emisión del certificado
    const code = this.generateUniqueCode();
    const certificate = await this.prisma.certificate.create({
      data: {
        code,
        enrollmentId: enrollment.id,
        studentId: student.userId,
        courseId: course.id,
        studentName: studentUser.name,
        courseName: course.name,
        institutionName: course.institution.name,
        professorName: course.professor.name,
        issuedAt: new Date(),
      },
    });

    const buffer = await generateCertificatePdf({
      studentName: certificate.studentName,
      courseName: certificate.courseName,
      institutionName: certificate.institutionName,
      professorName: certificate.professorName,
      issuedAt: certificate.issuedAt,
      code: certificate.code,
    });

    return { buffer, code: certificate.code };
  }

  private async evaluateEligibility(
    course: { topics: { id: string }[]; evaluations: { id: string }[] },
    enrollment: { topicProgress: { topicId: string }[] },
    studentId: string,
  ): Promise<CertificateStatus> {
    const totalTopics = course.topics.length;
    const viewedTopicIds = new Set(enrollment.topicProgress.map((tp) => tp.topicId));
    const unviewedTopicsCount = course.topics.filter((t) => !viewedTopicIds.has(t.id)).length;

    let attemptsExhausted = false;
    let unpassedEvaluationsCount = 0;

    if (course.evaluations.length > 0) {
      const evaluationIds = course.evaluations.map((e) => e.id);
      const attempts = await this.prisma.evaluationAttempt.findMany({
        where: {
          evaluationId: { in: evaluationIds },
          studentId,
        },
        select: { evaluationId: true, passed: true },
      });

      for (const evaluation of course.evaluations) {
        const evalAttempts = attempts.filter((a) => a.evaluationId === evaluation.id);
        const passed = evalAttempts.some((a) => a.passed);
        if (!passed) {
          unpassedEvaluationsCount++;
          // HU12 / HU18 CA4: límite de 2 intentos
          if (evalAttempts.length >= 2) {
            attemptsExhausted = true;
          }
        }
      }
    }

    const reasons: string[] = [];
    if (attemptsExhausted) {
      reasons.push('Agotaste los intentos de una evaluación sin aprobarla; no podés obtener el certificado.');
    } else {
      // HU18 CA2: Un curso sin temas no se considera finalizado
      if (totalTopics === 0) {
        reasons.push('El curso no tiene temas cargados.');
      } else if (unviewedTopicsCount > 0 && unpassedEvaluationsCount > 0) {
        reasons.push('Faltan temas por ver y evaluaciones por aprobar.');
      } else if (unviewedTopicsCount > 0) {
        reasons.push('Faltan temas por ver.');
      } else if (unpassedEvaluationsCount > 0) {
        reasons.push('Faltan evaluaciones por aprobar.');
      }
    }

    const eligible = !attemptsExhausted && totalTopics > 0 && unviewedTopicsCount === 0 && unpassedEvaluationsCount === 0;

    return {
      eligible,
      issued: false,
      certificate: null,
      reasons,
      attemptsExhausted,
      unviewedTopicsCount,
      unpassedEvaluationsCount,
    };
  }

  private generateUniqueCode(): string {
    const randomHex = randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
    return `CERT-${randomHex}`;
  }

  private requireStudent(user: AuthenticatedUser) {
    if (user.role !== Role.STUDENT) {
      throw new ForbiddenException('Solo un Alumno inscripto puede acceder a certificados.');
    }
  }
}
