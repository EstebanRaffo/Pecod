import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // HU9: "los usuarios son dados de alta exclusivamente por el Administrador de Sistema
  // (no existe auto-registro en V1)... y reciben el medio de acceso inicial definido"
  async create(dto: CreateUserDto) {
    const institution = await this.prisma.institution.findUnique({
      where: { id: dto.institutionId },
    });
    if (!institution) throw new NotFoundException('La institución indicada no existe.');

    const existingUser = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingUser) throw new ConflictException('Ya existe un usuario con ese email.');

    // Contraseña temporal generada por el sistema (medio de acceso inicial).
    // En un flujo real esto se enviaría por email (ver "A incorporar en versiones futuras").
    const temporaryPassword = crypto.randomBytes(6).toString('hex');
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        role: dto.role,
        institutionId: dto.institutionId,
        passwordHash,
      },
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        institutionId: user.institutionId,
      },
      temporaryPassword, // mostrar una única vez al Administrador
    };
  }

  findAllByInstitution(institutionId: string) {
    return this.prisma.user.findMany({
      where: { institutionId },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
  }
}
