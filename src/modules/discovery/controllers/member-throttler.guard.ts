import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate-limits per signed-in member (falls back to IP). Must run after
 * JwtAuthGuard so req.user is populated. Limits are set per handler with
 * @Throttle({ default: { limit, ttl } }); storage/options come from the
 * global ThrottlerModule registered in ChatbotModule.
 */
@Injectable()
export class MemberThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    return req?.user?.id ? `member:${req.user.id}` : (req.ips?.length ? req.ips[0] : req.ip);
  }
}
