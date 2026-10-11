import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { TopicsService } from './topics.service';
import { CreateTopicDto } from './dto/create-topic.dto';
import { UpdateTopicDto } from './dto/update-topic.dto';
import { AttachVideoDto } from './dto/attach-video.dto';
import { AttachScreenRecordingDto } from './dto/attach-screen-recording.dto';
import { AddMaterialDto } from './dto/add-material.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class TopicsController {
  constructor(private topicsService: TopicsService) {}

  // HU5 (temario del curso)
  @Post('courses/:courseId/topics')
  @Roles(Role.PROFESSOR)
  createTopic(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTopicDto,
  ) {
    return this.topicsService.createTopic(courseId, user, dto);
  }

  @Patch('topics/:topicId')
  @Roles(Role.PROFESSOR)
  updateTopic(
    @Param('topicId') topicId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateTopicDto,
  ) {
    return this.topicsService.updateTopic(topicId, user, dto);
  }

  // HU5 / HU6
  @Post('topics/:topicId/video')
  @Roles(Role.PROFESSOR)
  attachVideo(
    @Param('topicId') topicId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AttachVideoDto,
  ) {
    return this.topicsService.attachVideo(topicId, user, dto);
  }
  @Delete('topics/:topicId/video')
  @Roles(Role.PROFESSOR)
  deleteVideo(
    @Param('topicId') topicId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.topicsService.deleteVideo(topicId, user);
  }

  // HU6: grabación de pantalla — endpoint separado de la carga de archivo
  @Post('topics/:topicId/screen-recording')
  @Roles(Role.PROFESSOR)
  attachScreenRecording(
    @Param('topicId') topicId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AttachScreenRecordingDto,
  ) {
    return this.topicsService.attachScreenRecording(topicId, user, dto);
  }

  @Delete('topics/:topicId/screen-recording')
  @Roles(Role.PROFESSOR)
  deleteScreenRecording(
    @Param('topicId') topicId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.topicsService.deleteScreenRecording(topicId, user);
  }

  // HU7
  @Post('topics/:topicId/materials')
  @Roles(Role.PROFESSOR)
  addMaterial(
    @Param('topicId') topicId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddMaterialDto,
  ) {
    return this.topicsService.addMaterial(topicId, user, dto);
  }

  @Delete('topics/:topicId/materials/:materialId')
  @Roles(Role.PROFESSOR)
  deleteMaterial(
    @Param('topicId') topicId: string,
    @Param('materialId') materialId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.topicsService.deleteMaterial(topicId, materialId, user);
  }

  // HU3 / HU4: contenido de un tema (video + material), gated por inscripción.
  @Get('topics/:topicId')
  getContent(@Param('topicId') topicId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.topicsService.getContent(topicId, user);
  }
}
