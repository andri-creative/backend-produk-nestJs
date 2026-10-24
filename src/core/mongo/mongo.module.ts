import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongoClient } from 'mongodb';
import databaseConfig from '../../config/database.config';
import { MongoService } from './mongo.service';

function extractDbName(url: string): string {
  const parts = url.split('/');
  return parts[parts.length - 1].split('?')[0];
}

@Module({
  imports: [ConfigModule.forFeature(databaseConfig)],
  providers: [
    MongoService,
    {
      provide: 'MONGO_ENABLED',
      useFactory: (config: ReturnType<typeof databaseConfig>) => config.mongo.enabled,
      inject: [databaseConfig.KEY],
    },
    {
      provide: 'MONGO_DB_NAME',
      useFactory: (config: ReturnType<typeof databaseConfig>) =>
        config.mongo.enabled ? extractDbName(config.mongo.url) : '',
      inject: [databaseConfig.KEY],
    },
    {
      provide: 'MONGO_CLIENT',
      useFactory: (config: ReturnType<typeof databaseConfig>) => {
        if (!config.mongo.enabled) return null;
        return new MongoClient(config.mongo.url);
      },
      inject: [databaseConfig.KEY],
    },
  ],
  exports: [MongoService],
})
export class MongoModule {}
