import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { InstitutionsModule } from './institutions/institutions.module';
import { UsersModule } from './users/users.module';
import { CoursesModule } from './courses/courses.module';
import { TopicsModule } from './topics/topics.module';
import { EnrollmentsModule } from './enrollments/enrollments.module';
import { EvaluationsModule } from './evaluations/evaluations.module';
import { UploadsModule } from './uploads/uploads.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CertificatesModule } from './certificates/certificates.module';
import { ReviewsModule } from './reviews/reviews.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { RecommendationsModule } from './recommendations/recommendations.module'; // HU24
import { ForumModule } from './forum/forum.module'; // HU25
import { PaymentsModule } from './payments/payments.module'; // HU26

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule, // HU10
    InstitutionsModule, // HU9
    UsersModule, // HU9
    CoursesModule, // HU1, HU4, HU5, HU8
    TopicsModule, // HU5, HU6, HU7
    NotificationsModule,
    EnrollmentsModule, // HU2, HU3
    EvaluationsModule, // HU11, HU12
    UploadsModule, // HU5, HU6, HU7 (URLs prefirmadas S3)
    CertificatesModule, // HU18
    ReviewsModule, // HU20
    AnalyticsModule, // HU21
    RecommendationsModule, // HU24
    ForumModule, // HU25
    PaymentsModule, // HU26
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard, // HU22: Rate limiting global
    },
  ],
})
export class AppModule {}
