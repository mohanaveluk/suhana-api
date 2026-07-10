import { PartialType } from '@nestjs/swagger';
import { CreateSafetyTipDto } from './create-safety-tip.dto';

export class UpdateSafetyTipDto extends PartialType(CreateSafetyTipDto) {}
