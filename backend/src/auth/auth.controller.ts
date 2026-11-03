import { Body, Controller, HttpCode, HttpStatus, Post, BadRequestException, Req } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
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

  // HU22: Solicitar token de restablecimiento de contraseña
  @Post('forgot-password')
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
