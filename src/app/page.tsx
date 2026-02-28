import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export default async function RootPage() {
  // Next.js 16: cookies() is async
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
          // In Server Components kan setten soms niet (read-only). Voor onze redirect-flow is dat ok.
          // Toch proberen we best-effort, zodat het in contexts waar het wél kan (bv. route handlers) blijft werken.
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // ignore
          }
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) redirect("/login");

  const { data: v } = await supabase
    .from("vrijwilligers")
    .select("voornaam, achternaam, actief")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (!v || v.actief === false) redirect("/login?blocked=1");

  if (!v.voornaam || !v.achternaam) redirect("/profiel");

  redirect("/activiteiten");
}