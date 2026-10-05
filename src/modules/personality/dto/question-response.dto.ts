import { ApiProperty } from '@nestjs/swagger';

import { PersonalityDimension } from '../enums/personality.enums';

// Score mappings are deliberately absent — clients never see how options score.
export class PersonalityOptionDto {
  @ApiProperty({ example: 3 }) id: number;
  @ApiProperty({ example: 'NEUTRAL' }) key: string;
  @ApiProperty({ example: 'Neutral' }) text: string;
  @ApiProperty({ example: 3 }) displayOrder: number;
}

export class PersonalityQuestionDto {
  @ApiProperty({ example: 1 }) id: number;
  @ApiProperty({ example: 'EI_01' }) code: string;
  @ApiProperty({ example: 'I enjoy being the center of attention.' })
  text: string;
  @ApiProperty({ enum: PersonalityDimension, example: PersonalityDimension.EI })
  dimension: PersonalityDimension;
  @ApiProperty({ example: 1 }) displayOrder: number;
  @ApiProperty({ type: [PersonalityOptionDto] })
  options: PersonalityOptionDto[];
}

export class PersonalityQuestionsResponseDto {
  @ApiProperty({
    example: 'en',
    description:
      'Locale requested (text falls back to English per item when untranslated)',
  })
  locale: string;

  @ApiProperty({ example: 32 }) totalQuestions: number;

  @ApiProperty({ type: [PersonalityQuestionDto] })
  questions: PersonalityQuestionDto[];
}
