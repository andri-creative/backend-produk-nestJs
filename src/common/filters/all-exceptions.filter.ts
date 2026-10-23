import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost } from '@nestjs/core';
import { ApiResponse, ApiResponseStatus } from '../../shared/types/api-response.type';
import { WarningException } from '../exceptions/warning.exception';
import { buildMeta, RequestWithStartTime } from '../utils/response.util';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');
  private readonly port: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpAdapterHost: HttpAdapterHost,
  ) {
    this.port = Number(this.configService.get('PORT') ?? 32310);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const http = host.switchToHttp();
    const request = http.getRequest<RequestWithStartTime>();
    const response = http.getResponse();

    const isProduction = this.configService.get('NODE_ENV') === 'production';

    let success = false;
    let status: ApiResponseStatus = 'error';
    let statusCode = 500;
    let message = 'Internal server error';
    let data: unknown;
    let errors: string[] | undefined;

    if (exception instanceof WarningException) {
      success = true;
      status = 'warning';
      statusCode = exception.getStatus();

      const payload = exception.getResponse() as {
        message?: string;
        data?: unknown;
      };
      message = payload.message ?? 'Warning';
      data = payload.data;
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const payload = exception.getResponse();

      if (typeof payload === 'string') {
        message = payload;
      } else {
        const detail = payload as {
          message?: string | string[];
          data?: unknown;
        };

        if (Array.isArray(detail.message)) {
          message = 'Validation failed';
          errors = detail.message;
        } else {
          message = detail.message ?? exception.message;
        }
        data = detail.data;
      }
    } else if (exception instanceof Error && !isProduction) {
      errors = [exception.message];
    }

    const body: ApiResponse = {
      success,
      status,
      statusCode,
      message,
      ...(data !== undefined ? { data } : {}),
      ...(errors ? { errors } : {}),
      meta: buildMeta(request, this.port),
    };

    const logLine = `${request.method} ${request.url} ${statusCode} ${body.meta.durationMs}ms :${this.port} - ${message}`;
    const stack = exception instanceof Error ? exception.stack : undefined;

    if (status === 'warning') {
      this.logger.warn(logLine);
    } else if (statusCode >= 500) {
      this.logger.error(logLine, stack);
    } else {
      this.logger.warn(logLine);
    }

    httpAdapter.reply(response, body, statusCode);
  }
}
