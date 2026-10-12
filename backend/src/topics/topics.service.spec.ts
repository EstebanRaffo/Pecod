import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ContentEvent, Role } from '@prisma/client';
import { TopicsService } from './topics.service';
import { createMockPrismaService, MockPrismaService } from '../test-utils/mock-prisma';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';

const mockUploadsService = {
  generatePresignedGetUrl: jest.fn((key: string) => Promise.resolve(`https://signed/${key}`)),
};

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
    mockUploadsService.generatePresignedGetUrl.mockClear();
    service = new TopicsService(prisma as any, mockUploadsService as any);
  });

  describe('HU17: notificaciones del temario', () => {
    const topic = {
      id: 'topic-1', courseId: 'course-1', title: 'Introduccion', order: 1,
      contentText: 'Texto anterior', videoUrl: null, screenRecordingUrl: null,
      videoDurationSeconds: null, course: { professorId: 'prof-1', name: 'Programacion' },
    };

    beforeEach(() => {
      prisma.topic.findUnique.mockResolvedValue(topic);
      prisma.topic.update.mockResolvedValue(topic);
      prisma.enrollment.findMany.mockResolvedValue([{ studentId: 'student-1' }, { studentId: 'student-2' }]);
    });

    it('crea una notificacion por inscripto al crear un tema', async () => {
      prisma.course.findUnique.mockResolvedValue(topic.course);
      prisma.topic.create.mockResolvedValue(topic);
      await service.createTopic('course-1', professor, { title: topic.title, order: 1 });
      expect(prisma.enrollment.findMany).toHaveBeenCalledWith({
        where: { courseId: 'course-1', student: { role: Role.STUDENT } }, select: { studentId: true },
      });
      expect(prisma.notification.createMany).toHaveBeenCalledWith({ data: [
        { studentId: 'student-1', courseId: 'course-1', topicId: 'topic-1', courseName: 'Programacion', topicTitle: topic.title, event: ContentEvent.NEW_CONTENT },
        { studentId: 'student-2', courseId: 'course-1', topicId: 'topic-1', courseName: 'Programacion', topicTitle: topic.title, event: ContentEvent.NEW_CONTENT },
      ] });
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('notifica la actualizacion del texto con el nombre actualizado del tema', async () => {
      await service.updateTopic('topic-1', professor, { title: 'Nuevo titulo', contentText: 'Texto nuevo' });
      expect(prisma.notification.createMany).toHaveBeenCalledWith({ data: expect.arrayContaining([
        expect.objectContaining({ topicTitle: 'Nuevo titulo', event: ContentEvent.UPDATED_CONTENT }),
      ]) });
    });

    it('el primer texto es contenido nuevo', async () => {
      prisma.topic.findUnique.mockResolvedValue({ ...topic, contentText: null });
      await service.updateTopic('topic-1', professor, { contentText: 'Primer texto' });
      expect(prisma.notification.createMany).toHaveBeenCalledWith({ data: expect.arrayContaining([
        expect.objectContaining({ event: ContentEvent.NEW_CONTENT }),
      ]) });
    });

    it.each(['', '   ', 'Texto anterior', null])('no notifica texto eliminado o sin cambios: %p', async (contentText) => {
      await service.updateTopic('topic-1', professor, { contentText });
      expect(prisma.notification.createMany).not.toHaveBeenCalled();
    });

    it.each([false, true])('clasifica video nuevo o reemplazado (existente: %p)', async (existing) => {
      prisma.topic.findUnique.mockResolvedValue({ ...topic, videoUrl: existing ? 'old.mp4' : null });
      await service.attachVideo('topic-1', professor, { videoUrl: 'new.mp4', videoDurationSeconds: 60 });
      expect(prisma.notification.createMany).toHaveBeenCalledWith({ data: expect.arrayContaining([
        expect.objectContaining({ event: existing ? ContentEvent.UPDATED_CONTENT : ContentEvent.NEW_CONTENT }),
      ]) });
    });

    it.each([false, true])('clasifica grabacion nueva o reemplazada (existente: %p)', async (existing) => {
      prisma.topic.findUnique.mockResolvedValue({ ...topic, screenRecordingUrl: existing ? 'old.webm' : null });
      await service.attachScreenRecording('topic-1', professor, { screenRecordingUrl: 'new.webm', videoDurationSeconds: 60 });
      expect(prisma.notification.createMany).toHaveBeenCalledWith({ data: expect.arrayContaining([
        expect.objectContaining({ event: existing ? ContentEvent.UPDATED_CONTENT : ContentEvent.NEW_CONTENT }),
      ]) });
    });

    it('notifica el material adjunto nuevo', async () => {
      await service.addMaterial('topic-1', professor, { fileName: 'apunte.pdf', fileUrl: 'apunte.pdf', fileType: 'pdf', sizeBytes: 1024 });
      expect(prisma.notification.createMany).toHaveBeenCalledWith({ data: expect.arrayContaining([
        expect.objectContaining({ event: ContentEvent.NEW_CONTENT }),
      ]) });
    });

    it('no notifica eliminaciones de video, grabacion o material', async () => {
      prisma.material.findUnique.mockResolvedValue({ id: 'mat-1', topicId: topic.id });
      await service.deleteVideo(topic.id, professor);
      await service.deleteScreenRecording(topic.id, professor);
      await service.deleteMaterial(topic.id, 'mat-1', professor);
      expect(prisma.notification.createMany).not.toHaveBeenCalled();
    });

    it('no crea avisos cuando no hay inscriptos', async () => {
      prisma.enrollment.findMany.mockResolvedValue([]);
      await service.updateTopic(topic.id, professor, { title: 'Otro titulo' });
      expect(prisma.notification.createMany).not.toHaveBeenCalled();
    });

    it('no genera avisos si falla la modificacion', async () => {
      prisma.topic.update.mockRejectedValue(new Error('Error de escritura'));
      await expect(service.updateTopic(topic.id, professor, { title: 'Otro titulo' })).rejects.toThrow('Error de escritura');
      expect(prisma.notification.createMany).not.toHaveBeenCalled();
    });
  });

  describe('getContent (HU3/HU4: contenido gateado por inscripción)', () => {
    it('CA: un Alumno no inscripto no puede ver el contenido del tema', async () => {
      prisma.topic.findUnique.mockResolvedValue({
        id: 'topic-1',
        courseId: 'course-1',
        videoUrl: null,
        screenRecordingUrl: null,
        materials: [],
        course: { professorId: 'prof-1' },
      });
      prisma.enrollment.findUnique.mockResolvedValue(null);

      await expect(service.getContent('topic-1', student)).rejects.toThrow(ForbiddenException);
    });

    it('CA: un Alumno inscripto sí puede ver el contenido del tema', async () => {
      prisma.topic.findUnique.mockResolvedValue({
        id: 'topic-1',
        courseId: 'course-1',
        videoUrl: null,
        screenRecordingUrl: null,
        materials: [],
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

  describe('deleteVideo (HU5)', () => {
    it('CA: un Profesor de otro curso no puede eliminar el video', async () => {
      prisma.topic.findUnique.mockResolvedValue({
        id: 'topic-1',
        course: { professorId: 'otro-profesor' },
      });

      await expect(service.deleteVideo('topic-1', professor)).rejects.toThrow(ForbiddenException);
    });

    it('CA: el Profesor dueño puede eliminar el video — videoUrl y videoDurationSeconds quedan en null', async () => {
      prisma.topic.findUnique.mockResolvedValue({ id: 'topic-1', course: { professorId: 'prof-1' } });
      prisma.topic.update.mockResolvedValue({ id: 'topic-1', videoUrl: null, videoDurationSeconds: null });

      const result = await service.deleteVideo('topic-1', professor);

      expect(prisma.topic.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { videoUrl: null, videoDurationSeconds: null } }),
      );
      expect(result.videoUrl).toBeNull();
      expect(result.videoDurationSeconds).toBeNull();
    });
  });

  describe('attachScreenRecording (HU6)', () => {
    it('CA: un Profesor de otro curso no puede adjuntar una grabación de pantalla', async () => {
      prisma.topic.findUnique.mockResolvedValue({
        id: 'topic-1',
        course: { professorId: 'otro-profesor' },
      });

      await expect(
        service.attachScreenRecording('topic-1', professor, {
          screenRecordingUrl: 'https://s3/grabacion.webm',
          videoDurationSeconds: 300,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('CA: el Profesor dueño puede adjuntar una grabación de pantalla', async () => {
      prisma.topic.findUnique.mockResolvedValue({ id: 'topic-1', course: { professorId: 'prof-1' } });
      prisma.topic.update.mockResolvedValue({
        id: 'topic-1',
        screenRecordingUrl: 'https://s3/grabacion.webm',
        videoDurationSeconds: 300,
      });

      const result = await service.attachScreenRecording('topic-1', professor, {
        screenRecordingUrl: 'https://s3/grabacion.webm',
        videoDurationSeconds: 300,
      });

      expect(result.screenRecordingUrl).toBe('https://s3/grabacion.webm');
    });
  });

  describe('deleteScreenRecording (HU6)', () => {
    it('CA: un Profesor de otro curso no puede eliminar la grabación de pantalla', async () => {
      prisma.topic.findUnique.mockResolvedValue({
        id: 'topic-1',
        course: { professorId: 'otro-profesor' },
      });

      await expect(service.deleteScreenRecording('topic-1', professor)).rejects.toThrow(ForbiddenException);
    });

    it('CA: el Profesor dueño puede eliminar la grabación — screenRecordingUrl y videoDurationSeconds quedan en null', async () => {
      prisma.topic.findUnique.mockResolvedValue({ id: 'topic-1', course: { professorId: 'prof-1' } });
      prisma.topic.update.mockResolvedValue({
        id: 'topic-1',
        screenRecordingUrl: null,
        videoDurationSeconds: null,
      });

      const result = await service.deleteScreenRecording('topic-1', professor);

      expect(prisma.topic.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { screenRecordingUrl: null, videoDurationSeconds: null } }),
      );
      expect(result.screenRecordingUrl).toBeNull();
      expect(result.videoDurationSeconds).toBeNull();
    });
  });

  describe('updateTopic — contentText (Material de Lectura)', () => {
    it('CA: el Profesor dueño puede guardar texto en contentText', async () => {
      prisma.topic.findUnique.mockResolvedValue({ id: 'topic-1', course: { professorId: 'prof-1' } });
      prisma.topic.update.mockResolvedValue({ id: 'topic-1', contentText: 'texto de lectura' });

      const result = await service.updateTopic('topic-1', professor, { contentText: 'texto de lectura' });

      expect(prisma.topic.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ contentText: 'texto de lectura' }) }),
      );
      expect(result.contentText).toBe('texto de lectura');
    });

    it('CA: un Profesor de otro curso no puede guardar contentText', async () => {
      prisma.topic.findUnique.mockResolvedValue({
        id: 'topic-1',
        course: { professorId: 'otro-profesor' },
      });

      await expect(
        service.updateTopic('topic-1', professor, { contentText: 'texto' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('CA: guardar contentText vacío es aceptado', async () => {
      prisma.topic.findUnique.mockResolvedValue({ id: 'topic-1', course: { professorId: 'prof-1' } });
      prisma.topic.update.mockResolvedValue({ id: 'topic-1', contentText: '' });

      await service.updateTopic('topic-1', professor, { contentText: '' });

      expect(prisma.topic.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ contentText: '' }) }),
      );
    });
  });

  describe('deleteMaterial (HU7)', () => {
    it('CA: un Profesor de otro curso no puede eliminar un material', async () => {
      prisma.topic.findUnique.mockResolvedValue({
        id: 'topic-1',
        course: { professorId: 'otro-profesor' },
      });

      await expect(service.deleteMaterial('topic-1', 'mat-1', professor)).rejects.toThrow(ForbiddenException);
    });

    it('CA: un material que no pertenece al tema lanza NotFoundException', async () => {
      prisma.topic.findUnique.mockResolvedValue({ id: 'topic-1', course: { professorId: 'prof-1' } });
      // material pertenece a otro topic
      prisma.material.findUnique.mockResolvedValue({ id: 'mat-1', topicId: 'otro-topic' });

      await expect(service.deleteMaterial('topic-1', 'mat-1', professor)).rejects.toThrow(NotFoundException);
    });

    it('CA: un material inexistente lanza NotFoundException', async () => {
      prisma.topic.findUnique.mockResolvedValue({ id: 'topic-1', course: { professorId: 'prof-1' } });
      prisma.material.findUnique.mockResolvedValue(null);

      await expect(service.deleteMaterial('topic-1', 'mat-1', professor)).rejects.toThrow(NotFoundException);
    });

    it('CA: el Profesor dueño puede eliminar un material del tema', async () => {
      prisma.topic.findUnique.mockResolvedValue({ id: 'topic-1', course: { professorId: 'prof-1' } });
      prisma.material.findUnique.mockResolvedValue({ id: 'mat-1', topicId: 'topic-1' });
      prisma.material.delete.mockResolvedValue({ id: 'mat-1' });

      const result = await service.deleteMaterial('topic-1', 'mat-1', professor);

      expect(prisma.material.delete).toHaveBeenCalledWith({ where: { id: 'mat-1' } });
      expect(result.id).toBe('mat-1');
    });
  });
});
