import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { randomUUID } from 'crypto';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Skip health checks
    if (request.url === '/health') {
      return next.handle();
    }

    const requestId = randomUUID();
    const method = request.method;
    // Log the route path only. Query strings can contain OAuth codes, reset
    // tokens, invitation tokens, and other credentials.
    const url = request.path ?? request.url?.split('?')[0];
    const userId = request.user?.id ?? 'anonymous';
    const start = Date.now();

    response.setHeader('X-Request-Id', requestId);

    return next.handle().pipe(
      tap({
        next: () => {
          const latencyMs = Date.now() - start;
          this.logger.log(
            JSON.stringify({
              requestId,
              method,
              url,
              userId,
              statusCode: response.statusCode,
              latencyMs,
            }),
          );
        },
        error: (err) => {
          const latencyMs = Date.now() - start;
          this.logger.warn(
            JSON.stringify({
              requestId,
              method,
              url,
              userId,
              statusCode: err.status ?? 500,
              latencyMs,
              error: err.message,
            }),
          );
        },
      }),
    );
  }
}
