import {
  Controller, Get, Patch, Post, Delete, Body, Param,
  Query, UseGuards, Request,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  FileTypeValidator,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ProfilesService } from './profiles.service';
import { UpdateProfileDto, SearchProfilesDto } from './dto/profile.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { maxFileSize } from 'src/shared/utils/file-validation.util';

@ApiTags('profiles')
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get()
  @ApiOperation({ summary: 'Search and list profiles with filters' })
  @ApiResponse({ status: 200, description: 'Paginated profile results' })
  findAll(@Query() search: SearchProfilesDto) {
    return this.profilesService.findAll(search);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current user profile' })
  getMyProfile(@Request() req: any) {
    return this.profilesService.findByUserId(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get profile by ID' })
  @ApiResponse({ status: 200, description: 'Profile found' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  findById(@Param('id') id: string) {
    return this.profilesService.findById(id);
  }

  @Patch('new')
  @ApiOperation({ summary: 'Update current user profile' })
  updateProfileNew(@Request() req: any, @Body() dto: UpdateProfileDto) {
    return this.profilesService.update(req.user.id, dto);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update current user profile' })
  updateProfile(@Request() req: any, @Body() dto: UpdateProfileDto) {
    return this.profilesService.update(req.user.id, dto);
  }

  @Post('me/photos')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Add a photo to profile' })
  addPhoto(@Request() req: any, @Body('url') url: string, @Body('isPrimary') isPrimary: boolean) {
    return this.profilesService.addPhoto(req.user.id, url, isPrimary);
  }

  @Post('profile/image')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Upload profile image' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, description: 'Image uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file type or size' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadProfileImage(
    @Request() req,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: maxFileSize }),
          new FileTypeValidator({ fileType: /(jpg|jpeg|png)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.profilesService.uploadProfileImage(req.user.id, file);
  }

  @Delete('me/photos/:photoId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete a photo from profile' })
  deletePhoto(@Request() req: any, @Param('photoId') photoId: string) {
    return this.profilesService.deletePhoto(req.user.id, photoId);
  }
}
