"use server";

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is niet geconfigureerd.");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export async function stuurMailNaarDeelnemers(
  wandelingId: string,
  boodschap: string
): Promise<{ verstuurd: number; error?: string }> {
  try {
    const supabase = supabaseAdmin();

    const { data: wand, error: wErr } = await supabase
      .from("ezelwandelingen")
      .select("titel")
      .eq("id", wandelingId)
      .maybeSingle();
    if (wErr) return { verstuurd: 0, error: wErr.message };

    const titel = wand?.titel ?? "ezelwandeling";

    const { data: deelnemerRows, error: dErr } = await supabase
      .from("ezelwandeling_deelnemers")
      .select("vrijwilliger_id")
      .eq("wandeling_id", wandelingId);
    if (dErr) return { verstuurd: 0, error: dErr.message };

    const vrijwilligerIds = (deelnemerRows ?? [])
      .map((r) => r.vrijwilliger_id as string)
      .filter(Boolean);
    if (vrijwilligerIds.length === 0) return { verstuurd: 0 };

    const { data: vv, error: vErr } = await supabase
      .from("vrijwilligers")
      .select("user_id, voornaam")
      .in("id", vrijwilligerIds)
      .eq("actief", true);
    if (vErr) return { verstuurd: 0, error: vErr.message };

    const voornaamByUserId = new Map(
      (vv ?? [])
        .filter((r) => !!r.user_id)
        .map((r) => [r.user_id as string, (r.voornaam as string | null) ?? ""])
    );

    const { data: usersData, error: usersErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (usersErr) return { verstuurd: 0, error: usersErr.message };

    type Ontvanger = { email: string; voornaam: string };
    const ontvangers: Ontvanger[] = usersData.users
      .filter((u) => voornaamByUserId.has(u.id) && !!u.email)
      .map((u) => ({ email: u.email as string, voornaam: voornaamByUserId.get(u.id) ?? "" }));

    if (ontvangers.length === 0) return { verstuurd: 0 };

    const resend = new Resend(process.env.RESEND_API_KEY);

    const resultaten = await Promise.all(
      ontvangers.map(async ({ email, voornaam }) => {
        try {
          await resend.emails.send({
            from: "Waaranders <noreply@waaranders.be>",
            replyTo: "info@waaranders.be",
            to: email,
            subject: titel,
            text: `Beste ${voornaam},\n\n${boodschap}\n\nMet vriendelijke groeten,\nhet Waaranders-team\n\nGa naar de Waaranders App: https://waaranders-vrijwilligers.vercel.app`,
          });
          return true;
        } catch (e) {
          console.error(`Mail naar ${email} mislukt:`, e);
          return false;
        }
      })
    );

    return { verstuurd: resultaten.filter(Boolean).length };
  } catch (e: unknown) {
    return { verstuurd: 0, error: e instanceof Error ? e.message : "Onbekende fout." };
  }
}
