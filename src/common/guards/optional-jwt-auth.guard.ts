import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

/**
 * Populates `request.user` when a valid Bearer token is present, and does
 * nothing when it is missing or invalid — the request always proceeds.
 *
 * Use on endpoints that are public but behave differently for a signed-in
 * member (e.g. `GET /profiles/:id`, which records a visit only when it knows
 * who is viewing).
 */
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header: string | undefined = request.headers?.authorization;
    const [scheme, token] = header ? header.split(' ') : [];

    if (scheme === 'Bearer' && token) {
      try {
        const payload = await this.jwtService.verifyAsync(token, {
          secret: process.env.JWT_SECRET || 'your-secret-key',
        });
        // Token payloads carry the user id as both `sub` and `id`; normalise to
        // `id` so downstream code can rely on `req.user.id`.
        request.user = { ...payload, id: payload.sub ?? payload.id };
      } catch {
        // Expired / malformed token → treat as an anonymous visitor.
      }
    }

    return true;
  }
}
