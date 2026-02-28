// src/app/page.tsx
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await supabaseServer();

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) redirect("/login");
  const user = userRes.user;
  if (!user) redirect("/login");

  // Vrijwilliger ophalen
  const { data: v, error: vErr } = await supabase
    .from("vrijwilligers")
    .select("id, actief, profiel_afgewerkt")
    .eq("id", user.id)
    .maybeSingle();

  // Geen vrijwilliger rij? -> stuur naar profiel (profielpagina maakt rij aan)
  if (vErr) redirect("/login");
  if (!v) redirect("/profiel");

  if (v.actief === false) redirect("/login?blocked=1");

  if (!v.profiel_afgewerkt) redirect("/profiel");

  redirect("/activiteiten");
}