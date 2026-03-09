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

export async function sluitPrikbord(prikbordId: string): Promise<{ error?: string }> {
  try {
    const supabase = supabaseAdmin();
    const { error } = await supabase
      .from("prikborden")
      .update({ gesloten: true })
      .eq("id", prikbordId);
    if (error) return { error: error.message };
    return {};
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Onbekende fout." };
  }
}

export async function stuurDefinitieveMail(
  prikbordId: string,
  boodschap: string
): Promise<{ verstuurd: number; error?: string }> {
  try {
    const supabase = supabaseAdmin();

    // Prikbord ophalen → werkgroep_id + titel
    const { data: pb, error: pbErr } = await supabase
      .from("prikborden")
      .select("werkgroep_id, titel, werkgroepen(titel, trekker)")
      .eq("id", prikbordId)
      .maybeSingle();
    if (pbErr) return { verstuurd: 0, error: pbErr.message };
    if (!pb) return { verstuurd: 0, error: "Prikbord niet gevonden." };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wg = pb.werkgroepen as any;
    const trekker: string = wg?.trekker ?? "";
    const werkgroepTitel: string = wg?.titel ?? "";
    const werkgroepId: string = pb.werkgroep_id as string;

    // Actieve leden ophalen
    const { data: wd, error: wdErr } = await supabase
      .from("werkgroep_deelnemers")
      .select("vrijwilliger_id")
      .eq("werkgroep_id", werkgroepId);
    if (wdErr) return { verstuurd: 0, error: wdErr.message };

    const vrijwilligerIds = (wd ?? []).map((r) => r.vrijwilliger_id as string).filter(Boolean);
    if (vrijwilligerIds.length === 0) return { verstuurd: 0 };

    const { data: vv, error: vErr } = await supabase
      .from("vrijwilligers")
      .select("user_id, voornaam")
      .in("id", vrijwilligerIds)
      .eq("actief", true);
    if (vErr) return { verstuurd: 0, error: vErr.message };

    type VrijwRow = { user_id: string; voornaam: string | null };
    const actief = (vv ?? [] as VrijwRow[]).filter((r) => !!r.user_id);
    const voornaamByUserId = new Map(actief.map((r) => [r.user_id, r.voornaam ?? ""]));

    const { data: usersData, error: usersErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (usersErr) return { verstuurd: 0, error: usersErr.message };

    const ontvangers = usersData.users
      .filter((u) => voornaamByUserId.has(u.id) && !!u.email)
      .map((u) => ({ email: u.email as string, voornaam: voornaamByUserId.get(u.id) ?? "" }));

    if (ontvangers.length === 0) return { verstuurd: 0 };

    const onderwerp = `Waaranders - werkgroep ${werkgroepTitel}: definitief moment`;
    const resend = new Resend(process.env.RESEND_API_KEY);
    await Promise.all(
      ontvangers.map(({ email, voornaam }) =>
        resend.emails.send({
          from: "Waaranders <onboarding@resend.dev>",
          to: email,
          subject: onderwerp,
          text: `Beste ${voornaam},\n\n${boodschap}\n\nMet Waaranderse groeten,\n${trekker}`,
        })
      )
    );

    return { verstuurd: ontvangers.length };
  } catch (e: unknown) {
    return { verstuurd: 0, error: e instanceof Error ? e.message : "Onbekende fout." };
  }
}
