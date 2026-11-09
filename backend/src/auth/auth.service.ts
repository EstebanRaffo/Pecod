import { Injectable, UnauthorizedException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { InstitutionsService } from '../institutions/institutions.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailService: MailService,
    private configService: ConfigService,
    private institutionsService: InstitutionsService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    // HU10: "ante credenciales inválidas, el acceso se deniega con un mensaje genérico,
    // sin revelar si el usuario existe" -> mismo mensaje en ambos casos (usuario inexistente / password incorrecta)
    const genericError = 'Email o contraseña incorrectos.';
    if (!user) throw new UnauthorizedException(genericError);

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) throw new UnauthorizedException(genericError);

    // HU23: Si el usuario tiene email no verificado, rechazar con mensaje específico
    if (user.emailVerifiedAt === null) {
      throw new ForbiddenException(
        'Tu email aún no ha sido verificado. Por favor, revisa tu bandeja de entrada o solicita reenviar el enlace de verificación.',
      );
    }

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

  // HU23: Auto-registro de Alumno
  async register(dto: RegisterDto): Promise<{ user: any; message: string }> {
    // Validar que contraseña y confirmación coincidan
    if (dto.password !== dto.passwordConfirm) {
      throw new BadRequestException('Las contraseñas no coinciden.');
    }

    // Validar longitud mínima de contraseña
    if (dto.password.length < 8) {
      throw new BadRequestException('La contraseña debe tener al menos 8 caracteres.');
    }

    // Validar que el email no exista
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException('Ya existe una cuenta con ese email.');
    }

    // Extraer dominio del email
    const emailDomain = dto.email.split('@')[1]?.toLowerCase();
    if (!emailDomain) {
      throw new BadRequestException('El email tiene un formato inválido.');
    }

    // Buscar institución por dominio de email
    const institution = await this.institutionsService.findByEmailDomain(emailDomain);
    if (!institution) {
      throw new BadRequestException(
        'El dominio de tu email no pertenece a una institución habilitada.',
      );
    }

    // Crear usuario con email sin verificar
    const passwordHash = await this.hashPassword(dto.password);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
        role: Role.STUDENT, // HU23: Siempre STUDENT, sin excepciones
        institutionId: institution.id,
        emailVerifiedAt: null, // No verificado hasta confirmar email
      },
    });

    // Generar token de verificación de email
    const verificationToken = await this.generateEmailVerificationToken(user.id);

    // Enviar email de verificación
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    const verifyLink = `${frontendUrl}/verify-email?token=${verificationToken}`;
    await this.mailService.sendEmailVerificationEmail(
      user.email,
      verifyLink,
      user.name,
    ).catch((err) => {
      // Log pero no fallar
      console.error('Failed to send verification email:', err);
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        institutionId: user.institutionId,
      },
      message:
        'Registro exitoso. Por favor, verifica tu email para completar el proceso.',
    };
  }

  // HU23: Generar token de verificación de email
  private async generateEmailVerificationToken(userId: string): Promise<string> {
    // Generar token en claro de 32 bytes
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Invalidar tokens anteriores no usados
    await this.prisma.emailVerificationToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });

    // Crear nuevo token con validez de 24 horas
    await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 horas
      },
    });

    return token;
  }

  // HU23: Verificar email con token
  async verifyEmail(token: string): Promise<{ message: string }> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Buscar el token
    const verificationToken = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!verificationToken) {
      throw new BadRequestException(
        'El enlace de verificación es inválido o ha expirado.',
      );
    }

    // Validar que no haya expirado
    if (verificationToken.expiresAt < new Date()) {
      throw new BadRequestException(
        'El enlace de verificación ha expirado. Solicita uno nuevo.',
      );
    }

    // Validar que no haya sido usado
    if (verificationToken.usedAt) {
      throw new BadRequestException(
        'El enlace de verificación ya ha sido utilizado.',
      );
    }

    // Verificar el email del usuario
    await this.prisma.user.update({
      where: { id: verificationToken.userId },
      data: { emailVerifiedAt: new Date() },
    });

    // Marcar token como usado
    await this.prisma.emailVerificationToken.update({
      where: { id: verificationToken.id },
      data: { usedAt: new Date() },
    });

    return {
      message: 'Email verificado correctamente. Ahora puedes iniciar sesión.',
    };
  }

  // HU23: Reenviar enlace de verificación de email
  async resendVerification(email: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (user) {
      // Solo reenviar si el email no está verificado
      if (user.emailVerifiedAt === null) {
        // Generar nuevo token de verificación
        const verificationToken = await this.generateEmailVerificationToken(user.id);

        // Enviar email (fire-and-forget)
        const frontendUrl = this.configService.get<string>(
          'FRONTEND_URL',
          'http://localhost:3000',
        );
        const verifyLink = `${frontendUrl}/verify-email?token=${verificationToken}`;
        await this.mailService.sendEmailVerificationEmail(
          user.email,
          verifyLink,
          user.name,
        ).catch((err) => {
          console.error('Failed to send verification email:', err);
        });
      } else {
        // Simular delay para no revelar si el usuario existe o si ya verificó (timing attack mitigation)
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    } else {
      // Simular delay similar para no revelar si el email existe
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // Siempre responder lo mismo (genérico)
    return 'Si el email existe en nuestro sistema y no ha sido verificado, recibirás un enlace de verificación.';
  }
}

