import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const hasValidConfiguration =
  typeof supabaseUrl === "string" &&
  /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(
    supabaseUrl
  ) &&
  typeof supabaseAnonKey === "string" &&
  supabaseAnonKey.length > 20 &&
  !supabaseAnonKey.startsWith("ISI_");

export const supabase: SupabaseClient | null =
  hasValidConfiguration
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;