import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RootPage() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // in sommige contexts is cookies() read-only; ok
          }
        },
      },
    }
  );

  // ✅ SSR-robust: haal user op (ipv session)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: v, error: vErr } = await supabase
    .from("vrijwilligers")
    .select("voornaam, achternaam, actief")
    .eq("user_id", user.id)
    .maybeSingle();

  // als RLS hier blokkeert zie je dit meteen in logs
  if (vErr) {
    console.error("RootPage vrijwilligers lookup error:", vErr.message);
    redirect("/login");
  }

  if (!v || v.actief === false) redirect("/login?blocked=1");

  if (!v.voornaam || !v.achternaam) redirect("/profiel");

  redirect("/activiteiten");
}