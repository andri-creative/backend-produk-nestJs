import { Inject, Injectable } from '@nestjs/common';
import { MongoClient, Db } from 'mongodb';

@Injectable()
export class MongoService {
  constructor(
    @Inject('MONGO_ENABLED') private readonly enabled: boolean,
    @Inject('MONGO_CLIENT') private readonly client: MongoClient | null,
    @Inject('MONGO_DB_NAME') private readonly dbName: string,
  ) {}

  private ensureEnabled(): void {
    if (!this.enabled) {
      throw new Error('MongoDB feature is disabled (MONGO_ENABLED=false)');
    }
    if (!this.client) {
      throw new Error('MongoDB client is not initialized');
    }
  }

  getClient(): MongoClient {
    this.ensureEnabled();
    return this.client!;
  }

  getDb(): Db {
    this.ensureEnabled();
    return this.client!.db(this.dbName);
  }

  async ping(): Promise<{ success: boolean; latencyMs: number; error?: string }> {
    if (!this.enabled) {
      return { success: false, latencyMs: 0, error: 'MongoDB is disabled' };
    }
    if (!this.client) {
      return { success: false, latencyMs: 0, error: 'MongoDB client not initialized' };
    }

    const start = Date.now();
    try {
      await this.client.db().command({ ping: 1 });
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
