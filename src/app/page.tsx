import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export default async function RootPage() {
  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: () => cookieStore }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Niet ingelogd → login
  if (!session?.user) {
    redirect("/login");
  }

  // Vrijwilliger ophalen
  const { data: v } = await supabase
    .from("vrijwilligers")
    .select("voornaam, achternaam, actief")
    .eq("user_id", session.user.id)
    .maybeSingle();

  // Geen vrijwilliger-record of gearchiveerd → login
  if (!v || v.actief === false) {
    redirect("/login?blocked=1");
  }

  // Eerste keer? (naam ontbreekt)
  if (!v.voornaam || !v.achternaam) {
    redirect("/profiel");
  }

  // Normale situatie
  redirect("/activiteiten");
}