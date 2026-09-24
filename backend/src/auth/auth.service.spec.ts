import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { createMockPrismaService, MockPrismaService } from '../test-utils/mock-prisma';

describe('AuthService (HU10)', () => {
  let service: AuthService;
  let prisma: MockPrismaService;
  let jwtService: JwtService;

  beforeEach(() => {
    prisma = createMockPrismaService();
    jwtService = { sign: jest.fn().mockReturnValue('fake-jwt-token') } as unknown as JwtService;
    service = new AuthService(prisma as any, jwtService);
  });

  it('CA: un usuario con credenciales válidas recibe un token y sus datos', async () => {
    const passwordHash = await bcrypt.hash('secret123', 10);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'prof@uade.edu.ar',
      passwordHash,
      role: 'PROFESSOR',
      institutionId: 'inst-1',
      name: 'Profe Test',
    });

    const result = await service.login({ email: 'prof@uade.edu.ar', password: 'secret123' });

    expect(result.accessToken).toBe('fake-jwt-token');
    expect(result.user).toMatchObject({ email: 'prof@uade.edu.ar', role: 'PROFESSOR' });
  });

  it('CA: usuario inexistente -> mensaje genérico, sin revelar que no existe', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.login({ email: 'nadie@uade.edu.ar', password: 'x' })).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(service.login({ email: 'nadie@uade.edu.ar', password: 'x' })).rejects.toThrow(
      'Email o contraseña incorrectos.',
    );
  });

  it('CA: contraseña incorrecta -> el MISMO mensaje genérico que usuario inexistente', async () => {
    const passwordHash = await bcrypt.hash('secret123', 10);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'prof@uade.edu.ar',
      passwordHash,
      role: 'PROFESSOR',
      institutionId: 'inst-1',
    });

    await expect(
      service.login({ email: 'prof@uade.edu.ar', password: 'incorrecta' }),
    ).rejects.toThrow('Email o contraseña incorrectos.');
  });
});
