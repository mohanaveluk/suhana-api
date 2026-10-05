import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';

export class PersonalityQuestionsQueryDto {
  @ApiPropertyOptional({
    example: 'ta',
    description:
      'BCP-47 locale for question and option text (e.g. `ta`, `hi`, `ta-IN`). ' +
      'Falls back to the base language (`ta-IN` → `ta`), then to the default English text.',
  })
  @IsOptional()
  @Matches(/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/, {
    message: 'lang must be a locale code such as "ta" or "ta-IN"',
  })
  lang?: string;
}
