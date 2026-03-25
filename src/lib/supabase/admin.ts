import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client met de service role key.
 * Bypast RLS volledig — gebruik uitsluitend in "use server" code.
 */
export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
