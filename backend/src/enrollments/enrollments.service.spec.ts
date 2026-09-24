import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
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
    prisma.enrollment.findMany.mockResolvedValue([{ id: 'enr-1', course: { id: 'course-1' } }]);

    const result = await service.myCourses(student);

    expect(prisma.enrollment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { studentId: 'student-1' } }),
    );
    expect(result).toHaveLength(1);
  });
});
