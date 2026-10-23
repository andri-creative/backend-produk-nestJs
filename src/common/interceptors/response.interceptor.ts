import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../../shared/types/api-response.type';
import {
  buildMeta,
  defaultMessage,
  extractMessage,
  isApiResponse,
  RequestWithStartTime,
} from '../utils/response.util';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');
  private readonly port: number;

  constructor(private readonly configService: ConfigService) {
    this.port = Number(this.configService.get('PORT') ?? 32310);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithStartTime>();
    const response = http.getResponse<{ statusCode: number }>();

    request.startTime = Date.now();

    return next.handle().pipe(
      map((payload: unknown) => {
        if (isApiResponse(payload)) return payload;

        const statusCode = response.statusCode;
        const body: ApiResponse = {
          success: true,
          status: 'success',
          statusCode,
          message: extractMessage(payload) ?? defaultMessage(statusCode),
          data: payload,
          meta: buildMeta(request, this.port),
        };

        this.logger.log(
          `${request.method} ${request.url} ${statusCode} ${body.meta.durationMs}ms :${this.port}`,
        );

        return body;
      }),
    );
  }
}
