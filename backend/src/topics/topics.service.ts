import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CreateTopicDto } from './dto/create-topic.dto';
import { AttachVideoDto } from './dto/attach-video.dto';
import { AddMaterialDto } from './dto/add-material.dto';

@Injectable()
export class TopicsService {
  constructor(private prisma: PrismaService) {}

  async createTopic(courseId: string, professor: AuthenticatedUser, dto: CreateTopicDto) {
    await this.getOwnedCourseOrThrow(courseId, professor);
    return this.prisma.topic.create({ data: { ...dto, courseId } });
  }

  // HU5 (carga de archivo) y HU6 (grabación) confluyen acá: ambas terminan
  // adjuntando una URL de video ya subida/transcodificada al tema.
  async attachVideo(topicId: string, professor: AuthenticatedUser, dto: AttachVideoDto) {
    const topic = await this.getOwnedTopicOrThrow(topicId, professor);
    return this.prisma.topic.update({
      where: { id: topic.id },
      data: { videoUrl: dto.videoUrl, videoDurationSeconds: dto.videoDurationSeconds },
    });
  }

  // HU7: material teórico adicional (archivo adjunto).
  async addMaterial(topicId: string, professor: AuthenticatedUser, dto: AddMaterialDto) {
    const topic = await this.getOwnedTopicOrThrow(topicId, professor);
    return this.prisma.material.create({ data: { ...dto, topicId: topic.id } });
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

    return topic;
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
