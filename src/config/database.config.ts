import { registerAs } from '@nestjs/config';

export interface DatabaseConfig {
  postgres: {
    enabled: boolean;
    url: string;
  };
  mongo: {
    enabled: boolean;
    url: string;
  };
  redis: {
    enabled: boolean;
    url: string;
  };
}

function isEnabled(value?: string): boolean {
  return value === 'true' || value === '1' || value === 'yes';
}

export default registerAs('database', (): DatabaseConfig => {
  const postgresEnabled = isEnabled(process.env.POSTGRES_ENABLED);
  const mongoEnabled = isEnabled(process.env.MONGO_ENABLED);
  const redisEnabled = isEnabled(process.env.REDIS_ENABLED);

  const databaseUrl = process.env.DATABASE_URL;
  const mongodbUrl = process.env.MONGODB_URL;
  const redisUrl = process.env.REDIS_URL;

  if (postgresEnabled && !databaseUrl) {
    throw new Error('POSTGRES_ENABLED=true but DATABASE_URL is missing');
  }
  if (mongoEnabled && !mongodbUrl) {
    throw new Error('MONGO_ENABLED=true but MONGODB_URL is missing');
  }
  if (redisEnabled && !redisUrl) {
    throw new Error('REDIS_ENABLED=true but REDIS_URL is missing');
  }

  return {
    postgres: {
      enabled: postgresEnabled,
      url: databaseUrl ?? '',
    },
    mongo: {
      enabled: mongoEnabled,
      url: mongodbUrl ?? '',
    },
    redis: {
      enabled: redisEnabled,
      url: redisUrl ?? '',
    },
  };
});
