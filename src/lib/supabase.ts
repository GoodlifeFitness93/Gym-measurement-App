import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Read from env or local storage overrides
const getEnvConfig = () => {
  const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  const localUrl = localStorage.getItem('FITTRACK_SUPABASE_URL') || '';
  const localKey = localStorage.getItem('FITTRACK_SUPABASE_ANON_KEY') || '';

  const url = (localUrl || envUrl).trim();
  const key = (localKey || envKey).trim();

  return { url, key };
};

let cachedClient: SupabaseClient | null = null;
let currentUrl = '';
let currentKey = '';

export function isSupabaseConfigured(): boolean {
  const { url, key } = getEnvConfig();
  return Boolean(url && key && url.startsWith('http') && key.length > 10);
}

export function getSupabase(): SupabaseClient | null {
  const { url, key } = getEnvConfig();

  if (!url || !key || !url.startsWith('http') || key.length < 10) {
    return null;
  }

  if (cachedClient && currentUrl === url && currentKey === key) {
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
    currentUrl = url;
    currentKey = key;
    return cachedClient;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
}

export function saveSupabaseConfig(url: string, key: string) {
  if (url) localStorage.setItem('FITTRACK_SUPABASE_URL', url.trim());
  else localStorage.removeItem('FITTRACK_SUPABASE_URL');

  if (key) localStorage.setItem('FITTRACK_SUPABASE_ANON_KEY', key.trim());
  else localStorage.removeItem('FITTRACK_SUPABASE_ANON_KEY');

  cachedClient = null;
}

export function getSupabaseConfig() {
  return getEnvConfig();
}
