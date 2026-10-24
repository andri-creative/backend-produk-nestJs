import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import Redis from 'ioredis';
import databaseConfig from '../../config/database.config';
import { RedisService } from './redis.service';

@Module({
  imports: [ConfigModule.forFeature(databaseConfig)],
  providers: [
    RedisService,
    {
      provide: 'REDIS_ENABLED',
      useFactory: (config: ReturnType<typeof databaseConfig>) => config.redis.enabled,
      inject: [databaseConfig.KEY],
    },
    {
      provide: 'REDIS_CLIENT',
      useFactory: (config: ReturnType<typeof databaseConfig>) => {
        if (!config.redis.enabled) return null;
        return new Redis(config.redis.url);
      },
      inject: [databaseConfig.KEY],
    },
  ],
  exports: [RedisService],
})
export class RedisModule {}
