import { createClient } from '@supabase/supabase-js';

export const SUPABASE_PHOTO_BUCKET = 'nomono-checklist-photos';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseAnonKey.includes('__SET') &&
    supabaseUrl.startsWith('https://'),
);

export const supabase = createClient(supabaseUrl || 'https://example.supabase.co', supabaseAnonKey || 'missing-key');
