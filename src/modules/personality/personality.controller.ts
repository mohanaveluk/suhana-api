import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { Public } from 'src/common/decorators/public.decorator';
import { PersonalityService } from './personality.service';
import { PersonalityQuestionsQueryDto } from './dto/questions-query.dto';
import { StartAssessmentDto } from './dto/start-assessment.dto';
import { SubmitAssessmentDto } from './dto/submit-assessment.dto';
import {
  CompatibilityParamsDto,
  ProfileIdParamDto,
} from './dto/personality-params.dto';
import { PersonalityQuestionsResponseDto } from './dto/question-response.dto';
import {
  AssessmentResultDto,
  StartAssessmentResponseDto,
} from './dto/assessment-result.dto';
import { PersonalityCompatibilityResponseDto } from './dto/compatibility-result.dto';

@ApiTags('Personality Assessment')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('personality')
export class PersonalityController {
  constructor(private readonly personalityService: PersonalityService) {}

  // GET /api/v1/personality/questions
  @Get('questions')
  @Public()
  @ApiOperation({
    summary: 'Active assessment questions',
    description:
      'The Aurora Personality Assessment: 32 statements (8 per dimension) in display order, each with five ' +
      'Likert options. Score mappings are never exposed. Public so the questionnaire can be previewed before sign-in.',
  })
  @ApiQuery({ name: 'lang', required: false, example: 'ta' })
  @ApiResponse({ status: 200, type: PersonalityQuestionsResponseDto })
  getQuestions(
    @Query() query: PersonalityQuestionsQueryDto,
  ): Promise<PersonalityQuestionsResponseDto> {
    return this.personalityService.getQuestions(query.lang);
  }

  // POST /api/v1/personality/assessment/start
  @Post('assessment/start')
  @ApiOperation({
    summary: 'Start (or resume) an assessment',
    description:
      "Creates an IN_PROGRESS assessment for the member's profile, or returns the open one if it exists.",
  })
  @ApiResponse({ status: 201, type: StartAssessmentResponseDto })
  @ApiResponse({
    status: 403,
    description: 'Profile belongs to another member',
  })
  @ApiResponse({ status: 404, description: 'Member has no profile yet' })
  startAssessment(
    @Request() req: any,
    @Body() dto: StartAssessmentDto,
  ): Promise<StartAssessmentResponseDto> {
    return this.personalityService.startAssessment(req.user, dto);
  }

  // POST /api/v1/personality/assessment/submit
  @Post('assessment/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit answers and get the result',
    description:
      'Scores every answer, determines the four-letter personality type, dimension scores and confidence, ' +
      'persists them and returns the result. Every active question must be answered exactly once. ' +
      "Retaking means starting a new assessment; the latest completed one is the member's current result.",
  })
  @ApiResponse({ status: 200, type: AssessmentResultDto })
  @ApiResponse({
    status: 400,
    description: 'Missing, duplicate or invalid answers',
  })
  @ApiResponse({
    status: 403,
    description: 'Profile belongs to another member',
  })
  @ApiResponse({ status: 404, description: 'Assessment or profile not found' })
  @ApiResponse({ status: 409, description: 'Assessment already submitted' })
  submitAssessment(
    @Request() req: any,
    @Body() dto: SubmitAssessmentDto,
  ): Promise<AssessmentResultDto> {
    return this.personalityService.submitAssessment(req.user, dto);
  }

  // GET /api/v1/personality/profile/me  (declared before :profileId so "me" isn't captured as an id)
  @Get('profile/me')
  @ApiOperation({ summary: 'My current assessment result' })
  @ApiResponse({ status: 200, type: AssessmentResultDto })
  getMyResult(@Request() req: any): Promise<AssessmentResultDto> {
    return this.personalityService.getMyResult(req.user);
  }

  // GET /api/v1/personality/profile/:profileId
  @Get('profile/:profileId')
  @ApiOperation({
    summary: "A profile's current assessment result",
    description:
      'Returns `available: false` with a message when the member has not completed the assessment.',
  })
  @ApiParam({ name: 'profileId' })
  @ApiResponse({ status: 200, type: AssessmentResultDto })
  getProfileResult(
    @Param() params: ProfileIdParamDto,
  ): Promise<AssessmentResultDto> {
    return this.personalityService.getProfileResult(params.profileId);
  }

  // GET /api/v1/personality/match/:profileIdA/:profileIdB
  @Get('match/:profileIdA/:profileIdB')
  @ApiOperation({
    summary: 'Personality compatibility between two profiles',
    description:
      "Compares both members' latest completed assessments and returns a compatibility score, communication style, " +
      'strengths and potential challenges. Returns `available: false` when either member has not completed the assessment.',
  })
  @ApiParam({ name: 'profileIdA' })
  @ApiParam({ name: 'profileIdB' })
  @ApiResponse({ status: 200, type: PersonalityCompatibilityResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Both ids refer to the same profile',
  })
  getCompatibility(
    @Param() params: CompatibilityParamsDto,
  ): Promise<PersonalityCompatibilityResponseDto> {
    return this.personalityService.getCompatibility(
      params.profileIdA,
      params.profileIdB,
    );
  }
}
