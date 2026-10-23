import { Controller, Get } from '@nestjs/common';
import { HelpersService } from './helpers.service';

@Controller()
export class HelpersController {
  constructor(private readonly helpersService: HelpersService) {}

  @Get()
  getHome() {
    const { uptime, uptimeSeconds, startedAt } =
      this.helpersService.getUptime();

    return {
      message: 'Server is running',
      uptime,
      uptimeSeconds,
      startedAt,
    };
  }

  @Get('helpers')
  async getHelpers() {
    const { uptime, uptimeSeconds } = this.helpersService.getUptime();
    const { status, connections } =
      await this.helpersService.checkConnections();

    return {
      status,
      message: 'Service status',
      uptime,
      uptimeSeconds,
      timestamp: new Date().toISOString(),
      connections,
    };
  }
}
