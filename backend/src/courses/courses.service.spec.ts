import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CoursesService } from './courses.service';
import { createMockPrismaService, MockPrismaService } from '../test-utils/mock-prisma';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';

describe('CoursesService', () => {
  let service: CoursesService;
  let prisma: MockPrismaService;

  const student: AuthenticatedUser = {
    userId: 'student-1',
    email: 's@uade.edu.ar',
    role: Role.STUDENT,
    institutionId: 'inst-1',
  };
  const admin: AuthenticatedUser = {
    userId: 'admin-1',
    email: 'admin@pecod.com',
    role: Role.ADMIN,
    institutionId: null,
  };
  const professor: AuthenticatedUser = {
    userId: 'prof-1',
    email: 'p@uade.edu.ar',
    role: Role.PROFESSOR,
    institutionId: 'inst-1',
  };

  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new CoursesService(prisma as any);
  });

  describe('catalog (HU1)', () => {
    it('CA: el catálogo muestra únicamente cursos publicados', async () => {
      prisma.course.findMany.mockResolvedValue([]);
      await service.catalog(student, {});
      expect(prisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ isPublished: true }) }),
      );
    });

    it('CA: un Alumno solo ve cursos de su propia institución (aislamiento multi-tenant)', async () => {
      prisma.course.findMany.mockResolvedValue([]);
      await service.catalog(student, {});
      expect(prisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ institutionId: 'inst-1' }) }),
      );
    });

    it('CA: el Administrador de Sistema ve cursos de todas las instituciones (alcance global)', async () => {
      prisma.course.findMany.mockResolvedValue([]);
      await service.catalog(admin, {});
      const callArg = prisma.course.findMany.mock.calls[0][0];
      expect(callArg.where.institutionId).toBeUndefined();
    });

    it('CA: los filtros de categoría y tecnología se combinan (AND)', async () => {
      prisma.course.findMany.mockResolvedValue([]);
      await service.catalog(student, { category: 'Frontend', technology: 'React' });
      const callArg = prisma.course.findMany.mock.calls[0][0];
      expect(callArg.where.category).toEqual({ equals: 'Frontend', mode: 'insensitive' });
      expect(callArg.where.tools).toEqual({ contains: 'React', mode: 'insensitive' });
    });
  });

  describe('findDetail (HU4)', () => {
    it('CA: un curso inexistente lanza NotFoundException', async () => {
      prisma.course.findUnique.mockResolvedValue(null);
      await expect(service.findDetail('no-existe', student)).rejects.toThrow(NotFoundException);
    });

    it('CA: indica isEnrolled=true si el Alumno ya está inscripto', async () => {
      prisma.course.findUnique.mockResolvedValue({ id: 'course-1', topics: [] });
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' });

      const result = await service.findDetail('course-1', student);
      expect(result.isEnrolled).toBe(true);
    });

    it('CA: indica isEnrolled=false si el Alumno no está inscripto', async () => {
      prisma.course.findUnique.mockResolvedValue({ id: 'course-1', topics: [] });
      prisma.enrollment.findUnique.mockResolvedValue(null);

      const result = await service.findDetail('course-1', student);
      expect(result.isEnrolled).toBe(false);
    });
  });

  describe('create (HU5)', () => {
    it('CA: el curso se crea sin publicar (isPublished=false) hasta que el Profesor lo publique', async () => {
      prisma.course.create.mockResolvedValue({ id: 'course-1' });

      await service.create(professor, {
        name: 'Testing 101',
        description: 'Intro',
        category: 'QA',
      });

      expect(prisma.course.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isPublished: false, professorId: 'prof-1' }),
        }),
      );
    });
  });

  describe('update / publish (HU8)', () => {
    it('CA: un Profesor no puede editar un curso que no le pertenece', async () => {
      prisma.course.findUnique.mockResolvedValue({ id: 'course-1', professorId: 'otro-profesor' });

      await expect(service.update('course-1', professor, { name: 'Nuevo nombre' })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('CA: el dueño del curso sí puede editarlo', async () => {
      prisma.course.findUnique.mockResolvedValue({ id: 'course-1', professorId: 'prof-1' });
      prisma.course.update.mockResolvedValue({ id: 'course-1', name: 'Nuevo nombre' });

      const result = await service.update('course-1', professor, { name: 'Nuevo nombre' });
      expect(result.name).toBe('Nuevo nombre');
    });

    it('CA: se puede despublicar un curso con alumnos inscriptos (no lo bloquea)', async () => {
      prisma.course.findUnique.mockResolvedValue({ id: 'course-1', professorId: 'prof-1' });
      prisma.course.update.mockResolvedValue({ id: 'course-1', isPublished: false });

      const result = await service.setPublished('course-1', professor, false);
      expect(result.isPublished).toBe(false);
    });
  });
});
