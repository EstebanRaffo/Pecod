import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { EvaluationsService } from './evaluations.service';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';
import { SubmitAttemptDto } from './dto/submit-attempt.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class EvaluationsController {
  constructor(private evaluationsService: EvaluationsService) {}

  // Listado de evaluaciones de un curso (Profesor: para administrarlas; Alumno: para rendirlas).
  @Get('courses/:courseId/evaluations')
  @Roles(Role.PROFESSOR, Role.STUDENT)
  listByCourse(@Param('courseId') courseId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.evaluationsService.listByCourse(courseId, user);
  }

  // HU11
  @Post('courses/:courseId/evaluations')
  @Roles(Role.PROFESSOR)
  create(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateEvaluationDto,
  ) {
    return this.evaluationsService.create(courseId, user, dto);
  }

  // HU12
  @Get('evaluations/:evaluationId/take')
  @Roles(Role.STUDENT)
  getForTaking(@Param('evaluationId') evaluationId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.evaluationsService.getForTaking(evaluationId, user);
  }

  // HU12
  @Post('evaluations/:evaluationId/submit')
  @Roles(Role.STUDENT)
  submit(
    @Param('evaluationId') evaluationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitAttemptDto,
  ) {
    return this.evaluationsService.submit(evaluationId, user, dto);
  }
}
