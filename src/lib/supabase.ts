import { createClient } from '@supabase/supabase-js';

// Modern Supabase key model prefers VITE_SUPABASE_PUBLISHABLE_KEY
// with fallback to legacy VITE_SUPABASE_ANON_KEY.
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  ''
).trim();

// Runtime defensive check: Alert if someone accidentally passes a service_role or secret key to Vite
if (typeof window !== 'undefined' && supabaseKey) {
  try {
    if (supabaseKey.startsWith('sb_secret_') || supabaseKey.startsWith('service_role')) {
      console.error(
        '[CRITICAL SECURITY WARNING] A Supabase Secret / Service Role key appears to be configured in browser environment variables. Secret keys must NEVER be exposed to the client bundle. Immediately rotate your keys!'
      );
    }
  } catch {
    // Ignore error in checking
  }
}

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseKey &&
  !supabaseUrl.includes('your-project.supabase.co') &&
  !supabaseKey.includes('your-anon-key') &&
  !supabaseKey.includes('your-publishable-key')
);

// Fallback placeholder prevents initialization crash in environments pending configuration
const clientUrl = isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co';
const clientKey = isSupabaseConfigured ? supabaseKey : 'placeholder-anon-key';

export const supabase = createClient(clientUrl, clientKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    flowType: 'pkce', // Use Proof Key for Code Exchange (PKCE) for OAuth and auth flows
  },
  global: {
    headers: {
      'x-application-name': 'davejoe-management-tool',
    },
  },
});
