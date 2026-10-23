import { Inject, Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  constructor(
    @Inject('SUPABASE_ENABLED') private readonly enabled: boolean,
    @Inject('SUPABASE_CLIENT') private readonly supabaseClient: SupabaseClient | null,
  ) {}

  private ensureEnabled(): void {
    if (!this.enabled) {
      throw new Error('Supabase feature is disabled (SUPABASE_ENABLED=false)');
    }
    if (!this.supabaseClient) {
      throw new Error('Supabase client is not initialized');
    }
  }

  getClient(): SupabaseClient {
    this.ensureEnabled();
    return this.supabaseClient!;
  }
}