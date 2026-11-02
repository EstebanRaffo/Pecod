import { Module } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CoursesController } from './courses.controller';
import { UploadsModule } from '../uploads/uploads.module';
import { ReviewsModule } from '../reviews/reviews.module';

@Module({
  imports: [UploadsModule, ReviewsModule],
  providers: [CoursesService],
  controllers: [CoursesController],
  exports: [CoursesService],
})
export class CoursesModule {}
