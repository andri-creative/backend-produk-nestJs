import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  constructor(
    @Inject('REDIS_ENABLED') private readonly enabled: boolean,
    @Inject('REDIS_CLIENT') private readonly client: Redis | null,
  ) {}

  private ensureEnabled(): void {
    if (!this.enabled) {
      throw new Error('Redis feature is disabled (REDIS_ENABLED=false)');
    }
    if (!this.client) {
      throw new Error('Redis client is not initialized');
    }
  }

  getClient(): Redis {
    this.ensureEnabled();
    return this.client!;
  }

  async ping(): Promise<{ success: boolean; latencyMs: number; error?: string }> {
    if (!this.enabled) {
      return { success: false, latencyMs: 0, error: 'Redis is disabled' };
    }
    if (!this.client) {
      return { success: false, latencyMs: 0, error: 'Redis client not initialized' };
    }

    const start = Date.now();
    try {
      await this.client.ping();
      return { success: true, latencyMs: Date.now() - start };
    } catch (error) {
      return {
        success: false,
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
