import { Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { RecommendationsService } from '../recommendations/recommendations.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(
    private notificationsService: NotificationsService,
    private recommendationsService: RecommendationsService,
  ) {}

  @Get()
  @Roles(Role.STUDENT)
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.list(user.userId);
  }

  @Patch(':id/read')
  @Roles(Role.STUDENT)
  markRead(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markRead(id, user.userId);
  }

  // HU24: Endpoint para ejecutar manualmente la generación de recomendaciones (solo ADMIN)
  @Post('recommendations/run')
  @Roles(Role.ADMIN)
  async runRecommendations() {
    return this.recommendationsService.generateForAllStudents();
  }
}