import { Test, TestingModule } from '@nestjs/testing';
import { HelpersController } from './helpers.controller';
import { HelpersService } from './helpers.service';

describe('HelpersController', () => {
  let controller: HelpersController;

  const helpersService = {
    getUptime: jest.fn(),
    checkConnections: jest.fn(),
  };

  const uptime = {
    uptimeSeconds: 312,
    uptime: '5 minutes, 12 seconds',
    startedAt: '2026-10-23T10:35:00.000Z',
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HelpersController],
      providers: [{ provide: HelpersService, useValue: helpersService }],
    }).compile();

    controller = module.get<HelpersController>(HelpersController);
  });

  it('should return server uptime on GET /', () => {
    helpersService.getUptime.mockReturnValue(uptime);

    expect(controller.getHome()).toEqual({
      message: 'Server is running',
      uptime: uptime.uptime,
      uptimeSeconds: uptime.uptimeSeconds,
      startedAt: uptime.startedAt,
    });
  });

  it('should return connection statuses on GET /helpers', async () => {
    const connections = {
      postgres: { status: 'up' as const, latencyMs: 3 },
      mongodb: { status: 'up' as const, latencyMs: 5 },
      redis: { status: 'up' as const, latencyMs: 1 },
    };

    helpersService.getUptime.mockReturnValue(uptime);
    helpersService.checkConnections.mockResolvedValue({
      status: 'ok',
      connections,
    });

    await expect(controller.getHelpers()).resolves.toEqual({
      status: 'ok',
      message: 'Service status',
      uptime: uptime.uptime,
      uptimeSeconds: uptime.uptimeSeconds,
      timestamp: expect.any(String),
      connections,
    });
  });
});
