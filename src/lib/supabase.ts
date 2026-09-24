import { createClient } from '@supabase/supabase-js';

// Clean the Supabase URL
const metaEnv = (import.meta as any).env || {};
const rawUrl = (metaEnv.VITE_SUPABASE_URL || 'https://vbgeuofwhyylsiajttxq.supabase.co/rest/v1/').replace(/\/rest\/v1\/?$/, '');
const anonKey = metaEnv.VITE_SUPABASE_ANON_KEY || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiZ2V1b2Z3aHl5bHNpYWp0dHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MTEzMzgsImV4cCI6MjEwMzk4NzMzOH0.HyZsb3TcuQs7gNWGgqDZuc_Hc--poJGGQ3YraujmHrE';

export const supabase = createClient(rawUrl, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  }
});
