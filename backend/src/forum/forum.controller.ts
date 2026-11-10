import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ForumService } from './forum.service';
import { CreateForumThreadDto } from './dto/create-forum-thread.dto';
import { CreateForumPostDto } from './dto/create-forum-post.dto';

// HU25: Controlador del foro de consultas por curso
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('courses')
export class ForumController {
  constructor(private forumService: ForumService) {}

  // HU25 CA1: Listar consultas del curso paginadas
  @Get(':courseId/forum/threads')
  @Roles(Role.STUDENT, Role.PROFESSOR)
  async listThreads(
    @Param('courseId') courseId: string,
    @Query('page') page?: string,
    @Query('topicId') topicId?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    if (!user) {
      throw new Error('User not authenticated');
    }
    const pageNum = page ? parseInt(page, 10) : 1;
    if (isNaN(pageNum) || pageNum < 1) {
      throw new BadRequestException('El número de página debe ser un entero positivo.');
    }
    return this.forumService.listThreads(courseId, user, pageNum, topicId);
  }

  // HU25 CA1: Crear una consulta
  @Post(':courseId/forum/threads')
  @Roles(Role.STUDENT, Role.PROFESSOR)
  async createThread(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateForumThreadDto,
  ) {
    return this.forumService.createThread(courseId, user, dto);
  }

  // HU25 CA3: Obtener detalle de una consulta con sus respuestas
  @Get('forum/threads/:threadId')
  @Roles(Role.STUDENT, Role.PROFESSOR)
  async getThread(
    @Param('threadId') threadId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.forumService.getThread(threadId, user);
  }

  // HU25 CA2: Crear una respuesta a una consulta
  @Post('forum/threads/:threadId/posts')
  @Roles(Role.STUDENT, Role.PROFESSOR)
  async createPost(
    @Param('threadId') threadId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateForumPostDto,
  ) {
    return this.forumService.createPost(threadId, user, dto);
  }

  // HU25 CA6: Eliminar una consulta
  @Delete('forum/threads/:threadId')
  @Roles(Role.STUDENT, Role.PROFESSOR)
  async deleteThread(
    @Param('threadId') threadId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.forumService.deleteThread(threadId, user);
  }

  // HU25 CA6: Eliminar una respuesta
  @Delete('forum/posts/:postId')
  @Roles(Role.STUDENT, Role.PROFESSOR)
  async deletePost(
    @Param('postId') postId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.forumService.deletePost(postId, user);
  }
}
