import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CourseCompletionService } from '../common/services/course-completion.service';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';

@Module({
  imports: [PrismaModule],
  providers: [ReviewsService, CourseCompletionService],
  controllers: [ReviewsController],
  exports: [ReviewsService],
})
export class ReviewsModule {}
