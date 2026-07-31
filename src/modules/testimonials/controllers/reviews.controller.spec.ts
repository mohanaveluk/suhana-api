import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from '../services/reviews.service';
import { ReviewRepliesService } from '../services/review-replies.service';
import { ReviewLikesService } from '../services/review-likes.service';
import { ReviewReportsService } from '../services/review-reports.service';
import { ReviewAnalyticsService } from '../services/review-analytics.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';

// HTTP-layer integration test: wires the real controller + validation pipe with
// mocked services and a stubbed auth guard, then drives it over HTTP.
describe('ReviewsController (integration)', () => {
  let app: INestApplication;
  const reviewsService = {
    create: jest.fn().mockResolvedValue({ id: 'r1', status: 'PENDING' }),
    getStats: jest.fn().mockResolvedValue({ totalReviews: 10, averageRating: 4.8 }),
    listPublic: jest.fn().mockResolvedValue({ total: 0, page: 1, limit: 20, items: [] }),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [
        { provide: ReviewsService, useValue: reviewsService },
        { provide: ReviewRepliesService, useValue: {} },
        { provide: ReviewLikesService, useValue: {} },
        { provide: ReviewReportsService, useValue: {} },
        { provide: ReviewAnalyticsService, useValue: {} },
      ],
    })
      // Stub auth: inject a fake user and always allow.
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: any) => {
          ctx.switchToHttp().getRequest().user = { id: 'u1', role: 'user' };
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /reviews/public/stats returns aggregate stats', async () => {
    const res = await request(app.getHttpServer()).get('/reviews/public/stats').expect(200);
    expect(res.body.totalReviews).toBe(10);
    expect(res.body.averageRating).toBe(4.8);
  });

  it('POST /reviews validates the payload (title too short → 400)', async () => {
    await request(app.getHttpServer())
      .post('/reviews')
      .send({ title: 'hi', reviewText: 'short', overallRating: 9 })
      .expect(400);
  });

  it('POST /reviews accepts a valid payload', async () => {
    const res = await request(app.getHttpServer())
      .post('/reviews')
      .send({
        title: 'Wonderful experience',
        reviewText: 'The matchmaking suggestions were excellent and genuine.',
        overallRating: 5,
      })
      .expect(201);
    expect(res.body.id).toBe('r1');
    expect(reviewsService.create).toHaveBeenCalledWith('u1', expect.objectContaining({ overallRating: 5 }));
  });
});
