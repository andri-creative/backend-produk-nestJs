import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';

@Injectable()
export class PostgresService {
  constructor(
    @InjectConnection()
    private readonly sequelize: Sequelize,
  ) {}

  async ping(): Promise<{ success: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      await this.sequelize.authenticate();
      const latencyMs = Date.now() - start;
      return { success: true, latencyMs };
    } catch (error) {
      const latencyMs = Date.now() - start;
      return {
        success: false,
        latencyMs,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  getSequelize(): Sequelize {
    return this.sequelize;
  }
}
