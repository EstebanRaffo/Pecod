import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInstitutionDto } from './dto/create-institution.dto';

@Injectable()
export class InstitutionsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateInstitutionDto) {
    // HU9: "no se permite dar de alta una institución con datos duplicados (nombre o dominio ya existentes)"
    const existing = await this.prisma.institution.findFirst({
      where: { OR: [{ name: dto.name }, { domain: dto.domain }] },
    });
    if (existing) {
      throw new ConflictException(
        'Ya existe una institución con ese nombre o dominio.',
      );
    }

    return this.prisma.institution.create({ data: dto });
  }

  findAll() {
    return this.prisma.institution.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const institution = await this.prisma.institution.findUnique({ where: { id } });
    if (!institution) throw new NotFoundException('Institución no encontrada.');
    return institution;
  }
}
