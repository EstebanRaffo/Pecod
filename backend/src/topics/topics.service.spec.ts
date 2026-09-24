import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { TopicsService } from './topics.service';
import { createMockPrismaService, MockPrismaService } from '../test-utils/mock-prisma';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';

describe('TopicsService', () => {
  let service: TopicsService;
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
    service = new TopicsService(prisma as any);
  });

  describe('getContent (HU3/HU4: contenido gateado por inscripción)', () => {
    it('CA: un Alumno no inscripto no puede ver el contenido del tema', async () => {
      prisma.topic.findUnique.mockResolvedValue({
        id: 'topic-1',
        courseId: 'course-1',
        course: { professorId: 'prof-1' },
      });
      prisma.enrollment.findUnique.mockResolvedValue(null);

      await expect(service.getContent('topic-1', student)).rejects.toThrow(ForbiddenException);
    });

    it('CA: un Alumno inscripto sí puede ver el contenido del tema', async () => {
      prisma.topic.findUnique.mockResolvedValue({
        id: 'topic-1',
        courseId: 'course-1',
        course: { professorId: 'prof-1' },
      });
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' });

      const result = await service.getContent('topic-1', student);
      expect(result.id).toBe('topic-1');
    });

    it('CA: un Profesor no puede ver contenido de un curso que no le pertenece', async () => {
      prisma.topic.findUnique.mockResolvedValue({
        id: 'topic-1',
        courseId: 'course-1',
        course: { professorId: 'otro-profesor' },
      });

      await expect(service.getContent('topic-1', professor)).rejects.toThrow(ForbiddenException);
    });

    it('tema inexistente lanza NotFoundException', async () => {
      prisma.topic.findUnique.mockResolvedValue(null);
      await expect(service.getContent('no-existe', student)).rejects.toThrow(NotFoundException);
    });
  });

  describe('attachVideo (HU5/HU6)', () => {
    it('CA: solo el Profesor dueño del curso puede adjuntar el video', async () => {
      prisma.topic.findUnique.mockResolvedValue({
        id: 'topic-1',
        course: { professorId: 'otro-profesor' },
      });

      await expect(
        service.attachVideo('topic-1', professor, {
          videoUrl: 'https://s3/video.mp4',
          videoDurationSeconds: 600,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('CA: adjunta correctamente video y duración dentro del límite', async () => {
      prisma.topic.findUnique.mockResolvedValue({ id: 'topic-1', course: { professorId: 'prof-1' } });
      prisma.topic.update.mockResolvedValue({
        id: 'topic-1',
        videoUrl: 'https://s3/video.mp4',
        videoDurationSeconds: 600,
      });

      const result = await service.attachVideo('topic-1', professor, {
        videoUrl: 'https://s3/video.mp4',
        videoDurationSeconds: 600,
      });

      expect(result.videoDurationSeconds).toBe(600);
    });
  });

  describe('addMaterial (HU7)', () => {
    it('CA: agrega material adjunto al tema del curso propio', async () => {
      prisma.topic.findUnique.mockResolvedValue({ id: 'topic-1', course: { professorId: 'prof-1' } });
      prisma.material.create.mockResolvedValue({ id: 'mat-1', fileName: 'apunte.pdf' });

      const result = await service.addMaterial('topic-1', professor, {
        fileName: 'apunte.pdf',
        fileUrl: 'https://s3/apunte.pdf',
        fileType: 'pdf',
        sizeBytes: 1024,
      });

      expect(result.fileName).toBe('apunte.pdf');
    });
  });
});
