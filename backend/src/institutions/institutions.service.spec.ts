import { ConflictException, NotFoundException } from '@nestjs/common';
import { InstitutionsService } from './institutions.service';
import { createMockPrismaService, MockPrismaService } from '../test-utils/mock-prisma';

describe('InstitutionsService (HU9)', () => {
  let service: InstitutionsService;
  let prisma: MockPrismaService;

  const dto = {
    name: 'UADE',
    domain: 'uade.pecod.com',
    address: 'Lima 775',
    phone: '011-4000-0000',
    contactEmail: 'contacto@uade.edu.ar',
  };

  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new InstitutionsService(prisma as any);
  });

  it('CA: se puede registrar una institución completando los datos obligatorios', async () => {
    prisma.institution.findFirst.mockResolvedValue(null);
    prisma.institution.create.mockResolvedValue({ id: 'inst-1', ...dto });

    const result = await service.create(dto);

    expect(result.id).toBe('inst-1');
    expect(prisma.institution.create).toHaveBeenCalledWith({ data: dto });
  });

  it('CA: no se permite dar de alta una institución con nombre ya existente', async () => {
    prisma.institution.findFirst.mockResolvedValue({ id: 'existing', ...dto });

    await expect(service.create(dto)).rejects.toThrow(ConflictException);
    expect(prisma.institution.create).not.toHaveBeenCalled();
  });

  it('CA: no se permite dar de alta una institución con dominio ya existente', async () => {
    prisma.institution.findFirst.mockResolvedValue({
      id: 'existing',
      ...dto,
      name: 'Otro nombre',
    });

    await expect(service.create(dto)).rejects.toThrow(ConflictException);
  });

  it('findOne: institución no encontrada -> NotFoundException', async () => {
    prisma.institution.findUnique.mockResolvedValue(null);

    await expect(service.findOne('no-existe')).rejects.toThrow(NotFoundException);
  });
});
