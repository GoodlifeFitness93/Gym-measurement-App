import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface EnvValidationResult {
  isValid: boolean;
  urlValid: boolean;
  keyValid: boolean;
  keyIsMasked: boolean;
  urlError?: string;
  keyError?: string;
}

function isValidIso8859String(str: string): boolean {
  if (!str) return false;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code > 255 || code < 32) {
      return false;
    }
  }
  return true;
}

const getEnvConfig = () => {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

  // Allow optional local storage fallback if provided
  const localUrl = (localStorage.getItem('FITTRACK_OVERRIDE_SB_URL') || '').trim();
  const localKey = (localStorage.getItem('FITTRACK_OVERRIDE_SB_KEY') || '').trim();

  const url = localUrl || envUrl;
  const key = localKey || envKey;

  return { url, key, isOverridden: Boolean(localUrl || localKey) };
};

export function validateSupabaseConfig(): EnvValidationResult {
  const { url, key } = getEnvConfig();
  const result: EnvValidationResult = {
    isValid: true,
    urlValid: true,
    keyValid: true,
    keyIsMasked: false,
  };

  if (!url) {
    result.isValid = false;
    result.urlValid = false;
    result.urlError = 'Supabase Project URL is missing.';
  } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
    result.isValid = false;
    result.urlValid = false;
    result.urlError = 'Supabase URL must start with https:// or http://';
  } else if (!isValidIso8859String(url)) {
    result.isValid = false;
    result.urlValid = false;
    result.urlError = 'Supabase URL contains invalid non-ASCII characters.';
  }

  if (!key) {
    result.isValid = false;
    result.keyValid = false;
    result.keyError = 'Supabase Anon Key is missing.';
  } else if (key.includes('•') || key.includes('••••')) {
    result.isValid = false;
    result.keyValid = false;
    result.keyIsMasked = true;
    result.keyError = 'Supabase Anon Key contains masked bullet characters (•) copied from a password field instead of the actual key.';
  } else if (!isValidIso8859String(key)) {
    result.isValid = false;
    result.keyValid = false;
    result.keyError = 'Supabase Anon Key contains invalid non-ISO-8859-1 characters.';
  } else if (key.length < 20) {
    result.isValid = false;
    result.keyValid = false;
    result.keyError = 'Supabase Anon Key is too short (must be a valid anon key).';
  }

  return result;
}

let cachedClient: SupabaseClient | null = null;
let cachedKey = '';
let cachedUrl = '';

export function isSupabaseConfigured(): boolean {
  return validateSupabaseConfig().isValid;
}

export function getSupabase(): SupabaseClient | null {
  const validation = validateSupabaseConfig();
  if (!validation.isValid) {
    return null;
  }

  const { url, key } = getEnvConfig();

  if (cachedClient && cachedUrl === url && cachedKey === key) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    cachedUrl = url;
    cachedKey = key;
    return cachedClient;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
}

export function saveOverrideConfig(url: string, key: string) {
  if (url) localStorage.setItem('FITTRACK_OVERRIDE_SB_URL', url.trim());
  else localStorage.removeItem('FITTRACK_OVERRIDE_SB_URL');

  if (key) localStorage.setItem('FITTRACK_OVERRIDE_SB_KEY', key.trim());
  else localStorage.removeItem('FITTRACK_OVERRIDE_SB_KEY');

  cachedClient = null;
}

export function clearOverrideConfig() {
  localStorage.removeItem('FITTRACK_OVERRIDE_SB_URL');
  localStorage.removeItem('FITTRACK_OVERRIDE_SB_KEY');
  cachedClient = null;
}

export function getSupabaseConfig() {
  return getEnvConfig();
}


