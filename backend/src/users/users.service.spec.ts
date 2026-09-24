import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { createMockPrismaService, MockPrismaService } from '../test-utils/mock-prisma';

describe('UsersService (HU9)', () => {
  let service: UsersService;
  let prisma: MockPrismaService;

  const dto = {
    name: 'Ana Alumna',
    email: 'ana@uade.edu.ar',
    role: 'STUDENT' as const,
    institutionId: 'inst-1',
  };

  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new UsersService(prisma as any);
  });

  it('CA: se crea el usuario y se genera un medio de acceso inicial (contraseña temporal)', async () => {
    prisma.institution.findUnique.mockResolvedValue({ id: 'inst-1', name: 'UADE' });
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'user-2',
      ...dto,
    });

    const result = await service.create(dto);

    expect(result.user.email).toBe('ana@uade.edu.ar');
    expect(result.temporaryPassword).toBeDefined();
    expect(result.temporaryPassword.length).toBeGreaterThan(0);
  });

  it('CA: no se puede dar de alta un usuario en una institución inexistente', async () => {
    prisma.institution.findUnique.mockResolvedValue(null);

    await expect(service.create(dto)).rejects.toThrow(NotFoundException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('CA: no se permite un usuario duplicado por email', async () => {
    prisma.institution.findUnique.mockResolvedValue({ id: 'inst-1', name: 'UADE' });
    prisma.user.findUnique.mockResolvedValue({ id: 'existing', email: dto.email });

    await expect(service.create(dto)).rejects.toThrow(ConflictException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('CA: el usuario creado queda vinculado exclusivamente a la institución indicada', async () => {
    prisma.institution.findUnique.mockResolvedValue({ id: 'inst-1', name: 'UADE' });
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'user-2', ...dto });

    await service.create(dto);

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ institutionId: 'inst-1', role: 'STUDENT' }),
      }),
    );
  });
});
