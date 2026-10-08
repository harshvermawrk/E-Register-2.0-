import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

type SupabaseClientInstance = ReturnType<typeof createClient<any>>;
const hotData = import.meta.hot?.data as { supabase?: SupabaseClientInstance } | undefined;

export const supabase = isSupabaseConfigured
  ? hotData?.supabase ?? createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
  })
  : null;

if (import.meta.hot && supabase) {
  import.meta.hot.data.supabase = supabase;
}

export function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured. Add the project URL and public key to the local environment file.");
  }
  return supabase;
}

export function getPasswordResetRedirectUrl() {
  const configuredRedirectOrigin = import.meta.env.VITE_SUPABASE_REDIRECT_URL?.trim();
  if (configuredRedirectOrigin) {
    let redirectOrigin: URL;
    try {
      redirectOrigin = new URL(configuredRedirectOrigin);
    } catch {
      throw new Error("The password recovery redirect URL is invalid. Check the app's public configuration.");
    }
    if (redirectOrigin.protocol !== "https:" && redirectOrigin.protocol !== "http:") {
      throw new Error("Password recovery requires an HTTP or HTTPS web app URL.");
    }
    return new URL("/?auth=reset-password", redirectOrigin.origin).toString();
  }

  if (typeof window === "undefined" || window.location.protocol === "file:") {
    throw new Error("Password recovery from the desktop app requires a hosted web app URL configured as VITE_SUPABASE_REDIRECT_URL.");
  }

  return `${window.location.origin}/?auth=reset-password`;
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
  const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
  if (error) {
    if (error.status === 400 || error.status === 401) {
      throw new Error("Email or password is incorrect. Check your details and try again.");
    }
    throw new Error("Unable to sign in right now. Check your connection and try again.");
  }
  if (!data.user) throw new Error("Sign-in did not return an account.");

  const { data: { session }, error: sessionError } = await client.auth.getSession();
  if (sessionError) {
    await client.auth.signOut();
    throw new Error("The sign-in session could not be verified. Please try again.");
  }
  if (!session || session.user.id !== data.user.id) {
    await client.auth.signOut();
    throw new Error("Sign-in did not create a valid session. Please try again.");
  }

  try {
    await verifyAdminAccess();
    return session.user;
  } catch (error) {
    const { error: signOutError } = await client.auth.signOut();
    if (signOutError) {
      throw new Error("Admin access could not be verified, and sign-in could not be safely ended. Please try again.");
    }
    throw error;
  }
}

export async function requestPasswordReset(email: string) {
  const normalizedEmail = email.trim();
  if (!normalizedEmail) {
    throw new Error("Enter the admin email address to receive the reset link.");
  }

  const client = requireSupabase();
  const { error } = await client.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo: getPasswordResetRedirectUrl(),
  });

  if (error) throw new Error(error.message);
}

export async function updateAdminPassword(password: string) {
  if (password.length < 8) {
    throw new Error("Choose a password with at least 8 characters.");
  }

  const client = requireSupabase();
  const { data: { session }, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw new Error(`The recovery session could not be checked: ${sessionError.message}`);
  if (!session) {
    throw new Error("This password reset link is invalid or expired. Request a new reset email and open its link in the same browser.");
  }

  const { data, error } = await client.auth.updateUser({ password });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error("Password update did not return an account.");
  return data.user;
}

export async function signOutAdmin() {
  const client = requireSupabase();
  const { error } = await client.auth.signOut();
  if (error) throw new Error(`Sign-out failed: ${error.message}`);
}
