import { ConflictException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInstitutionDto } from './dto/create-institution.dto';
import { UpdateInstitutionEmailDomainsDto } from './dto/update-email-domains.dto';

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

    // HU23: Crear institución y sus dominios de email en transacción
    const { emailDomains, ...institutionData } = dto;
    
    return this.prisma.$transaction(async (tx) => {
      const institution = await tx.institution.create({ data: institutionData });

      // HU23: Si se proporcionan dominios de email, validarlos y crearlos
      if (emailDomains && emailDomains.length > 0) {
        await this.createEmailDomains(tx, institution.id, emailDomains);
      }

      return institution;
    });
  }

  findAll() {
    return this.prisma.institution.findMany({
      orderBy: { name: 'asc' },
      include: { emailDomains: true }, // HU23: incluir dominios
    });
  }

  async findOne(id: string) {
    const institution = await this.prisma.institution.findUnique({
      where: { id },
      include: { emailDomains: true }, // HU23: incluir dominios
    });
    if (!institution) throw new NotFoundException('Institución no encontrada.');
    return institution;
  }

  // HU23: Buscar institución por dominio de email
  async findByEmailDomain(domain: string) {
    const normalizedDomain = domain.toLowerCase();
    const emailDomain = await this.prisma.institutionEmailDomain.findFirst({
      where: { domain: normalizedDomain },
      include: { institution: true },
    });
    return emailDomain?.institution || null;
  }

  // HU23: Actualizar dominios de email de una institución
  async updateEmailDomains(id: string, dto: UpdateInstitutionEmailDomainsDto) {
    const institution = await this.prisma.institution.findUnique({
      where: { id },
      include: { emailDomains: true },
    });
    if (!institution) throw new NotFoundException('Institución no encontrada.');

    // HU23: Validar dominios antes de actualizar
    const normalizedDomains = dto.emailDomains.map((d) =>
      this.normalizeDomain(d),
    );
    
    return this.prisma.$transaction(async (tx) => {
      // Eliminar dominios existentes
      await tx.institutionEmailDomain.deleteMany({ where: { institutionId: id } });

      // Crear nuevos dominios
      if (normalizedDomains.length > 0) {
        await this.createEmailDomains(tx, id, normalizedDomains);
      }

      return tx.institution.findUnique({
        where: { id },
        include: { emailDomains: true },
      });
    });
  }

  // HU23: Método privado para crear dominios de email con validación de unicidad
  private async createEmailDomains(tx: any, institutionId: string, domains: string[]) {
    const normalizedDomains = domains.map((d) => this.normalizeDomain(d));

    // Validar que no haya duplicados en el array
    const uniqueDomains = new Set(normalizedDomains);
    if (uniqueDomains.size !== normalizedDomains.length) {
      throw new BadRequestException(
        'No se permiten dominios duplicados en la misma institución.',
      );
    }

    // Validar que ningún dominio esté asignado a otra institución
    const existingDomains = await tx.institutionEmailDomain.findMany({
      where: { domain: { in: normalizedDomains } },
    });

    if (existingDomains.length > 0) {
      const duplicateDomains = existingDomains
        .map((d) => d.domain)
        .join(', ');
      throw new BadRequestException(
        `El dominio(s) ${duplicateDomains} ya está asignado a otra institución.`,
      );
    }

    // Crear dominios
    await tx.institutionEmailDomain.createMany({
      data: normalizedDomains.map((domain) => ({
        institutionId,
        domain,
      })),
    });
  }

  // HU23: Método para normalizar dominio (lowercase, sin @, validar formato)
  private normalizeDomain(domain: string): string {
    if (!domain || typeof domain !== 'string') {
      throw new BadRequestException('El dominio debe ser un texto válido.');
    }

    let normalized = domain.toLowerCase().trim();

    // Remover @ si existe al principio
    if (normalized.startsWith('@')) {
      normalized = normalized.slice(1);
    }

    // Validar formato: debe contener al menos un punto y caracteres válidos
    if (!/^[a-z0-9.-]+\.[a-z0-9]+$/.test(normalized)) {
      throw new BadRequestException(
        `El dominio "${domain}" tiene un formato inválido. Usa formato como "uade.edu.ar".`,
      );
    }

    return normalized;
  }
}
