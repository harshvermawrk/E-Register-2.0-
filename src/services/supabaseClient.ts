import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    })
  : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured. Add the project URL and public key to the local environment file.");
  }
  return supabase;
}

export async function verifyAdminAccess() {
  const client = requireSupabase();
  const { data, error } = await client.rpc("is_e_register_admin");
  if (error) throw new Error(`Admin access could not be checked: ${error.message}`);
  if (data !== true) throw new Error("This account is not approved to use the E-Register admin workspace.");
  return true;
}

export async function signInAdmin(email: string, password: string) {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error("Sign-in did not return an account.");

  try {
    await verifyAdminAccess();
    return data.user;
  } catch (error) {
    await client.auth.signOut();
    throw error;
  }
}

export async function signOutAdmin() {
  const client = requireSupabase();
  const { error } = await client.auth.signOut();
  if (error) throw new Error(`Sign-out failed: ${error.message}`);
}
