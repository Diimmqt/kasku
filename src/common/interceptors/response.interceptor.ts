import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

export interface ApiResponse<T> {
  success: true;
  data: T;
  message?: string;
  meta?: Record<string, unknown>;
}

/** Marker wrapper for services/controllers returning data with pagination meta or custom message. */
export class PaginatedOrMessageResponse<T> {
  constructor(
    public readonly data: T,
    public readonly meta?: Record<string, unknown>,
    public readonly message?: string,
  ) {}
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((payload) => {
        if (payload instanceof PaginatedOrMessageResponse) {
          return {
            success: true as const,
            data: payload.data as T,
            ...(payload.message ? { message: payload.message } : {}),
            ...(payload.meta ? { meta: payload.meta } : {}),
          };
        }
        return {
          success: true as const,
          data: payload,
        };
      }),
    );
  }
}

