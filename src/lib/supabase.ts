import { createClient } from '@supabase/supabase-js';

const defaultSupabaseUrl = 'https://xahchsuffmskbgvnxcgs.supabase.co';
const defaultSupabaseAnonKey = 'sb_publishable_QprT-ekIg6xv77IwL9p81g_GR5-tdiy';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || defaultSupabaseUrl;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || defaultSupabaseAnonKey;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('your-project')
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

