import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('courses')
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  // HU20: Crear reseña
  @Post(':courseId/reviews')
  @Roles(Role.STUDENT)
  create(
    @Param('courseId') courseId: string,
    @CurrentUser() student: AuthenticatedUser,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.create(courseId, student, dto);
  }

  // HU20: Editar reseña propia
  @Patch(':courseId/reviews/me')
  @Roles(Role.STUDENT)
  update(
    @Param('courseId') courseId: string,
    @CurrentUser() student: AuthenticatedUser,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.reviewsService.update(courseId, student, dto);
  }

  // HU20: Eliminar reseña propia
  @Delete(':courseId/reviews/me')
  @Roles(Role.STUDENT)
  delete(@Param('courseId') courseId: string, @CurrentUser() student: AuthenticatedUser) {
    return this.reviewsService.delete(courseId, student);
  }

  // HU20: Listar reseñas del curso (más reciente primero)
  @Get(':courseId/reviews')
  getReviews(@Param('courseId') courseId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.reviewsService.getByCourse(courseId, user);
  }
}
