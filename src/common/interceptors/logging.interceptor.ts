import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { CustomLoggerService } from '../../modules/logger/custom-logger.service';

// High-frequency polling endpoints — still logged to console/Cloud Logging for live
// debugging, but excluded from the `log` DB table so routine polling doesn't drown out
// meaningful audit rows. Matched as a path suffix, so the leading /api/v1 prefix and any
// dynamic route params before it don't need to be listed here.
const NOISY_PATH_SUFFIXES = ['/user/heartbeat', '/email-history/notifications'];

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: CustomLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const start = Date.now();
    const user = req.user?.email ?? req.user?.id ?? 'anonymous';
    const path = (req.originalUrl as string).split('?')[0];
    const isNoisy = NOISY_PATH_SUFFIXES.some(suffix => path.endsWith(suffix));

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        const message = `[${req.method}] ${req.originalUrl} - ${duration}ms - user=${user}`;
        if (isNoisy) {
          this.logger.logWithoutDb(message, 'HTTP');
        } else {
          this.logger.log(message, 'HTTP');
        }
      }),
      catchError(err => {
        const duration = Date.now() - start;
        this.logger.error(
          `[${req.method}] ${req.originalUrl} - ${duration}ms - user=${user} - ERROR: ${err?.message ?? err}`,
          err?.stack ?? 'HTTP',
        );
        return throwError(() => err);
      }),
    );
  }
}
