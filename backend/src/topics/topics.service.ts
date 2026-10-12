import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentEvent, Prisma, Role, Topic } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CreateTopicDto } from './dto/create-topic.dto';
import { UpdateTopicDto } from './dto/update-topic.dto';
import { AttachVideoDto } from './dto/attach-video.dto';
import { AttachScreenRecordingDto } from './dto/attach-screen-recording.dto';
import { AddMaterialDto } from './dto/add-material.dto';
import { UploadsService } from '../uploads/uploads.service';

@Injectable()
export class TopicsService {
  constructor(
    private prisma: PrismaService,
    private uploadsService: UploadsService,
  ) {}

  async createTopic(courseId: string, professor: AuthenticatedUser, dto: CreateTopicDto) {
    const course = await this.getOwnedCourseOrThrow(courseId, professor);
    return this.prisma.$transaction(async (transaction) => {
      const topic = await transaction.topic.create({ data: { ...dto, courseId } });
      await this.notifyStudents(transaction, topic, course.name, ContentEvent.NEW_CONTENT);
      return topic;
    });
  }

  async updateTopic(topicId: string, professor: AuthenticatedUser, dto: UpdateTopicDto) {
    const topic = await this.getOwnedTopicOrThrow(topicId, professor);
    const changed = (dto.title !== undefined && dto.title !== topic.title)
      || (dto.order !== undefined && dto.order !== topic.order)
      || (!!dto.contentText?.trim() && dto.contentText !== topic.contentText);
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.topic.update({
        where: { id: topic.id },
        data: {
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.order !== undefined ? { order: dto.order } : {}),
          ...(dto.contentText !== undefined ? { contentText: dto.contentText } : {}),
        },
      });
      if (changed) {
        const event = dto.contentText?.trim() && !topic.contentText?.trim()
          ? ContentEvent.NEW_CONTENT : ContentEvent.UPDATED_CONTENT;
        await this.notifyStudents(transaction, { ...topic, title: dto.title ?? topic.title }, topic.course.name, event);
      }
      return updated;
    });
  }

  // HU5 (carga de archivo): adjunta la URL del video subido como archivo.
  async attachVideo(topicId: string, professor: AuthenticatedUser, dto: AttachVideoDto) {
    const topic = await this.getOwnedTopicOrThrow(topicId, professor);
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.topic.update({
        where: { id: topic.id },
        data: { videoUrl: dto.videoUrl, videoDurationSeconds: dto.videoDurationSeconds },
      });
      if (topic.videoUrl !== dto.videoUrl || topic.videoDurationSeconds !== dto.videoDurationSeconds) {
        await this.notifyStudents(transaction, topic, topic.course.name,
          topic.videoUrl ? ContentEvent.UPDATED_CONTENT : ContentEvent.NEW_CONTENT);
      }
      return updated;
    });
  }

  // HU6 (grabación de pantalla): adjunta la URL del video grabado en la plataforma.
  async attachScreenRecording(topicId: string, professor: AuthenticatedUser, dto: AttachScreenRecordingDto) {
    const topic = await this.getOwnedTopicOrThrow(topicId, professor);
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.topic.update({
        where: { id: topic.id },
        data: { screenRecordingUrl: dto.screenRecordingUrl, videoDurationSeconds: dto.videoDurationSeconds },
      });
      if (topic.screenRecordingUrl !== dto.screenRecordingUrl || topic.videoDurationSeconds !== dto.videoDurationSeconds) {
        await this.notifyStudents(transaction, topic, topic.course.name,
          topic.screenRecordingUrl ? ContentEvent.UPDATED_CONTENT : ContentEvent.NEW_CONTENT);
      }
      return updated;
    });
  }

  // Elimina el video subido como archivo.
  async deleteVideo(topicId: string, professor: AuthenticatedUser) {
    const topic = await this.getOwnedTopicOrThrow(topicId, professor);
    return this.prisma.topic.update({
      where: { id: topic.id },
      data: { videoUrl: null, videoDurationSeconds: null },
    });
  }

  // Elimina el video de grabación de pantalla.
  async deleteScreenRecording(topicId: string, professor: AuthenticatedUser) {
    const topic = await this.getOwnedTopicOrThrow(topicId, professor);
    return this.prisma.topic.update({
      where: { id: topic.id },
      data: { screenRecordingUrl: null, videoDurationSeconds: null },
    });
  }

  // Elimina un material adjunto de un tema.
  async deleteMaterial(topicId: string, materialId: string, professor: AuthenticatedUser) {
    await this.getOwnedTopicOrThrow(topicId, professor);
    const material = await this.prisma.material.findUnique({ where: { id: materialId } });
    if (!material || material.topicId !== topicId) {
      throw new NotFoundException('Material no encontrado.');
    }
    return this.prisma.material.delete({ where: { id: materialId } });
  }

  // HU7: material teórico adicional (archivo adjunto).
  async addMaterial(topicId: string, professor: AuthenticatedUser, dto: AddMaterialDto) {
    const topic = await this.getOwnedTopicOrThrow(topicId, professor);
    return this.prisma.$transaction(async (transaction) => {
      const material = await transaction.material.create({ data: { ...dto, topicId: topic.id } });
      await this.notifyStudents(transaction, topic, topic.course.name, ContentEvent.NEW_CONTENT);
      return material;
    });
  }

  private async notifyStudents(
    transaction: Prisma.TransactionClient,
    topic: Pick<Topic, 'id' | 'courseId' | 'title'>,
    courseName: string,
    event: ContentEvent,
  ) {
    const enrollments = await transaction.enrollment.findMany({
      where: { courseId: topic.courseId, student: { role: Role.STUDENT } },
      select: { studentId: true },
    });
    if (!enrollments.length) return;
    await transaction.notification.createMany({
      data: enrollments.map(({ studentId }) => ({
        studentId, courseId: topic.courseId, topicId: topic.id,
        courseName, topicTitle: topic.title, event,
      })),
    });
  }

  // HU3/HU4: el contenido de un tema (video + material) solo es visible para
  // el Alumno inscripto en el curso, o para el Profesor dueño del curso.
  async getContent(topicId: string, user: AuthenticatedUser) {
    const topic = await this.prisma.topic.findUnique({
      where: { id: topicId },
      include: { materials: true, course: true },
    });
    if (!topic) throw new NotFoundException('Tema no encontrado.');

    if (user.role === Role.STUDENT) {
      const enrollment = await this.prisma.enrollment.findUnique({
        where: { studentId_courseId: { studentId: user.userId, courseId: topic.courseId } },
      });
      if (!enrollment) {
        throw new ForbiddenException('Necesitás estar inscripto en el curso para ver este contenido.');
      }
    } else if (user.role === Role.PROFESSOR && topic.course.professorId !== user.userId) {
      throw new ForbiddenException('No podés ver el contenido de un curso que no te pertenece.');
    }

    const urlToKey = (url: string) => url.replace(/^https?:\/\/[^/]+\//, '');

    const videoUrl = topic.videoUrl
      ? await this.uploadsService.generatePresignedGetUrl(urlToKey(topic.videoUrl))
      : topic.videoUrl;

    const screenRecordingUrl = topic.screenRecordingUrl
      ? await this.uploadsService.generatePresignedGetUrl(urlToKey(topic.screenRecordingUrl))
      : topic.screenRecordingUrl;

    const materials = await Promise.all(
      topic.materials.map(async (m) => ({
        ...m,
        fileUrl: m.fileUrl
          ? await this.uploadsService.generatePresignedGetUrl(urlToKey(m.fileUrl))
          : m.fileUrl,
      })),
    );

    return { ...topic, videoUrl, screenRecordingUrl, materials };
  }

  private async getOwnedCourseOrThrow(courseId: string, professor: AuthenticatedUser) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Curso no encontrado.');
    if (course.professorId !== professor.userId) {
      throw new ForbiddenException('No podés modificar un curso que no te pertenece.');
    }
    return course;
  }

  private async getOwnedTopicOrThrow(topicId: string, professor: AuthenticatedUser) {
    const topic = await this.prisma.topic.findUnique({ where: { id: topicId }, include: { course: true } });
    if (!topic) throw new NotFoundException('Tema no encontrado.');
    if (topic.course.professorId !== professor.userId) {
      throw new ForbiddenException('No podés modificar un curso que no te pertenece.');
    }
    return topic;
  }
}
