import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { Public } from 'src/common/decorators/public.decorator';
import { SuccessStoriesService } from '../services/success-stories.service';
import { CreateSuccessStoryDto, PublicSuccessStoryQueryDto } from '../dto/success-story.dto';

@ApiTags('Success Stories')
@Controller('success-stories')
export class SuccessStoriesController {
  constructor(private readonly service: SuccessStoriesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Submit a success story (pending admin approval)' })
  @ApiResponse({ status: 201, description: 'Success story submitted' })
  create(@Request() req: any, @Body() dto: CreateSuccessStoryDto) {
    return this.service.create(req.user.id, dto);
  }

  @Public()
  @Get('public/featured')
  @ApiOperation({ summary: 'Featured success stories for the homepage' })
  getFeatured() {
    return this.service.getFeatured();
  }

  @Public()
  @Get('public')
  @ApiOperation({ summary: 'List approved success stories (verified marriages first)' })
  listPublic(@Query() q: PublicSuccessStoryQueryDto) {
    return this.service.listPublic(
      String(q.verifiedOnly) === 'true',
      q.page ?? 1,
      q.limit ?? 20,
    );
  }

  @Public()
  @Get('public/:id')
  @ApiOperation({ summary: 'Success story detail' })
  @ApiParam({ name: 'id' })
  getDetail(@Param('id') id: string) {
    return this.service.getDetail(id);
  }
}
