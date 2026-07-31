import { Request } from 'express';

export interface RequestContext {
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  deviceType?: string;
  platform?: string;
}

// Best-effort classification of the client from the User-Agent string.
// Kept dependency-free (no ua-parser) — good enough for coarse analytics and
// can be swapped for a richer parser later without touching call sites.
export function deviceTypeFromUserAgent(ua?: string): string | undefined {
  if (!ua) return undefined;
  const s = ua.toLowerCase();
  if (/(ipad|tablet|playbook|silk)|(android(?!.*mobile))/.test(s)) return 'tablet';
  if (/(mobi|iphone|ipod|android.*mobile|windows phone|blackberry)/.test(s)) return 'mobile';
  if (/(bot|crawl|spider|slurp)/.test(s)) return 'bot';
  return 'desktop';
}

export function platformFromUserAgent(ua?: string): string | undefined {
  if (!ua) return undefined;
  const s = ua.toLowerCase();
  if (s.includes('windows')) return 'Windows';
  if (/(iphone|ipad|ipod|ios)/.test(s)) return 'iOS';
  if (s.includes('mac os')) return 'macOS';
  if (s.includes('android')) return 'Android';
  if (s.includes('linux')) return 'Linux';
  return 'Unknown';
}

// Extract the client IP, honouring the first X-Forwarded-For hop when behind a
// proxy / load balancer (Cloud Run), falling back to the socket address.
export function clientIp(req: Request): string | undefined {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  if (Array.isArray(fwd) && fwd.length) return fwd[0];
  return req.ip ?? req.socket?.remoteAddress ?? undefined;
}

export function extractRequestContext(req: Request): RequestContext {
  const ua = req.headers['user-agent'];
  const user = (req as any).user;
  return {
    userId: user?.id ?? user?.uguid,
    ipAddress: clientIp(req),
    userAgent: ua,
    deviceType: deviceTypeFromUserAgent(ua),
    platform: platformFromUserAgent(ua),
  };
}
