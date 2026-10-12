import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { createMockPrismaService, MockPrismaService } from '../test-utils/mock-prisma';

describe('NotificationsService (HU17)', () => {
  let prisma: MockPrismaService;
  let service: NotificationsService;
  const visible = { studentId: 'student-1', course: { enrollments: { some: { studentId: 'student-1' } } } };

  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new NotificationsService(prisma as any);
  });

  it('lista solo avisos propios de cursos con inscripcion vigente, mas recientes primero', async () => {
    prisma.notification.findMany.mockResolvedValue([]);
    await expect(service.list('student-1')).resolves.toEqual([]);
    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: visible, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  });

  it('marca como leida una notificacion propia', async () => {
    prisma.notification.findFirst.mockResolvedValue({ id: 'notice-1', readAt: null });
    await service.markRead('notice-1', 'student-1');
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notice-1', ...visible }, data: { readAt: expect.any(Date) },
    });
  });

  it('rechaza avisos ajenos, inexistentes o de cursos sin inscripcion', async () => {
    prisma.notification.findFirst.mockResolvedValue(null);
    await expect(service.markRead('notice-1', 'student-1')).rejects.toThrow(NotFoundException);
    expect(prisma.notification.findFirst).toHaveBeenCalledWith({ where: { id: 'notice-1', ...visible } });
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  it('conserva la fecha original al volver a marcar como leida', async () => {
    const notification = { id: 'notice-1', readAt: new Date() };
    prisma.notification.findFirst.mockResolvedValue(notification);
    await expect(service.markRead('notice-1', 'student-1')).resolves.toEqual(notification);
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });
});