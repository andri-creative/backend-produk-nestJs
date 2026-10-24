import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import supabaseConfig from '../../config/supabase.config';
import { SupabaseService } from './supabase.service';

@Module({
  imports: [ConfigModule.forFeature(supabaseConfig)],
  providers: [
    SupabaseService,
    {
      provide: 'SUPABASE_ENABLED',
      useFactory: (config: ReturnType<typeof supabaseConfig>) => config.enabled,
      inject: [supabaseConfig.KEY],
    },
    {
      provide: 'SUPABASE_CLIENT',
      useFactory: (config: ReturnType<typeof supabaseConfig>) => {
        if (!config.enabled) return null;

        if (!config.url || !config.serviceRoleKey) {
          throw new Error(
            'SUPABASE_ENABLED is true but SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing',
          );
        }

        return createClient(config.url, config.serviceRoleKey, {
          auth: {
            autoRefreshToken: true,
            persistSession: false,
          },
        });
      },
      inject: [supabaseConfig.KEY],
    },
  ],
  exports: [SupabaseService],
})
export class SupabaseModule {}