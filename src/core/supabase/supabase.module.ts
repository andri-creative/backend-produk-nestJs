import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

function isEnabled(value?: string | boolean): boolean {
  if (typeof value === 'boolean') return value;
  return value === 'true' || value === '1' || value === 'yes';
}

@Module({
  providers: [
    SupabaseService,
    {
      provide: 'SUPABASE_ENABLED',
      useFactory: (config: ConfigService) =>
        isEnabled(config.get<string | boolean>('SUPABASE_ENABLED')),
      inject: [ConfigService],
    },
    {
      provide: 'SUPABASE_CLIENT',
      useFactory: (config: ConfigService) => {
        const enabled = isEnabled(config.get<string | boolean>('SUPABASE_ENABLED'));
        if (!enabled) return null;

        const url = config.get<string>('SUPABASE_URL');
        const key = config.get<string>('SUPABASE_SERVICE_ROLE_KEY');

        if (!url || !key) {
          throw new Error(
            'SUPABASE_ENABLED is true but SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing',
          );
        }

        return createClient(url, key, {
          auth: {
            autoRefreshToken: true,
            persistSession: false,
          },
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [SupabaseService],
})
export class SupabaseModule {}