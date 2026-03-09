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

type Ontvanger = { email: string; voornaam: string };

async function haalOntvangers(werkgroepId: string): Promise<{
  ontvangers: Ontvanger[];
  trekker: string;
  werkgroepTitel: string;
  error?: string;
}> {
  const supabase = supabaseAdmin();

  const { data: wg, error: wgErr } = await supabase
    .from("werkgroepen")
    .select("titel, trekker")
    .eq("id", werkgroepId)
    .maybeSingle();
  if (wgErr) return { ontvangers: [], trekker: "", werkgroepTitel: "", error: wgErr.message };

  const { data: wd, error: wdErr } = await supabase
    .from("werkgroep_deelnemers")
    .select("vrijwilliger_id")
    .eq("werkgroep_id", werkgroepId);
  if (wdErr) return { ontvangers: [], trekker: "", werkgroepTitel: "", error: wdErr.message };

  const vrijwilligerIds = (wd ?? []).map((r) => r.vrijwilliger_id as string).filter(Boolean);
  if (vrijwilligerIds.length === 0) {
    return { ontvangers: [], trekker: wg?.trekker ?? "", werkgroepTitel: wg?.titel ?? "" };
  }

  const { data: vv, error: vErr } = await supabase
    .from("vrijwilligers")
    .select("user_id, voornaam")
    .in("id", vrijwilligerIds)
    .eq("actief", true);
  if (vErr) return { ontvangers: [], trekker: "", werkgroepTitel: "", error: vErr.message };

  type VrijwRow = { user_id: string; voornaam: string | null };
  const actieveVrijwilligers = (vv ?? [] as VrijwRow[]).filter((r) => !!r.user_id);
  const voornaamByUserId = new Map(actieveVrijwilligers.map((r) => [r.user_id, r.voornaam ?? ""]));

  const { data: usersData, error: usersErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (usersErr) return { ontvangers: [], trekker: "", werkgroepTitel: "", error: usersErr.message };

  const ontvangers = usersData.users
    .filter((u) => voornaamByUserId.has(u.id) && !!u.email)
    .map((u) => ({ email: u.email as string, voornaam: voornaamByUserId.get(u.id) ?? "" }));

  return { ontvangers, trekker: wg?.trekker ?? "", werkgroepTitel: wg?.titel ?? "" };
}

export async function stuurMailNaarWerkgroep(
  werkgroepId: string,
  boodschap: string
): Promise<{ verstuurd: number; error?: string }> {
  try {
    const { ontvangers, trekker, werkgroepTitel, error } = await haalOntvangers(werkgroepId);
    if (error) return { verstuurd: 0, error };
    if (ontvangers.length === 0) return { verstuurd: 0 };

    const onderwerp = `Waaranders - werkgroep ${werkgroepTitel}`;
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
    return { verstuurd: 0, error: e instanceof Error ? e.message : "Onbekende fout bij het versturen." };
  }
}

export type MomentInput = {
  datum: string;
  beginuur: string | null;
  einduur: string | null;
};

export async function maakPrikbordAan(
  werkgroepId: string,
  titel: string,
  momenten: MomentInput[]
): Promise<{ prikbordId: string; verstuurd: number; error?: string }> {
  try {
    const supabase = supabaseAdmin();

    // 1) Prikbord aanmaken
    const { data: pb, error: pbErr } = await supabase
      .from("prikborden")
      .insert({ werkgroep_id: werkgroepId, titel })
      .select("id")
      .single();
    if (pbErr) return { prikbordId: "", verstuurd: 0, error: pbErr.message };

    // 2) Momenten aanmaken
    if (momenten.length > 0) {
      const { error: mErr } = await supabase.from("prikbord_momenten").insert(
        momenten.map((m) => ({
          prikbord_id: pb.id,
          datum: m.datum,
          beginuur: m.beginuur || null,
          einduur: m.einduur || null,
        }))
      );
      if (mErr) return { prikbordId: pb.id, verstuurd: 0, error: mErr.message };
    }

    // 3) Mail versturen naar actieve leden
    const { ontvangers, trekker, werkgroepTitel, error: ontvErr } = await haalOntvangers(werkgroepId);
    if (ontvErr) return { prikbordId: pb.id, verstuurd: 0, error: ontvErr };

    if (ontvangers.length > 0) {
      const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
      const link = `${baseUrl}/prikbord/${pb.id}`;
      const onderwerp = `Waaranders - prikbord: ${titel}`;
      const resend = new Resend(process.env.RESEND_API_KEY);
      await Promise.all(
        ontvangers.map(({ email, voornaam }) =>
          resend.emails.send({
            from: "Waaranders <onboarding@resend.dev>",
            to: email,
            subject: onderwerp,
            html: `<p>Beste ${voornaam},</p><p>De trekker van jouw werkgroep ${werkgroepTitel} wil een werkmoment plannen.</p><p><a href="${link}">Klik hier om je beschikbaarheid in te geven</a></p><p>Met Waaranderse groeten,<br>${trekker}</p>`,
            text: `Beste ${voornaam},\n\nDe trekker van jouw werkgroep ${werkgroepTitel} wil een werkmoment plannen.\n\nKlik hier om je beschikbaarheid in te geven:\n${link}\n\nMet Waaranderse groeten,\n${trekker}`,
          })
        )
      );
    }

    return { prikbordId: pb.id, verstuurd: ontvangers.length };
  } catch (e: unknown) {
    return { prikbordId: "", verstuurd: 0, error: e instanceof Error ? e.message : "Onbekende fout." };
  }
}
