import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = "https://gmpvaxfyawnqbdyyybbf.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtcHZheGZ5YXducWJkeXl5YmJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzNDIzNjQsImV4cCI6MjA4MTkxODM2NH0.0bAXNixUdto8r0vXU89f8NFhQQqWIQV4DjghFqp3hEc";
let supabase: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

export function getSupabaseClient(): SupabaseClient {
  if (!supabase) {
    throw new Error("Supabase env vars are not configured");
  }
  return supabase;
}
