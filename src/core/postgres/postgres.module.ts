import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ConfigModule } from '@nestjs/config';
import databaseConfig from '../../config/database.config';
import { PostgresService } from './postgres.service';

function parseDatabaseUrl(url: string) {
  const match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (!match) return null;
  return {
    username: match[1],
    password: match[2],
    host: match[3],
    port: parseInt(match[4], 10),
    database: match[5],
  };
}

@Module({
  imports: [
    SequelizeModule.forRootAsync({
      imports: [ConfigModule.forFeature(databaseConfig)],
      inject: [databaseConfig.KEY],
      useFactory: (config: ReturnType<typeof databaseConfig>) => {
        const { enabled, url } = config.postgres;

        if (!enabled) {
          return {
            dialect: 'postgres',
            autoLoadModels: false,
            synchronize: false,
          };
        }

        const parsed = parseDatabaseUrl(url);
        if (!parsed) {
          throw new Error('DATABASE_URL is required and must be a valid postgresql:// URL');
        }

        return {
          dialect: 'postgres',
          host: parsed.host,
          port: parsed.port,
          username: parsed.username,
          password: parsed.password,
          database: parsed.database,
          autoLoadModels: true,
          synchronize: false,
          logging: false,
          dialectOptions: {
            ssl: { require: true, rejectUnauthorized: false },
          },
        };
      },
    }),
  ],
  providers: [PostgresService],
  exports: [SequelizeModule, PostgresService],
})
export class PostgresModule {}
