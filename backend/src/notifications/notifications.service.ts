import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { RecommendationsService } from '../recommendations/recommendations.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private recommendationsService: RecommendationsService,
  ) {}

  private visibleTo(studentId: string) {
    return { studentId, course: { enrollments: { some: { studentId } } } };
  }

  list(studentId: string) {
    return this.prisma.notification.findMany({
      where: this.visibleTo(studentId),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  async markRead(id: string, studentId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, ...this.visibleTo(studentId) },
    });
    if (!notification) throw new NotFoundException('Notificacion no encontrada.');
    if (notification.readAt) return notification;
    return this.prisma.notification.update({
      where: { id, ...this.visibleTo(studentId) },
      data: { readAt: new Date() },
    });
  }

  // HU24: Tarea programada semanal (lunes 09:00 UTC)
  @Cron('0 9 * * 1', { timeZone: 'UTC' })
  async scheduleWeeklyRecommendations() {
    this.logger.log('Ejecutando tarea programada de recomendaciones semanales...');
    try {
      await this.recommendationsService.generateForAllStudents();
    } catch (error) {
      this.logger.error(`Error en la tarea programada de recomendaciones: ${error}`);
    }
  }
}