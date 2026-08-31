import { createClient } from "@supabase/supabase-js";

// Get these from your Supabase project: Settings -> API
//   VITE_SUPABASE_URL      = "Project URL"
//   VITE_SUPABASE_ANON_KEY = "anon public" key (NOT the service_role key -
//                             that one must never be used in frontend code)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);