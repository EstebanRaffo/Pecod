import { Controller, ForbiddenException, Get, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { AnalyticsService } from './analytics.service';
import { AnalyticsResponseDto } from './dto/analytics-response.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('professor')
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  // HU21: Obtener panel de analíticas del profesor
  @Get('analytics')
  @Roles(Role.PROFESSOR)
  async getAnalytics(@CurrentUser() professor: AuthenticatedUser): Promise<AnalyticsResponseDto[]> {
    if (!professor.institutionId) {
      throw new ForbiddenException('El profesor no tiene una institución asociada.');
    }
    return this.analyticsService.getAnalyticsByProfessor(professor.userId, professor.institutionId);
  }
}
