import { CallHandler, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, of } from 'rxjs';
import { ResponseInterceptor } from './response.interceptor';

describe('ResponseInterceptor', () => {
  const configService = {
    get: jest.fn((key: string) => (key === 'PORT' ? '32310' : undefined)),
  } as unknown as ConfigService;

  function createContext() {
    const request = {
      method: 'GET',
      url: '/helpers?verbose=1',
      id: 'req-1',
    };
    const response = { statusCode: 200 };

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;

    return { context, request };
  }

  it('membungkus payload dengan envelope success', async () => {
    const interceptor = new ResponseInterceptor(configService);
    const { context, request } = createContext();
    const next = {
      handle: () => of({ message: 'Service status', status: 'ok' }),
    } as CallHandler;

    const result = await firstValueFrom(interceptor.intercept(context, next));

    expect(result).toMatchObject({
      success: true,
      status: 'success',
      statusCode: 200,
      message: 'Service status',
      data: { message: 'Service status', status: 'ok' },
      meta: {
        method: 'GET',
        path: '/helpers',
        port: 32310,
        requestId: 'req-1',
      },
    });
    expect(request.startTime).toEqual(expect.any(Number));
  });

  it('memakai pesan default bila payload tidak punya message', async () => {
    const interceptor = new ResponseInterceptor(configService);
    const { context } = createContext();
    const next = { handle: () => of({ status: 'ok' }) } as CallHandler;

    const result = await firstValueFrom(interceptor.intercept(context, next));

    expect(result).toMatchObject({ message: 'OK', status: 'success' });
  });

  it('tidak membungkus ulang payload yang sudah ApiResponse', async () => {
    const existing = {
      success: true,
      status: 'success',
      statusCode: 200,
      message: 'OK',
      data: {},
      meta: {
        method: 'GET',
        path: '/',
        port: 32310,
        durationMs: 1,
        timestamp: new Date().toISOString(),
      },
    };
    const interceptor = new ResponseInterceptor(configService);
    const { context } = createContext();
    const next = { handle: () => of(existing) } as CallHandler;

    await expect(
      firstValueFrom(interceptor.intercept(context, next)),
    ).resolves.toBe(existing);
  });
});
