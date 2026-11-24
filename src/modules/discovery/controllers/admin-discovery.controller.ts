import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query, Request, UploadedFile,
  UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import {
  AdminProviderQueryDto, AdminReviewQueryDto, CreateProviderDto, GeocodeQueryDto, LocationInputDto, MediaCaptionDto,
  ModerateReviewDto, ProviderVerificationDto, UpdateCategoryDto, UpdateLocationDto, UpdateProviderDto,
} from '../dto/discovery-admin.dto';
import { CategoryDto } from '../dto/discovery-detail.dto';
import { DiscoveryAdminService } from '../services/discovery-admin.service';
import { DiscoveryCatalogService } from '../services/discovery-catalog.service';
import { DiscoveryReviewsService } from '../services/discovery-reviews.service';

/** Aurora Discover administration. Every write is audited (AuditEmitter, DISCOVERY_* events). */
@ApiTags('[Admin] Aurora Discover')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/discovery')
export class AdminDiscoveryController {
  constructor(
    private readonly admin: DiscoveryAdminService,
    private readonly catalog: DiscoveryCatalogService,
    private readonly reviews: DiscoveryReviewsService,
  ) {}

  // ── Categories ──────────────────────────────────────────────────────────

  @Get('categories')
  @ApiOperation({ summary: '[Admin] All categories' })
  @ApiResponse({ status: 200, type: [CategoryDto] })
  listCategories() {
    return this.catalog.listCategories();
  }

  @Patch('categories/:id')
  @ApiOperation({ summary: '[Admin] Update a category (activate / rename / reorder)' })
  updateCategory(@Request() req: any, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCategoryDto) {
    return this.catalog.updateCategory(id, dto, req.user.id);
  }

  // ── Providers ───────────────────────────────────────────────────────────

  @Get('providers')
  @ApiOperation({ summary: '[Admin] List listings (filters: q, category, status, country, includeDeleted)' })
  listProviders(@Query() q: AdminProviderQueryDto) {
    return this.admin.list(q);
  }

  @Get('providers/:id')
  @ApiOperation({ summary: '[Admin] Full listing incl. contact, notes, coordinates (also soft-deleted)' })
  getProvider(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.admin.get(id);
  }

  @Post('providers')
  @ApiOperation({ summary: '[Admin] Create a listing (starts PENDING verification)' })
  createProvider(@Request() req: any, @Body() dto: CreateProviderDto) {
    return this.admin.create(dto, req.user.id);
  }

  @Patch('providers/:id')
  @ApiOperation({ summary: '[Admin] Update a listing (arrays sent replace the stored set)' })
  updateProvider(@Request() req: any, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateProviderDto) {
    return this.admin.update(id, dto, req.user.id);
  }

  @Delete('providers/:id')
  @ApiOperation({ summary: '[Admin] Soft-delete a listing' })
  deleteProvider(@Request() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.admin.remove(id, req.user.id);
  }

  @Post('providers/:id/restore')
  @ApiOperation({ summary: '[Admin] Restore a soft-deleted listing' })
  restoreProvider(@Request() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.admin.restore(id, req.user.id);
  }

  @Patch('providers/:id/verification')
  @ApiOperation({
    summary: '[Admin] Set business-listing verification status',
    description: 'PENDING / VERIFIED / REJECTED / SUSPENDED. REJECTED and SUSPENDED hide the listing and need a note.',
  })
  setVerification(@Request() req: any, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: ProviderVerificationDto) {
    return this.admin.setVerification(id, dto, req.user.id);
  }

  // ── Locations ───────────────────────────────────────────────────────────

  @Post('providers/:id/locations')
  @ApiOperation({ summary: '[Admin] Add a location (geocoded from lat/lng, postal code, or city)' })
  addLocation(@Request() req: any, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: LocationInputDto) {
    return this.admin.addLocation(id, dto, req.user.id);
  }

  @Patch('providers/:id/locations/:locationId')
  @ApiOperation({ summary: '[Admin] Update a location' })
  updateLocation(
    @Request() req: any,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('locationId', new ParseUUIDPipe()) locationId: string,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.admin.updateLocation(id, locationId, dto, req.user.id);
  }

  @Delete('providers/:id/locations/:locationId')
  @ApiOperation({ summary: '[Admin] Delete a location' })
  deleteLocation(
    @Request() req: any,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('locationId', new ParseUUIDPipe()) locationId: string,
  ) {
    return this.admin.deleteLocation(id, locationId, req.user.id);
  }

  @Get('geocode')
  @ApiOperation({ summary: '[Admin] Look up coordinates for a postal code or city (from the imported GeoNames table)' })
  geocode(@Query() q: GeocodeQueryDto) {
    return this.admin.geocode(q);
  }

  // ── Media ───────────────────────────────────────────────────────────────

  @Post('providers/:id/media')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        caption: { type: 'string' },
        setAsPhoto: { type: 'boolean' },
      },
    },
  })
  @ApiOperation({ summary: '[Admin] Upload a gallery photo (re-encoded, EXIF stripped)' })
  uploadMedia(
    @Request() req: any,
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: MediaCaptionDto,
  ) {
    return this.admin.uploadMedia(id, file, dto.caption ?? null, dto.setAsPhoto === true, req.user.id);
  }

  @Delete('providers/:id/media/:mediaId')
  @ApiOperation({ summary: '[Admin] Delete a gallery photo' })
  deleteMedia(
    @Request() req: any,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('mediaId', new ParseUUIDPipe()) mediaId: string,
  ) {
    return this.admin.deleteMedia(id, mediaId, req.user.id);
  }

  // ── Reviews ─────────────────────────────────────────────────────────────

  @Get('reviews')
  @ApiOperation({ summary: '[Admin] Reviews for moderation (filter by status / provider)' })
  listReviews(@Query() q: AdminReviewQueryDto) {
    return this.reviews.adminList(q);
  }

  @Patch('reviews/:id')
  @ApiOperation({ summary: '[Admin] Moderate a review (recomputes the listing rating from APPROVED reviews)' })
  moderateReview(@Request() req: any, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: ModerateReviewDto) {
    return this.reviews.moderate(id, dto, req.user.id);
  }
}
