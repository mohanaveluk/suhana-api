import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserReview } from './entity/user-review.entity';
import { ReviewReply } from './entity/review-reply.entity';
import { ReviewLike } from './entity/review-like.entity';
import { ReviewReport } from './entity/review-report.entity';
import { SuccessStory } from './entity/success-story.entity';
import { User } from '../user/entity/user.entity';

import { ReviewRepository } from './repositories/review.repository';
import { ReviewReplyRepository } from './repositories/review-reply.repository';
import { ReviewLikeRepository } from './repositories/review-like.repository';
import { ReviewReportRepository } from './repositories/review-report.repository';
import { SuccessStoryRepository } from './repositories/success-story.repository';

import { ReviewsService } from './services/reviews.service';
import { ReviewRepliesService } from './services/review-replies.service';
import { ReviewLikesService } from './services/review-likes.service';
import { ReviewReportsService } from './services/review-reports.service';
import { SuccessStoriesService } from './services/success-stories.service';
import { AdminReviewsService } from './services/admin-reviews.service';
import { ReviewAnalyticsService } from './services/review-analytics.service';
import {
  LexiconSentimentProvider,
  SentimentAnalysisService,
  SENTIMENT_PROVIDER,
} from './services/sentiment-analysis.service';

import { ReviewsController } from './controllers/reviews.controller';
import { SuccessStoriesController } from './controllers/success-stories.controller';
import { AdminReviewsController } from './controllers/admin-reviews.controller';

import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserReview,
      ReviewReply,
      ReviewLike,
      ReviewReport,
      SuccessStory,
      User, // read-only, for review-author enrichment
    ]),
    AuditModule, // provides AuditEmitter
  ],
  controllers: [ReviewsController, SuccessStoriesController, AdminReviewsController],
  providers: [
    // Repositories
    ReviewRepository,
    ReviewReplyRepository,
    ReviewLikeRepository,
    ReviewReportRepository,
    SuccessStoryRepository,
    // Services
    ReviewsService,
    ReviewRepliesService,
    ReviewLikesService,
    ReviewReportsService,
    SuccessStoriesService,
    AdminReviewsService,
    ReviewAnalyticsService,
    // Sentiment — swap LexiconSentimentProvider for an OpenAI/Claude/Gemini
    // implementation here (must implement SentimentProvider). Nothing else changes.
    LexiconSentimentProvider,
    { provide: SENTIMENT_PROVIDER, useExisting: LexiconSentimentProvider },
    {
      provide: SentimentAnalysisService,
      useFactory: (provider: LexiconSentimentProvider) => new SentimentAnalysisService(provider),
      inject: [SENTIMENT_PROVIDER],
    },
  ],
  exports: [ReviewsService, SuccessStoriesService],
})
export class TestimonialsModule {}
