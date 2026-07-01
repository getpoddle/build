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

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
