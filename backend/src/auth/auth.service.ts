import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailService: MailService,
    private configService: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    // HU10: "ante credenciales inválidas, el acceso se deniega con un mensaje genérico,
    // sin revelar si el usuario existe" -> mismo mensaje en ambos casos (usuario inexistente / password incorrecta)
    const genericError = 'Email o contraseña incorrectos.';
    if (!user) throw new UnauthorizedException(genericError);

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) throw new UnauthorizedException(genericError);

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      institutionId: user.institutionId,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        institutionId: user.institutionId,
      },
    };
  }

  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, 10);
  }

  // HU22: Generar token de restablecimiento de contraseña
  async generatePasswordResetToken(email: string): Promise<string> {
    // Buscar el usuario (sin revelar si existe)
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Generar token en claro de 32 bytes
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Si el usuario existe, guardar el token
    if (user) {
      // Invalidar tokens anteriores
      await this.prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() }, // Marcar como usado
      });

      // Crear nuevo token con validez de 60 minutos
      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 60 minutos
        },
      });

      // Enviar email (fire-and-forget para no revelar timing)
      const frontendUrl = this.configService.get<string>(
        'FRONTEND_URL',
        'http://localhost:3000',
      );
      const resetLink = `${frontendUrl}/reset-password?token=${token}`;
      this.mailService.sendPasswordResetEmail(email, resetLink, user.name).catch((err) => {
        // Log pero no fallar
        console.error('Failed to send reset email:', err);
      });
    } else {
      // Simular delay similar para no revelar si el email existe (timing attack mitigation)
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // Siempre responder lo mismo (genérico)
    return 'Se ha enviado un correo con instrucciones para restablecer tu contraseña.';
  }

  // HU22: Restablecer contraseña con token
  async resetPassword(token: string, password: string): Promise<void> {
    // Validar longitud de contraseña
    if (password.length < 8) {
      throw new BadRequestException('La contraseña debe tener al menos 8 caracteres.');
    }

    // Hashear el token recibido para comparar con la BD
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Buscar el token en la BD
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!resetToken) {
      throw new BadRequestException(
        'El enlace para restablecer la contraseña es inválido o ha expirado. Solicita uno nuevo.',
      );
    }

    // Validar que no haya expirado
    if (resetToken.expiresAt < new Date()) {
      throw new BadRequestException(
        'El enlace para restablecer la contraseña ha expirado. Solicita uno nuevo.',
      );
    }

    // Validar que no haya sido usado
    if (resetToken.usedAt) {
      throw new BadRequestException(
        'El enlace para restablecer la contraseña ya ha sido utilizado. Solicita uno nuevo.',
      );
    }

    // Actualizar contraseña e invalidar sesiones anteriores
    const newPasswordHash = await this.hashPassword(password);
    await this.prisma.user.update({
      where: { id: resetToken.userId },
      data: {
        passwordHash: newPasswordHash,
        passwordChangedAt: new Date(), // HU22: Invalidar tokens JWT anteriores
      },
    });

    // Marcar token como usado
    await this.prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    });
  }
}
