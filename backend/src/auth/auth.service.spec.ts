import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AuthService } from './auth.service';
import { MailService } from '../mail/mail.service';
import { InstitutionsService } from '../institutions/institutions.service';
import { createMockPrismaService, MockPrismaService } from '../test-utils/mock-prisma';

describe('AuthService (HU10 + HU22 + HU23)', () => {
  let service: AuthService;
  let prisma: MockPrismaService;
  let jwtService: JwtService;
  let mailService: MailService;
  let configService: ConfigService;
  let institutionsService: InstitutionsService;

  beforeEach(() => {
    prisma = createMockPrismaService();
    jwtService = { sign: jest.fn().mockReturnValue('fake-jwt-token') } as unknown as JwtService;
    mailService = { 
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
      sendEmailVerificationEmail: jest.fn().mockResolvedValue(undefined), // HU23
    } as unknown as MailService;
    configService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config = { FRONTEND_URL: 'http://localhost:3000' };
        return config[key] || defaultValue;
      }),
    } as unknown as ConfigService;
    institutionsService = {
      findByEmailDomain: jest.fn(),
    } as unknown as InstitutionsService;
    service = new AuthService(prisma as any, jwtService, mailService, configService, institutionsService);
  });

  // HU10 Tests
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

  // HU22 Tests
  it('CA: forgot-password responde igual si el email existe o no', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    const result1 = await service.generatePasswordResetToken('noexiste@test.com');

    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      email: 'existe@test.com',
      name: 'Test User',
    });
    const result2 = await service.generatePasswordResetToken('existe@test.com');

    expect(result1).toBe(result2);
    expect(result1).toContain('correo');
  });

  it('CA: genera y valida token de reset válido', async () => {
    const user = { id: 'user-1', email: 'test@test.com', name: 'Test' };
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    prisma.user.findUnique.mockResolvedValueOnce(user);
    prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });
    prisma.passwordResetToken.create.mockResolvedValue({
      id: 'token-1',
      userId: 'user-1',
      tokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      usedAt: null,
      createdAt: new Date(),
    });

    await service.generatePasswordResetToken('test@test.com');

    // Ahora resetear contraseña
    prisma.passwordResetToken.findUnique.mockResolvedValueOnce({
      id: 'token-1',
      userId: 'user-1',
      tokenHash,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // aún válido
      usedAt: null,
      createdAt: new Date(),
      user: { id: 'user-1', email: 'test@test.com' },
    });
    prisma.user.update.mockResolvedValueOnce({ id: 'user-1' });
    prisma.passwordResetToken.update.mockResolvedValueOnce({ id: 'token-1', usedAt: new Date() });

    await service.resetPassword(token, 'newPassword123');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({
        passwordChangedAt: expect.any(Date),
      }),
    });
  });

  it('CA: rechaza contraseña corta (<8 caracteres)', async () => {
    await expect(service.resetPassword('token', 'short')).rejects.toThrow(BadRequestException);
  });

  it('CA: rechaza token vencido', async () => {
    const token = 'test-token';
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    prisma.passwordResetToken.findUnique.mockResolvedValueOnce({
      id: 'token-1',
      userId: 'user-1',
      tokenHash,
      expiresAt: new Date(Date.now() - 1000), // ya expirado
      usedAt: null,
      user: { id: 'user-1' },
    });

    await expect(service.resetPassword(token, 'newPassword123')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('CA: rechaza token ya utilizado', async () => {
    const token = 'test-token';
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    prisma.passwordResetToken.findUnique.mockResolvedValueOnce({
      id: 'token-1',
      userId: 'user-1',
      tokenHash,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      usedAt: new Date(), // ya fue usado
      user: { id: 'user-1' },
    });

    await expect(service.resetPassword(token, 'newPassword123')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('CA: rechaza token inválido', async () => {
    const token = 'invalid-token';
    prisma.passwordResetToken.findUnique.mockResolvedValueOnce(null);

    await expect(service.resetPassword(token, 'newPassword123')).rejects.toThrow(
      BadRequestException,
    );
  });
});
