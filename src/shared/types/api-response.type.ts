export type ApiResponseStatus = 'success' | 'warning' | 'error';

export interface ApiResponseMeta {
  method: string;
  path: string;
  port: number;
  durationMs: number;
  timestamp: string;
  requestId?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  status: ApiResponseStatus;
  statusCode: number;
  message: string;
  data?: T;
  errors?: string[];
  meta: ApiResponseMeta;
}
