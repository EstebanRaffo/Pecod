import { Body, Controller, Get, Param, Post, Patch, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { InstitutionsService } from './institutions.service';
import { CreateInstitutionDto } from './dto/create-institution.dto';
import { UpdateInstitutionEmailDomainsDto } from './dto/update-email-domains.dto';

// HU9 - Solo el Administrador de Sistema puede dar de alta instituciones en V1.
// GET endpoints are public to allow listing institutions for user registration
@Controller('institutions')
export class InstitutionsController {
  constructor(private institutionsService: InstitutionsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateInstitutionDto) {
    return this.institutionsService.create(dto);
  }

  @Get()
  findAll() {
    return this.institutionsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.institutionsService.findOne(id);
  }

  // HU23: Actualizar dominios de email permitidos para auto-registro
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id/email-domains')
  updateEmailDomains(
    @Param('id') id: string,
    @Body() dto: UpdateInstitutionEmailDomainsDto,
  ) {
    return this.institutionsService.updateEmailDomains(id, dto);
  }
}

