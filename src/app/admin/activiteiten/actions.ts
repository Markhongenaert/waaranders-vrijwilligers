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
  activiteitId: string,
  boodschap: string
): Promise<{ verstuurd: number; error?: string }> {
  try {
    const supabase = supabaseAdmin();

    const { data: act, error: actErr } = await supabase
      .from("activiteiten")
      .select("titel")
      .eq("id", activiteitId)
      .maybeSingle();
    if (actErr) return { verstuurd: 0, error: actErr.message };

    const titel = act?.titel ?? "activiteit";

    const { data: meedoenRows, error: mErr } = await supabase
      .from("meedoen")
      .select("vrijwilliger_id")
      .eq("activiteit_id", activiteitId);
    if (mErr) return { verstuurd: 0, error: mErr.message };

    const vrijwilligerIds = (meedoenRows ?? [])
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
            text: `Beste ${voornaam},\n\n${boodschap}\n\nMet vriendelijke groeten,\nhet Waaranders-team`,
          });
          return true;
        } catch (e) {
          console.error(`Mail naar ${email} mislukt:`, e);
          return false;
        }
      })
    );

    const verstuurd = resultaten.filter(Boolean).length;
    return { verstuurd };
  } catch (e: unknown) {
    return { verstuurd: 0, error: e instanceof Error ? e.message : "Onbekende fout." };
  }
}
