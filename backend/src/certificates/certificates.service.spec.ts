import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CertificatesService } from './certificates.service';
import { createMockPrismaService, MockPrismaService } from '../test-utils/mock-prisma';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';

describe('CertificatesService (HU-18: Certificado de finalización)', () => {
  let service: CertificatesService;
  let prisma: MockPrismaService;

  const student: AuthenticatedUser = {
    userId: 'student-1',
    email: 'alumno@uade.edu.ar',
    role: Role.STUDENT,
    institutionId: 'inst-1',
  };

  const studentUser = {
    id: 'student-1',
    name: 'Juan Pérez',
    email: 'alumno@uade.edu.ar',
  };

  const baseCourse = {
    id: 'course-1',
    name: 'TypeScript Avanzado',
    institutionId: 'inst-1',
    isPublished: true,
    institution: { id: 'inst-1', name: 'Universidad Argentina de la Empresa' },
    professor: { id: 'prof-1', name: 'Dra. María González' },
    topics: [{ id: 'topic-1' }, { id: 'topic-2' }],
    evaluations: [{ id: 'eval-1', title: 'Examen Final' }],
  };

  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new CertificatesService(prisma as any);
  });

  describe('CA1 & CA2: Habilitación según temas y evaluaciones', () => {
    it('CA2: Un curso sin temas no se considera finalizado y no habilita el certificado', async () => {
      prisma.course.findUnique.mockResolvedValue({
        ...baseCourse,
        topics: [],
        evaluations: [],
      });
      prisma.enrollment.findUnique.mockResolvedValue({
        id: 'enr-1',
        certificate: null,
        topicProgress: [],
      });

      const status = await service.getStatus('course-1', student);
      expect(status.eligible).toBe(false);
      expect(status.reasons).toContain('El curso no tiene temas cargados.');

      await expect(service.download('course-1', student)).rejects.toThrow(BadRequestException);
    });

    it('CA1: Curso sin evaluaciones se habilita con 100% de avance (todos los temas vistos)', async () => {
      prisma.course.findUnique.mockResolvedValue({
        ...baseCourse,
        topics: [{ id: 'topic-1' }, { id: 'topic-2' }],
        evaluations: [],
      });
      prisma.enrollment.findUnique.mockResolvedValue({
        id: 'enr-1',
        certificate: null,
        topicProgress: [{ topicId: 'topic-1' }, { topicId: 'topic-2' }],
      });

      const status = await service.getStatus('course-1', student);
      expect(status.eligible).toBe(true);
      expect(status.reasons).toEqual([]);
    });

    it('CA1: Curso con evaluaciones requiere 100% de avance y todas las evaluaciones aprobadas', async () => {
      prisma.course.findUnique.mockResolvedValue(baseCourse);
      prisma.enrollment.findUnique.mockResolvedValue({
        id: 'enr-1',
        certificate: null,
        topicProgress: [{ topicId: 'topic-1' }, { topicId: 'topic-2' }],
      });
      prisma.evaluationAttempt.findMany.mockResolvedValue([
        { evaluationId: 'eval-1', passed: true },
      ]);

      const status = await service.getStatus('course-1', student);
      expect(status.eligible).toBe(true);
      expect(status.reasons).toEqual([]);
    });

    it('CA3: Informa qué falta cuando hay temas pendientes y evaluaciones sin aprobar', async () => {
      prisma.course.findUnique.mockResolvedValue(baseCourse);
      prisma.enrollment.findUnique.mockResolvedValue({
        id: 'enr-1',
        certificate: null,
        topicProgress: [{ topicId: 'topic-1' }], // falta topic-2
      });
      prisma.evaluationAttempt.findMany.mockResolvedValue([]); // falta eval-1

      const status = await service.getStatus('course-1', student);
      expect(status.eligible).toBe(false);
      expect(status.reasons).toContain('Faltan temas por ver y evaluaciones por aprobar.');
      expect(status.unviewedTopicsCount).toBe(1);
      expect(status.unpassedEvaluationsCount).toBe(1);

      await expect(service.download('course-1', student)).rejects.toThrow(BadRequestException);
    });

    it('CA3: Informa qué falta cuando solo restan temas por ver', async () => {
      prisma.course.findUnique.mockResolvedValue(baseCourse);
      prisma.enrollment.findUnique.mockResolvedValue({
        id: 'enr-1',
        certificate: null,
        topicProgress: [{ topicId: 'topic-1' }],
      });
      prisma.evaluationAttempt.findMany.mockResolvedValue([
        { evaluationId: 'eval-1', passed: true },
      ]);

      const status = await service.getStatus('course-1', student);
      expect(status.eligible).toBe(false);
      expect(status.reasons).toContain('Faltan temas por ver.');

      await expect(service.download('course-1', student)).rejects.toThrow(
        'Debés ver todos los temas del curso para obtener el certificado.',
      );
    });

    it('CA3: Informa qué falta cuando solo restan evaluaciones por aprobar', async () => {
      prisma.course.findUnique.mockResolvedValue(baseCourse);
      prisma.enrollment.findUnique.mockResolvedValue({
        id: 'enr-1',
        certificate: null,
        topicProgress: [{ topicId: 'topic-1' }, { topicId: 'topic-2' }],
      });
      prisma.evaluationAttempt.findMany.mockResolvedValue([]);

      const status = await service.getStatus('course-1', student);
      expect(status.eligible).toBe(false);
      expect(status.reasons).toContain('Faltan evaluaciones por aprobar.');

      await expect(service.download('course-1', student)).rejects.toThrow(
        'Debés aprobar todas las evaluaciones del curso para obtener el certificado.',
      );
    });
  });

  describe('CA4: Agotamiento de intentos en evaluaciones', () => {
    it('Si agotó los 2 intentos sin aprobar, no puede obtener el certificado y se lo informa', async () => {
      prisma.course.findUnique.mockResolvedValue(baseCourse);
      prisma.enrollment.findUnique.mockResolvedValue({
        id: 'enr-1',
        certificate: null,
        topicProgress: [{ topicId: 'topic-1' }, { topicId: 'topic-2' }],
      });
      prisma.evaluationAttempt.findMany.mockResolvedValue([
        { evaluationId: 'eval-1', passed: false },
        { evaluationId: 'eval-1', passed: false },
      ]);

      const status = await service.getStatus('course-1', student);
      expect(status.eligible).toBe(false);
      expect(status.attemptsExhausted).toBe(true);
      expect(status.reasons).toContain(
        'Agotaste los intentos de una evaluación sin aprobarla; no podés obtener el certificado.',
      );

      await expect(service.download('course-1', student)).rejects.toThrow(
        'Agotaste los intentos de una evaluación sin aprobarla; no podés obtener el certificado.',
      );
    });
  });

  describe('CA5 & CA6: Emisión del certificado, código único y descargas posteriores', () => {
    it('La primera descarga registra la emisión y genera el PDF con los datos requeridos', async () => {
      prisma.course.findUnique.mockResolvedValue(baseCourse);
      prisma.enrollment.findUnique.mockResolvedValue({
        id: 'enr-1',
        certificate: null,
        topicProgress: [{ topicId: 'topic-1' }, { topicId: 'topic-2' }],
      });
      prisma.evaluationAttempt.findMany.mockResolvedValue([
        { evaluationId: 'eval-1', passed: true },
      ]);
      prisma.user.findUnique.mockResolvedValue(studentUser);

      const fakeCert = {
        id: 'cert-1',
        code: 'CERT-ABC123XYZ',
        enrollmentId: 'enr-1',
        studentId: student.userId,
        courseId: 'course-1',
        studentName: 'Juan Pérez',
        courseName: 'TypeScript Avanzado',
        institutionName: 'Universidad Argentina de la Empresa',
        professorName: 'Dra. María González',
        issuedAt: new Date('2026-10-12T10:00:00Z'),
      };
      prisma.certificate.create.mockResolvedValue(fakeCert);

      const result = await service.download('course-1', student);

      expect(prisma.certificate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            enrollmentId: 'enr-1',
            studentId: student.userId,
            courseId: 'course-1',
            studentName: 'Juan Pérez',
            courseName: 'TypeScript Avanzado',
            institutionName: 'Universidad Argentina de la Empresa',
            professorName: 'Dra. María González',
          }),
        }),
      );
      expect(result.code).toBe('CERT-ABC123XYZ');
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
      expect(result.buffer.length).toBeGreaterThan(0);
    });

    it('CA6: Las descargas posteriores entregan el mismo certificado aunque luego se agreguen temas', async () => {
      const existingCert = {
        id: 'cert-1',
        code: 'CERT-PREV-999',
        enrollmentId: 'enr-1',
        studentId: student.userId,
        courseId: 'course-1',
        studentName: 'Juan Pérez',
        courseName: 'TypeScript Avanzado',
        institutionName: 'Universidad Argentina de la Empresa',
        professorName: 'Dra. María González',
        issuedAt: new Date('2026-09-01T12:00:00Z'),
      };

      // Curso tiene un nuevo tema que el alumno no vio
      prisma.course.findUnique.mockResolvedValue({
        ...baseCourse,
        topics: [{ id: 'topic-1' }, { id: 'topic-2' }, { id: 'topic-nuevo' }],
      });
      prisma.enrollment.findUnique.mockResolvedValue({
        id: 'enr-1',
        certificate: existingCert,
        topicProgress: [{ topicId: 'topic-1' }, { topicId: 'topic-2' }],
      });

      // Status informa que ya está emitido
      const status = await service.getStatus('course-1', student);
      expect(status.issued).toBe(true);
      expect(status.eligible).toBe(true);
      expect(status.certificate?.code).toBe('CERT-PREV-999');

      // Descarga entrega el mismo certificado previo
      const downloadResult = await service.download('course-1', student);
      expect(downloadResult.code).toBe('CERT-PREV-999');
      expect(prisma.certificate.create).not.toHaveBeenCalled();
    });
  });

  describe('CA7 & CA8: Permisos, titularidad, multi-tenant y cursos despublicados', () => {
    it('CA7: Rechaza si el Alumno no está inscripto en el curso', async () => {
      prisma.course.findUnique.mockResolvedValue(baseCourse);
      prisma.enrollment.findUnique.mockResolvedValue(null);

      await expect(service.getStatus('course-1', student)).rejects.toThrow(ForbiddenException);
      await expect(service.download('course-1', student)).rejects.toThrow(ForbiddenException);
    });

    it('CA7: Rechaza si el curso pertenece a otra institución', async () => {
      prisma.course.findUnique.mockResolvedValue({
        ...baseCourse,
        institutionId: 'otra-institucion',
      });

      await expect(service.getStatus('course-1', student)).rejects.toThrow(ForbiddenException);
      await expect(service.download('course-1', student)).rejects.toThrow(ForbiddenException);
    });

    it('CA7: Rechaza a usuarios con rol distinto de STUDENT', async () => {
      const professorUser: AuthenticatedUser = {
        userId: 'prof-1',
        email: 'p@uade.edu.ar',
        role: Role.PROFESSOR,
        institutionId: 'inst-1',
      };

      await expect(service.getStatus('course-1', professorUser)).rejects.toThrow(ForbiddenException);
      await expect(service.download('course-1', professorUser)).rejects.toThrow(ForbiddenException);
    });

    it('CA8: Alumno inscripto en un curso despublicado puede obtener y descargar su certificado si cumple condiciones', async () => {
      prisma.course.findUnique.mockResolvedValue({
        ...baseCourse,
        isPublished: false, // Curso despublicado (HU-8)
      });
      prisma.enrollment.findUnique.mockResolvedValue({
        id: 'enr-1',
        certificate: null,
        topicProgress: [{ topicId: 'topic-1' }, { topicId: 'topic-2' }],
      });
      prisma.evaluationAttempt.findMany.mockResolvedValue([
        { evaluationId: 'eval-1', passed: true },
      ]);
      prisma.user.findUnique.mockResolvedValue(studentUser);
      prisma.certificate.create.mockResolvedValue({
        id: 'cert-1',
        code: 'CERT-UNPUB-123',
        enrollmentId: 'enr-1',
        studentId: student.userId,
        courseId: 'course-1',
        studentName: 'Juan Pérez',
        courseName: 'TypeScript Avanzado',
        institutionName: 'Universidad Argentina de la Empresa',
        professorName: 'Dra. María González',
        issuedAt: new Date(),
      });

      const status = await service.getStatus('course-1', student);
      expect(status.eligible).toBe(true);

      const download = await service.download('course-1', student);
      expect(download.code).toBe('CERT-UNPUB-123');
    });
  });
});
