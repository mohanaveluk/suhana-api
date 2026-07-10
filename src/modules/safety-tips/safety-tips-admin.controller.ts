import {
  Controller, Get, Post, Put, Delete, Patch,
  Body, Param, Query, UseGuards,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam,
} from '@nestjs/swagger';

import { SafetyTipsService } from './safety-tips.service';
import { CreateSafetyTipDto } from './dto/create-safety-tip.dto';
import { UpdateSafetyTipDto } from './dto/update-safety-tip.dto';
import { QuerySafetyTipsDto } from './dto/query-safety-tips.dto';
import { ReorderSafetyTipsDto } from './dto/reorder-safety-tips.dto';
import {
  PaginatedSafetyTipsResponseDto,
  SafetyTipResponseDto,
} from './dto/safety-tip-response.dto';

import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@ApiTags('[Admin] Safety Tips')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/safety-tips')
export class SafetyTipsAdminController {
  constructor(private readonly safetyTipsService: SafetyTipsService) {}

  // ── Static routes first (must come before /:id) ────────────────────────────

  @Get()
  @ApiOperation({
    summary: '[Admin] List all safety tips',
    description: 'Returns all tips (published and unpublished) with full pagination and filters.',
  })
  @ApiResponse({ status: 200, type: PaginatedSafetyTipsResponseDto })
  findAll(@Query() dto: QuerySafetyTipsDto): Promise<PaginatedSafetyTipsResponseDto> {
    return this.safetyTipsService.findAllAdmin(dto);
  }

  @Post()
  @ApiOperation({ summary: '[Admin] Create a safety tip' })
  @ApiResponse({ status: 201, type: SafetyTipResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  create(@Body() dto: CreateSafetyTipDto): Promise<SafetyTipResponseDto> {
    return this.safetyTipsService.create(dto);
  }

  @Patch('reorder')
  @ApiOperation({
    summary: '[Admin] Update display order for multiple tips',
    description: 'Accepts an array of { id, displayOrder } pairs and batch-updates the sort positions.',
  })
  @ApiResponse({ status: 200, schema: { example: { message: 'Display order updated successfully' } } })
  reorder(@Body() dto: ReorderSafetyTipsDto): Promise<{ message: string }> {
    return this.safetyTipsService.reorder(dto);
  }

  // ── Parameterised routes last ───────────────────────────────────────────────

  @Put(':id')
  @ApiOperation({ summary: '[Admin] Update a safety tip' })
  @ApiParam({ name: 'id', description: 'Safety tip UUID' })
  @ApiResponse({ status: 200, type: SafetyTipResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSafetyTipDto,
  ): Promise<SafetyTipResponseDto> {
    return this.safetyTipsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '[Admin] Soft-delete a safety tip' })
  @ApiParam({ name: 'id', description: 'Safety tip UUID' })
  @ApiResponse({ status: 200, schema: { example: { message: 'Safety tip deleted successfully' } } })
  @ApiResponse({ status: 404, description: 'Not found' })
  softDelete(@Param('id') id: string): Promise<{ message: string }> {
    return this.safetyTipsService.softDelete(id);
  }

  @Patch(':id/publish')
  @ApiOperation({
    summary: '[Admin] Toggle publish status',
    description: 'Flips isPublished between true and false.',
  })
  @ApiParam({ name: 'id', description: 'Safety tip UUID' })
  @ApiResponse({ status: 200, type: SafetyTipResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  togglePublish(@Param('id') id: string): Promise<SafetyTipResponseDto> {
    return this.safetyTipsService.togglePublish(id);
  }

  @Patch(':id/feature')
  @ApiOperation({
    summary: '[Admin] Toggle featured status',
    description: 'Flips isFeatured between true and false.',
  })
  @ApiParam({ name: 'id', description: 'Safety tip UUID' })
  @ApiResponse({ status: 200, type: SafetyTipResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  toggleFeature(@Param('id') id: string): Promise<SafetyTipResponseDto> {
    return this.safetyTipsService.toggleFeature(id);
  }
}
