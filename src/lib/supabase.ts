import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  document.getElementById('root')!.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui,sans-serif;background:#f8fafc;padding:24px">
      <div style="text-align:center;max-width:480px">
        <div style="font-size:2rem;margin-bottom:16px">⚙️</div>
        <h2 style="font-size:1.25rem;font-weight:700;color:#0f172a;margin-bottom:8px">Missing environment variables</h2>
        <p style="color:#64748b;font-size:.9rem">VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in your Netlify site environment variables, then redeployed.</p>
      </div>
    </div>`;
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

// detectSessionInUrl processes the URL during client initialization, firing
// PASSWORD_RECOVERY before any onAuthStateChange listener can register.
// Capture the recovery type here so AuthContext can use it as initial state.
export const isInitialPasswordRecovery =
  window.location.pathname === '/reset-password' ||
  new URLSearchParams(window.location.hash.substring(1)).get('type') === 'recovery';

// Capture the OAuth redirect code before any React effect can strip the URL
// (e.g. App.tsx's mount-time history.replaceState for hash-based routing).
// The Supabase client's _initialize() reads the URL synchronously at module
// load, so this is belt-and-suspenders — we also expose it so AuthContext can
// detect that an OAuth flow is in progress and avoid premature redirects.
const _urlParams = new URLSearchParams(window.location.search);
export const oauthRedirectCode: string | null = _urlParams.get('code');

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'pkce',
    detectSessionInUrl: true,
    autoRefreshToken: true,
    persistSession: true,
  },
});
