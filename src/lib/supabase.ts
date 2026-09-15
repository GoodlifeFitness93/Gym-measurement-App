import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface EnvValidationResult {
  isValid: boolean;
  urlValid: boolean;
  keyValid: boolean;
  urlError?: string;
  keyError?: string;
}

const getEnvConfig = () => {
  const url = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  const key = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
  return { url, key };
};

export function validateSupabaseConfig(): EnvValidationResult {
  const { url, key } = getEnvConfig();
  const result: EnvValidationResult = { isValid: true, urlValid: true, keyValid: true };

  if (!url) {
    result.isValid = false;
    result.urlValid = false;
    result.urlError = 'VITE_SUPABASE_URL is missing.';
  } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
    result.isValid = false;
    result.urlValid = false;
    result.urlError = 'VITE_SUPABASE_URL must start with https:// or http://';
  }

  if (!key) {
    result.isValid = false;
    result.keyValid = false;
    result.keyError = 'VITE_SUPABASE_ANON_KEY is missing.';
  } else if (key.length < 20) {
    result.isValid = false;
    result.keyValid = false;
    result.keyError = 'VITE_SUPABASE_ANON_KEY is too short to be a valid key.';
  }

  return result;
}

let cachedClient: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return validateSupabaseConfig().isValid;
}

export function getSupabase(): SupabaseClient | null {
  const validation = validateSupabaseConfig();
  if (!validation.isValid) {
    console.error('Supabase is not configured:', validation.urlError, validation.keyError);
    return null;
  }

  if (cachedClient) {
    return cachedClient;
  }

  const { url, key } = getEnvConfig();

  try {
    cachedClient = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    return cachedClient;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
}
