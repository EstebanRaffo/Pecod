import { Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { EnrollmentsService } from './enrollments.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STUDENT)
@Controller()
export class EnrollmentsController {
  constructor(private enrollmentsService: EnrollmentsService) {}

  // HU2
  @Post('courses/:courseId/enroll')
  enroll(@Param('courseId') courseId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.enrollmentsService.enroll(courseId, user);
  }

  // HU3
  @Get('enrollments/my-courses')
  myCourses(@CurrentUser() user: AuthenticatedUser) {
    return this.enrollmentsService.myCourses(user);
  }

  @Get('courses/:courseId/progress')
  getProgress(@Param('courseId') courseId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.enrollmentsService.getProgress(courseId, user);
  }

  @Put('courses/:courseId/topics/:topicId/viewed')
  markViewed(@Param('courseId') courseId: string, @Param('topicId') topicId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.enrollmentsService.setTopicViewed(courseId, topicId, user, true);
  }

  @Delete('courses/:courseId/topics/:topicId/viewed')
  unmarkViewed(@Param('courseId') courseId: string, @Param('topicId') topicId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.enrollmentsService.setTopicViewed(courseId, topicId, user, false);
  }
}
