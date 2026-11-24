import { Controller, HttpCode, Post, Req, UnauthorizedException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from 'src/common/decorators/public.decorator';
import { SmsWebhookService } from './sms-webhook.service';

/**
 * POST /api/v1/sms/webhooks/telnyx — set this as the Webhook URL on the Telnyx messaging profile.
 * Unauthenticated by design; trust comes from the ed25519 signature (TELNYX_PUBLIC_KEY), which is
 * checked against the raw request body. Returns 200 for anything verified (incl. duplicates and
 * unknown ids) so Telnyx doesn't retry forever; 401 for anything unverified.
 */
@ApiExcludeController()
@Controller('sms/webhooks')
export class SmsWebhookController {
  constructor(private readonly webhooks: SmsWebhookService) {}

  @Public()
  @Post('telnyx')
  @HttpCode(200)
  async telnyx(@Req() req: RawBodyRequest<Request>): Promise<{ received: true }> {
    const raw = req.rawBody?.toString('utf8');
    if (!raw) throw new UnauthorizedException();
    try {
      await this.webhooks.verify(raw, req.headers as Record<string, string>);
    } catch {
      throw new UnauthorizedException();
    }
    let event: unknown;
    try {
      event = JSON.parse(raw);
    } catch {
      return { received: true };
    }
    await this.webhooks.handle(event);
    return { received: true };
  }
}
