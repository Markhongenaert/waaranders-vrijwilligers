"use server";

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is niet geconfigureerd in de omgeving.");
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export async function stuurMailNaarWerkgroep(
  werkgroepId: string,
  boodschap: string
): Promise<{ verstuurd: number; error?: string }> {
  try {
    const supabase = supabaseAdmin();

    // 1) Werkgroeptitel ophalen voor het onderwerp
    const { data: wg, error: wgErr } = await supabase
      .from("werkgroepen")
      .select("titel, trekker")
      .eq("id", werkgroepId)
      .maybeSingle();

    if (wgErr) return { verstuurd: 0, error: wgErr.message };
    const onderwerp = `Waaranders - werkgroep ${wg?.titel ?? ""}`;
    const trekker = wg?.trekker ?? "";

    // 3) Vrijwilliger-id's ophalen voor deze werkgroep
    const { data: wd, error: wdErr } = await supabase
      .from("werkgroep_deelnemers")
      .select("vrijwilliger_id")
      .eq("werkgroep_id", werkgroepId);

    if (wdErr) return { verstuurd: 0, error: wdErr.message };
    const vrijwilligerIds = (wd ?? []).map((r) => r.vrijwilliger_id as string).filter(Boolean);

    if (vrijwilligerIds.length === 0) return { verstuurd: 0 };

    // 4) user_id en voornaam ophalen uit vrijwilligers tabel
    const { data: vv, error: vErr } = await supabase
      .from("vrijwilligers")
      .select("user_id, voornaam")
      .in("id", vrijwilligerIds);

    if (vErr) return { verstuurd: 0, error: vErr.message };

    type VrijwRow = { user_id: string; voornaam: string | null };
    const vrijwilligers = (vv ?? [] as VrijwRow[]).filter((r) => !!r.user_id);

    if (vrijwilligers.length === 0) return { verstuurd: 0 };

    const voornaamByUserId = new Map(
      vrijwilligers.map((r) => [r.user_id, r.voornaam ?? ""])
    );

    // 5) E-mailadressen ophalen via auth.admin
    const { data: usersData, error: usersErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (usersErr) return { verstuurd: 0, error: usersErr.message };

    const ontvangers = usersData.users
      .filter((u) => voornaamByUserId.has(u.id) && !!u.email)
      .map((u) => ({ email: u.email as string, voornaam: voornaamByUserId.get(u.id) ?? "" }));

    if (ontvangers.length === 0) return { verstuurd: 0 };

    // 6) Gepersonaliseerde mails versturen via Resend
    const resend = new Resend(process.env.RESEND_API_KEY);
    await Promise.all(
      ontvangers.map(({ email, voornaam }) =>
        resend.emails.send({
          from: "Waaranders <onboarding@resend.dev>",
          to: email,
          subject: onderwerp,
          text: `Beste ${voornaam},\n\n${boodschap}\n\nMet Waaranderse groeten,\n\n${trekker}`,
        })
      )
    );

    return { verstuurd: ontvangers.length };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Onbekende fout bij het versturen.";
    return { verstuurd: 0, error: msg };
  }
}
