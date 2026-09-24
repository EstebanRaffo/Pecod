import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CatalogQueryDto } from './dto/catalog-query.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('courses')
export class CoursesController {
  constructor(private coursesService: CoursesService) {}

  // HU1
  @Get()
  catalog(@CurrentUser() user: AuthenticatedUser, @Query() query: CatalogQueryDto) {
    return this.coursesService.catalog(user, query);
  }

  // Cursos propios del Profesor (incluye borradores). Declarado antes de ':id'
  // para que NestJS no interprete "mine" como un id de curso.
  @Get('mine')
  @Roles(Role.PROFESSOR)
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.coursesService.findMine(user);
  }

  // HU4
  @Get(':id')
  findDetail(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.coursesService.findDetail(id, user);
  }

  // HU5
  @Post()
  @Roles(Role.PROFESSOR)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCourseDto) {
    return this.coursesService.create(user, dto);
  }

  // HU8
  @Patch(':id')
  @Roles(Role.PROFESSOR)
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCourseDto,
  ) {
    return this.coursesService.update(id, user, dto);
  }

  // HU8: la confirmación previa ("¿seguro que querés despublicar?") es responsabilidad del frontend.
  @Patch(':id/publish')
  @Roles(Role.PROFESSOR)
  publish(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.coursesService.setPublished(id, user, true);
  }

  @Patch(':id/unpublish')
  @Roles(Role.PROFESSOR)
  unpublish(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.coursesService.setPublished(id, user, false);
  }
}
