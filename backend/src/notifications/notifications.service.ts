import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

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
}