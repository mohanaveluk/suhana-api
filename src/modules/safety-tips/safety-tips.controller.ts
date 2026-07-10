import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery,
} from '@nestjs/swagger';

import { SafetyTipsService } from './safety-tips.service';
import { QuerySafetyTipsDto } from './dto/query-safety-tips.dto';
import {
  PaginatedSafetyTipsResponseDto,
  SafetyCategoryResponseDto,
  SafetyTipResponseDto,
} from './dto/safety-tip-response.dto';
import { SafetyCategory } from './enums/safety-category.enum';

@ApiTags('Safety Tips')
@Controller('safety-tips')
export class SafetyTipsController {
  constructor(private readonly safetyTipsService: SafetyTipsService) {}

  // ── Static routes first (must come before /:id) ────────────────────────────

  @Get('featured')
  @ApiOperation({
    summary: 'Get featured safety tips',
    description: 'Returns all published safety tips marked as featured, sorted by display order.',
  })
  @ApiResponse({ status: 200, type: [SafetyTipResponseDto] })
  findFeatured(): Promise<SafetyTipResponseDto[]> {
    return this.safetyTipsService.findFeatured();
  }

  @Get('categories')
  @ApiOperation({
    summary: 'Get all safety tip categories',
    description: 'Returns all SafetyCategory enum values with their labels and published tip counts.',
  })
  @ApiResponse({ status: 200, type: [SafetyCategoryResponseDto] })
  getCategories(): Promise<SafetyCategoryResponseDto[]> {
    return this.safetyTipsService.getCategories();
  }

  // ── Paginated list ─────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({
    summary: 'Get all published safety tips',
    description: 'Paginated list of published safety tips with optional category filter, keyword search, and sort.',
  })
  @ApiResponse({ status: 200, type: PaginatedSafetyTipsResponseDto })
  findAll(@Query() dto: QuerySafetyTipsDto): Promise<PaginatedSafetyTipsResponseDto> {
    return this.safetyTipsService.findAll(dto);
  }

  // ── Parameterised routes last ───────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({
    summary: 'Get safety tip details',
    description: 'Returns full content of a published safety tip and increments its view count.',
  })
  @ApiParam({ name: 'id', description: 'Safety tip UUID' })
  @ApiResponse({ status: 200, type: SafetyTipResponseDto })
  @ApiResponse({ status: 404, description: 'Safety tip not found' })
  findById(@Param('id') id: string): Promise<SafetyTipResponseDto> {
    return this.safetyTipsService.findById(id);
  }
}
