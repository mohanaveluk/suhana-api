import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiResponse, ApiParam,
} from '@nestjs/swagger';

import { MatchFixedService } from './match-fixed.service';
import { PublicStoriesQueryDto } from './dto/public-stories-query.dto';
import { PaginatedSuccessStoriesDto, SuccessStoryResponseDto } from './dto/success-story-response.dto';
import { SuccessStatsResponseDto } from './dto/stats-response.dto';

@ApiTags('match-fixed / public')
@Controller('match-fixed/public')
export class MatchFixedPublicController {
  constructor(private readonly matchFixedService: MatchFixedService) {}

  // GET /match-fixed/public
  @Get()
  @ApiOperation({
    summary: 'List public success stories',
    description:
      'Returns paginated success stories where the couple consented to publication (allowStoryPublish = true). ' +
      'Sorted latest first. Ideal for the homepage Stories section.',
  })
  @ApiResponse({ status: 200, description: 'Paginated success stories', type: PaginatedSuccessStoriesDto })
  getPublicStories(@Query() query: PublicStoriesQueryDto): Promise<PaginatedSuccessStoriesDto> {
    return this.matchFixedService.getPublicSuccessStories(query);
  }

  // GET /match-fixed/public/featured
  @Get('featured')
  @ApiOperation({
    summary: 'Get featured success stories for homepage carousel',
    description:
      'Returns up to 10 success stories sorted by verified status then recency. ' +
      'Use this endpoint to power the homepage carousel or hero banner.',
  })
  @ApiResponse({ status: 200, description: 'Top 10 featured success stories', type: [SuccessStoryResponseDto] })
  getFeaturedStories(): Promise<SuccessStoryResponseDto[]> {
    return this.matchFixedService.getFeaturedStories();
  }

  // GET /match-fixed/public/stats
  @Get('stats')
  @ApiOperation({
    summary: 'Get platform success statistics',
    description:
      'Returns aggregated counts suitable for the homepage "Our Success" section. ' +
      'e.g. "15,000 matches fixed, 9,200 married through Suhana".',
  })
  @ApiResponse({ status: 200, description: 'Platform success statistics', type: SuccessStatsResponseDto })
  getStats(): Promise<SuccessStatsResponseDto> {
    return this.matchFixedService.getSuccessStats();
  }

  // GET /match-fixed/public/:id
  @Get(':id')
  @ApiOperation({
    summary: 'Get a single public success story by ID',
    description: 'Returns full story detail including all photo URLs. Only visible if the couple consented to publish.',
  })
  @ApiParam({ name: 'id', description: 'Match Fixed record UUID' })
  @ApiResponse({ status: 200, description: 'Success story detail', type: SuccessStoryResponseDto })
  @ApiResponse({ status: 404, description: 'Story not found or not published' })
  getStoryById(@Param('id') id: string): Promise<SuccessStoryResponseDto> {
    return this.matchFixedService.getSuccessStoryById(id);
  }
}
