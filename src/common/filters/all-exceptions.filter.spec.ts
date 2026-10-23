import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost } from '@nestjs/core';
import { WarningException } from '../exceptions/warning.exception';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  const reply = jest.fn();
  const httpAdapterHost = {
    httpAdapter: { reply },
  } as unknown as HttpAdapterHost;

  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'PORT') return '32310';
      if (key === 'NODE_ENV') return 'test';
      return undefined;
    }),
  } as unknown as ConfigService;

  const request = {
    method: 'POST',
    url: '/auth/login',
    id: 'req-1',
    startTime: Date.now(),
  };

  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
    }),
  } as unknown as ArgumentsHost;

  const filter = new AllExceptionsFilter(configService, httpAdapterHost);

  beforeEach(() => {
    reply.mockClear();
  });

  it('WarningException menghasilkan HTTP 200 dengan status warning', () => {
    filter.catch(
      new WarningException('Postgres disabled', { status: 'disabled' }),
      host,
    );

    const body = reply.mock.calls[0][1];

    expect(reply.mock.calls[0][2]).toBe(200);
    expect(body).toMatchObject({
      success: true,
      status: 'warning',
      statusCode: 200,
      message: 'Postgres disabled',
      data: { status: 'disabled' },
      meta: { method: 'POST', path: '/auth/login', port: 32310 },
    });
  });

  it('HttpException validasi menghasilkan status error dengan errors array', () => {
    filter.catch(
      new BadRequestException({
        message: ['email must be an email', 'password must be a string'],
      }),
      host,
    );

    const body = reply.mock.calls[0][1];

    expect(reply.mock.calls[0][2]).toBe(400);
    expect(body).toMatchObject({
      success: false,
      status: 'error',
      statusCode: 400,
      message: 'Validation failed',
      errors: ['email must be an email', 'password must be a string'],
    });
  });

  it('Error tak terduga menghasilkan 500 dengan pesan aman', () => {
    filter.catch(new Error('boom'), host);

    const body = reply.mock.calls[0][1];

    expect(reply.mock.calls[0][2]).toBe(500);
    expect(body).toMatchObject({
      success: false,
      status: 'error',
      statusCode: 500,
      message: 'Internal server error',
      errors: ['boom'],
    });
  });
});
