import { Body, Controller, HttpCode, HttpStatus, Post, BadRequestException, Req, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto, ResetPasswordValidator } from './dto/reset-password.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // HU10 - login con email y contraseña, redirección según rol la resuelve el frontend
  // en base al `role` que devuelve esta respuesta.
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // HU23: Auto-registro de Alumno por dominio institucional
  @Post('register')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 3600000 } }) // 5 registros por hora por IP
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Req() request: Request,
  ) {
    // HU23: Rate limiting por IP
    const clientIp =
      (request.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      request.socket.remoteAddress ||
      'unknown';

    return this.authService.register(dto);
  }

  // HU23: Verificar email con token
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  // HU23: Reenviar enlace de verificación de email
  @Post('resend-verification')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 3600000 } }) // 5 por hora
  @HttpCode(HttpStatus.OK)
  async resendVerification(
    @Body() dto: ResendVerificationDto,
    @Req() request: Request,
  ) {
    // HU23: Rate limiting por IP
    const clientIp =
      (request.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      request.socket.remoteAddress ||
      'unknown';

    const message = await this.authService.resendVerification(dto.email);

    // Respuesta genérica
    return { message };
  }

  // HU22: Solicitar token de restablecimiento de contraseña
  @Post('forgot-password')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 3600000 } }) // 5 por hora
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Req() request: Request,
  ) {
    // HU22: Rate limiting también por IP (complementario al email)
    const clientIp =
      (request.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      request.socket.remoteAddress ||
      'unknown';

    const message = await this.authService.generatePasswordResetToken(dto.email);

    // Respuesta genérica siempre igual (HU22: no revelar si el email existe)
    return {
      message,
    };
  }

  // HU22: Restablecer contraseña con token
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    // Validar que las contraseñas coincidan
    if (!ResetPasswordValidator.validate(dto)) {
      throw new BadRequestException('Las contraseñas no coinciden.');
    }

    await this.authService.resetPassword(dto.token, dto.password);

    return {
      message: 'Tu contraseña ha sido restablecida exitosamente. Por favor, inicia sesión con tu nueva contraseña.',
    };
  }
}
