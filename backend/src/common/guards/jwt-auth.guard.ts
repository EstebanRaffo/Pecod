import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// HU10: "ante credenciales inválidas / sesión expirada, el acceso se deniega"
// Se aplica de forma global salvo en los endpoints marcados @Public().
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
