import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { InstitutionsModule } from './institutions/institutions.module';
import { UsersModule } from './users/users.module';
import { CoursesModule } from './courses/courses.module';
import { TopicsModule } from './topics/topics.module';
import { EnrollmentsModule } from './enrollments/enrollments.module';
import { EvaluationsModule } from './evaluations/evaluations.module';
import { UploadsModule } from './uploads/uploads.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule, // HU10
    InstitutionsModule, // HU9
    UsersModule, // HU9
    CoursesModule, // HU1, HU4, HU5, HU8
    TopicsModule, // HU5, HU6, HU7
    EnrollmentsModule, // HU2, HU3
    EvaluationsModule, // HU11, HU12
    UploadsModule, // HU5, HU6, HU7 (URLs prefirmadas S3)
  ],
})
export class AppModule {}
