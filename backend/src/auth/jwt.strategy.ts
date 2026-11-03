import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';

interface JwtPayload {
  sub: string;
  email: string;
  role: AuthenticatedUser['role'];
  institutionId: string | null;
  iat: number; // HU22: issued at timestamp
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) implements OnModuleInit {
  private logger = new Logger(JwtStrategy.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    const jwtSecret = config.get<string>('JWT_SECRET');
    // HU22: Eliminar fallback 'dev-secret'; fallar al arrancar si no está definido
    if (!jwtSecret) {
      throw new Error(
        'JWT_SECRET environment variable is not defined. Please set it before starting the application.',
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  onModuleInit() {
    this.logger.log('JwtStrategy initialized with JWT_SECRET');
  }

  // HU22: Validar que el token no sea anterior a un cambio de contraseña
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        institutionId: true,
        passwordChangedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado.');
    }

    // Si el usuario cambió su contraseña después de que se emitió este token, rechazarlo
    if (user.passwordChangedAt) {
      const tokenIssuedAt = payload.iat * 1000; // convertir a milisegundos
      const passwordChangedAt = user.passwordChangedAt.getTime();

      if (tokenIssuedAt < passwordChangedAt) {
        throw new UnauthorizedException(
          'Sesión expirada. Por favor, inicia sesión nuevamente.',
        );
      }
    }

    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      institutionId: payload.institutionId,
    };
  }
}
