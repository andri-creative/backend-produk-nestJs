import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PostgresService } from './postgres.service';

function isEnabled(value?: string | boolean): boolean {
  if (typeof value === 'boolean') return value;
  return value === 'true' || value === '1' || value === 'yes';
}

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
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const enabled = isEnabled(configService.get('POSTGRES_ENABLED'));

        if (!enabled) {
          return {
            dialect: 'postgres',
            autoLoadModels: false,
            synchronize: false,
          };
        }

        const databaseUrl = configService.get('DATABASE_URL');
        const parsed = databaseUrl ? parseDatabaseUrl(databaseUrl) : null;

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
          synchronize: false, // NEVER true in production
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
