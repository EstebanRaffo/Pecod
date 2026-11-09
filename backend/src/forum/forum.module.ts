import { Module } from '@nestjs/common';
import { ForumService } from './forum.service';
import { ForumController } from './forum.controller';
import { ForumAccessHelper } from './helpers/forum-access.helper';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ForumController],
  providers: [ForumService, ForumAccessHelper],
})
export class ForumModule {}
