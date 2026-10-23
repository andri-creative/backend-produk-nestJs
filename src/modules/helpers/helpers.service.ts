import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PostgresService } from '../../core/postgres/postgres.service';

export type ConnectionStatus = 'up' | 'down' | 'disabled';

export interface ConnectionResult {
  status: ConnectionStatus;
  latencyMs: number;
  error?: string;
}

export interface UptimeResult {
  uptimeSeconds: number;
  uptime: string;
  startedAt: string;
}

export interface ConnectionsResult {
  status: 'ok' | 'degraded' | 'all_disabled';
  connections: {
    postgres: ConnectionResult;
    mongodb: ConnectionResult;
    redis: ConnectionResult;
  };
}

function isEnabled(value?: string | boolean): boolean {
  if (typeof value === 'boolean') return value;
  return value === 'true' || value === '1' || value === 'yes';
}

@Injectable()
export class HelpersService {
  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly postgresService?: PostgresService,
  ) {}

  getUptime(): UptimeResult {
    const uptimeSeconds = Math.floor(process.uptime());

    return {
      uptimeSeconds,
      uptime: this.formatUptime(uptimeSeconds),
      startedAt: new Date(Date.now() - uptimeSeconds * 1000).toISOString(),
    };
  }

  async checkConnections(): Promise<ConnectionsResult> {
    const postgresEnabled = isEnabled(this.configService.get('POSTGRES_ENABLED'));
    const mongoEnabled = isEnabled(this.configService.get('MONGO_ENABLED'));
    const redisEnabled = isEnabled(this.configService.get('REDIS_ENABLED'));

    const connections = {
      postgres: postgresEnabled
        ? await this.pingPostgres()
        : { status: 'disabled' as const, latencyMs: 0 },
      mongodb: mongoEnabled
        ? await this.pingMongo()
        : { status: 'disabled' as const, latencyMs: 0 },
      redis: redisEnabled
        ? await this.pingRedis()
        : { status: 'disabled' as const, latencyMs: 0 },
    };

    const enabledConnections = Object.values(connections).filter(
      (c) => c.status !== 'disabled',
    );

    let status: 'ok' | 'degraded' | 'all_disabled';
    if (enabledConnections.length === 0) {
      status = 'all_disabled';
    } else if (enabledConnections.every((c) => c.status === 'up')) {
      status = 'ok';
    } else {
      status = 'degraded';
    }

    return { status, connections };
  }

  private async pingPostgres(): Promise<ConnectionResult> {
    if (!this.postgresService) {
      return {
        status: 'down',
        latencyMs: 0,
        error: 'PostgresService not available',
      };
    }

    const result = await this.postgresService.ping();
    return {
      status: result.success ? 'up' : 'down',
      latencyMs: result.latencyMs,
      error: result.error,
    };
  }

  private async pingMongo(): Promise<ConnectionResult> {
    return {
      status: 'down',
      latencyMs: 0,
      error: 'MongoDB client library not installed (mongodb package removed)',
    };
  }

  private async pingRedis(): Promise<ConnectionResult> {
    return {
      status: 'down',
      latencyMs: 0,
      error: 'Redis client library not installed (ioredis package removed)',
    };
  }

  private formatUptime(totalSeconds: number): string {
    const units: Array<[label: string, seconds: number]> = [
      ['day', 86400],
      ['hour', 3600],
      ['minute', 60],
      ['second', 1],
    ];

    let remaining = totalSeconds;
    const parts: string[] = [];

    for (const [label, seconds] of units) {
      const value = Math.floor(remaining / seconds);
      if (value > 0) {
        parts.push(`${value} ${label}${value === 1 ? '' : 's'}`);
        remaining -= value * seconds;
      }
    }

    return parts.length > 0 ? parts.join(', ') : '0 seconds';
  }
}
