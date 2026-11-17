import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/** Standard error response envelope returned by all endpoints. */
export interface ErrorResponseBody {
  success: false;
  statusCode: number;
  error: string;
  message: string;
  details?: unknown;
  timestamp: string;
  path: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const extracted = this.extractErrorPayload(exception, status);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}: ${extracted.message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const body: ErrorResponseBody = {
      success: false,
      statusCode: status,
      error: extracted.error,
      message: extracted.message,
      ...(extracted.details !== undefined ? { details: extracted.details } : {}),
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(status).json(body);
  }

  private extractErrorPayload(
    exception: unknown,
    status: number,
  ): { error: string; message: string; details?: unknown } {
    if (!(exception instanceof HttpException)) {
      return {
        error: 'Internal Server Error',
        message: 'Terjadi kesalahan pada server. Silakan coba lagi.',
      };
    }

    const raw = exception.getResponse();
    if (typeof raw === 'string') {
      return { error: HttpStatus[status] ?? 'Error', message: raw };
    }

    const obj = raw as Record<string, unknown>;
    const rawMessage = obj.message;

    if (Array.isArray(rawMessage)) {
      return {
        error: typeof obj.error === 'string' ? obj.error : 'Validation Error',
        message: rawMessage[0] ?? 'Input tidak valid.',
        details: rawMessage,
      };
    }

    return {
      error: typeof obj.error === 'string' ? obj.error : HttpStatus[status] ?? 'Error',
      message: typeof rawMessage === 'string' ? rawMessage : exception.message,
      ...(obj.details !== undefined ? { details: obj.details } : {}),
    };
  }
}

