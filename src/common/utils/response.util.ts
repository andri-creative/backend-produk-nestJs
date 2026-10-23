import { FastifyRequest } from 'fastify';
import { ApiResponseMeta } from '../../shared/types/api-response.type';

export interface RequestWithStartTime extends FastifyRequest {
  startTime?: number;
}

const DEFAULT_MESSAGES: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  204: 'No content',
};

export function defaultMessage(statusCode: number): string {
  return DEFAULT_MESSAGES[statusCode] ?? 'OK';
}

export function buildMeta(
  request: RequestWithStartTime,
  port: number,
): ApiResponseMeta {
  return {
    method: request.method,
    path: request.url.split('?')[0],
    port,
    durationMs: request.startTime ? Date.now() - request.startTime : 0,
    timestamp: new Date().toISOString(),
    requestId: request.id,
  };
}

export function isApiResponse(payload: unknown): boolean {
  if (typeof payload !== 'object' || payload === null) return false;

  const value = payload as Record<string, unknown>;
  return (
    typeof value.success === 'boolean' &&
    typeof value.status === 'string' &&
    typeof value.meta === 'object' &&
    value.meta !== null
  );
}

export function extractMessage(payload: unknown): string | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined;

  const value = payload as Record<string, unknown>;
  return typeof value.message === 'string' ? value.message : undefined;
}
