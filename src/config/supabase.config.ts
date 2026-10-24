import { registerAs } from '@nestjs/config';

export interface SupabaseConfig {
  enabled: boolean;
  url: string;
  anonKey: string;
  serviceRoleKey: string;
}

function isEnabled(value?: string): boolean {
  return value === 'true' || value === '1' || value === 'yes';
}

export default registerAs('supabase', (): SupabaseConfig => {
  const enabled = isEnabled(process.env.SUPABASE_ENABLED);
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (enabled && (!url || !serviceRoleKey)) {
    throw new Error(
      'SUPABASE_ENABLED=true but SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing',
    );
  }

  return {
    enabled,
    url: url ?? '',
    anonKey: anonKey ?? '',
    serviceRoleKey: serviceRoleKey ?? '',
  };
});
