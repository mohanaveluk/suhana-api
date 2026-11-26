import {
  BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query,
  Req, Request, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { Request as ExpRequest } from 'express';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { Public } from 'src/common/decorators/public.decorator';
import {
  CreateProviderDto, GeocodeQueryDto, LocationInputDto, MediaCaptionDto, UpdateLocationDto, UpdateProviderDto,
} from '../dto/discovery-admin.dto';
import { ClaimableQueryDto, CreateClaimDto, ProviderRegisterDto } from '../dto/discovery-provider-portal.dto';
import { ProviderPortalService } from '../services/provider-portal.service';
import { DiscoveryCatalogService } from '../services/discovery-catalog.service';
import { MemberThrottlerGuard } from './member-throttler.guard';

/**
 * Aurora Discover "For Providers" portal. Same login/JWT as members; every
 * listing endpoint checks the caller is an OWNER/STAFF member of that listing
 * (DiscoveryOwnershipService.assertCanManage) — IDOR-safe by construction.
 */
@ApiTags('Aurora Discover — Provider Portal')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('provider-portal')
export class ProviderPortalController {
  constructor(
    private readonly portal: ProviderPortalService,
    private readonly catalog: DiscoveryCatalogService,
  ) {}

  @Post('register')
  @Public()
  @UseGuards(MemberThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Register a business (provider account + draft listing)',
    description: 'Creates an unverified PROVIDER account and a DRAFT listing it owns, and emails a verification link.',
  })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 409, description: 'Email already registered — sign in instead' })
  register(@Body() dto: ProviderRegisterDto, @Req() req: ExpRequest) {
    return this.portal.register(dto, this.frontendBase(req));
  }

  /** Verification links point at the web app. Prefer the configured URL; fall back to the request origin (as member registration does). */
  private frontendBase(req: ExpRequest): string {
    const configured = process.env.FRONTEND_URL?.replace(/\/+$/, '');
    if (configured) return configured;
    const origin = req.get('origin') ?? '';
    if (!/^https?:\/\/[^\s/]+$/i.test(origin)) throw new BadRequestException('Unable to determine the site address.');
    return origin;
  }

  @Get('categories')
  @Public()
  @ApiOperation({ summary: 'Categories a business can register under' })
  categories() {
    return this.catalog.listCategories();
  }

  @Get('me')
  @ApiOperation({ summary: "Caller's provider dashboard: account, managed listings (with checklist), claims" })
  me(@Request() req: any) {
    return this.portal.me(req.user.id);
  }

  // ── Listings ────────────────────────────────────────────────────────────

  @Post('listings')
  @ApiOperation({ summary: 'Add another business (DRAFT, owned by the caller)' })
  createListing(@Request() req: any, @Body() dto: CreateProviderDto) {
    return this.portal.createListing(req.user.id, dto);
  }

  @Get('listings/:id')
  @ApiResponse({ status: 403, description: 'Caller does not manage this listing' })
  getListing(@Request() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.portal.getListing(req.user.id, id);
  }

  @Patch('listings/:id')
  updateListing(@Request() req: any, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateProviderDto) {
    return this.portal.updateListing(req.user.id, id, dto);
  }

  @Post('listings/:id/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit a draft for admin review' })
  submit(@Request() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.portal.submit(req.user.id, id);
  }

  @Post('listings/:id/locations')
  addLocation(@Request() req: any, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: LocationInputDto) {
    return this.portal.addLocation(req.user.id, id, dto);
  }

  @Patch('listings/:id/locations/:locationId')
  updateLocation(
    @Request() req: any,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('locationId', new ParseUUIDPipe()) locationId: string,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.portal.updateLocation(req.user.id, id, locationId, dto);
  }

  @Delete('listings/:id/locations/:locationId')
  deleteLocation(
    @Request() req: any,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('locationId', new ParseUUIDPipe()) locationId: string,
  ) {
    return this.portal.deleteLocation(req.user.id, id, locationId);
  }

  @Post('listings/:id/media')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  uploadMedia(
    @Request() req: any,
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: MediaCaptionDto,
  ) {
    return this.portal.uploadMedia(req.user.id, id, file, dto.caption ?? null, dto.setAsPhoto === true);
  }

  @Delete('listings/:id/media/:mediaId')
  deleteMedia(
    @Request() req: any,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('mediaId', new ParseUUIDPipe()) mediaId: string,
  ) {
    return this.portal.deleteMedia(req.user.id, id, mediaId);
  }

  @Get('geocode')
  geocode(@Query() q: GeocodeQueryDto) {
    return this.portal.geocode(q);
  }

  // ── Claims ──────────────────────────────────────────────────────────────

  @Get('claimable')
  @UseGuards(MemberThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Find an admin-created listing to claim (by business name)' })
  claimable(@Request() req: any, @Query() q: ClaimableQueryDto) {
    return this.portal.claimable(req.user.id, q);
  }

  @Post('claims')
  @UseGuards(MemberThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: '"Claim this business" — request ownership (admin approval required)' })
  @ApiResponse({ status: 409, description: 'Already managed, or a pending claim exists' })
  createClaim(@Request() req: any, @Body() dto: CreateClaimDto) {
    return this.portal.createClaim(req.user.id, dto);
  }

  @Delete('claims/:id')
  @ApiOperation({ summary: 'Withdraw a pending claim' })
  cancelClaim(@Request() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.portal.cancelClaim(req.user.id, id);
  }
}
