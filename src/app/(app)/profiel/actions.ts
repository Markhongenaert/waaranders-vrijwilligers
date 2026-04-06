"use server";

import { supabaseServer } from "@/lib/supabase/server";
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

const FROM = "Waaranders <noreply@waaranders.be>";
const REPLY_TO = "info@waaranders.be";

type WerkgroepInfo = {
  titel: string;
  coordinator_id: string | null;
};

type VrijwillligerInfo = {
  voornaam: string;
  achternaam: string;
  email: string | null;
};

async function getWerkgroepInfo(
  admin: ReturnType<typeof supabaseAdmin>,
  werkgroepId: string
): Promise<WerkgroepInfo | null> {
  const { data } = await admin
    .from("werkgroepen")
    .select("titel, coordinator_id")
    .eq("id", werkgroepId)
    .maybeSingle();
  return data ?? null;
}

async function getVrijwillligerInfo(
  admin: ReturnType<typeof supabaseAdmin>,
  vrijwilligerId: string
): Promise<VrijwillligerInfo | null> {
  const { data: vr } = await admin
    .from("vrijwilligers")
    .select("voornaam, achternaam")
    .eq("id", vrijwilligerId)
    .maybeSingle();
  if (!vr) return null;

  const { data: authData } = await admin.auth.admin.getUserById(vrijwilligerId);
  return {
    voornaam: vr.voornaam ?? "",
    achternaam: vr.achternaam ?? "",
    email: authData.user?.email ?? null,
  };
}

async function sendInschrijvingMails(
  vrijwilligerId: string,
  werkgroepId: string
): Promise<void> {
  const admin = supabaseAdmin();
  const resend = new Resend(process.env.RESEND_API_KEY);

  const [wg, vrijwilliger] = await Promise.all([
    getWerkgroepInfo(admin, werkgroepId),
    getVrijwillligerInfo(admin, vrijwilligerId),
  ]);

  if (!wg || !vrijwilliger) return;

  const wgTitel = wg.titel;
  const vrVoornaam = vrijwilliger.voornaam;
  const vrNaam = `${vrijwilliger.voornaam} ${vrijwilliger.achternaam}`.trim();
  const vrEmail = vrijwilliger.email;

  // Coordinator ophalen
  let coordinatorNaam = "Het Waaranders-team";
  let coordinatorVoornaam = "";
  let coordinatorEmail: string | null = null;

  if (wg.coordinator_id) {
    const coord = await getVrijwillligerInfo(admin, wg.coordinator_id);
    if (coord) {
      coordinatorNaam = `${coord.voornaam} ${coord.achternaam}`.trim() || "Het Waaranders-team";
      coordinatorVoornaam = coord.voornaam;
      coordinatorEmail = coord.email;
    }
  }

  const mails: Promise<unknown>[] = [];

  // Mail 1: naar de vrijwilliger die zich inschrijft
  if (vrEmail) {
    mails.push(
      resend.emails.send({
        from: FROM,
        replyTo: REPLY_TO,
        to: vrEmail,
        subject: `Welkom bij ${wgTitel}`,
        text: `Beste ${vrVoornaam},\n\nJe bent ingeschreven voor de werkgroep ${wgTitel} bij Waaranders. Hartelijk welkom!\n\nMet Waaranderse groeten,\n${coordinatorVoornaam || coordinatorNaam}`,
      }).catch((e) => console.error("Fout bij mail 1 (inschrijving vrijwilliger):", e))
    );
  }

  // Mail 2: naar de trekker van de werkgroep
  if (wg.coordinator_id && coordinatorEmail) {
    mails.push(
      resend.emails.send({
        from: FROM,
        replyTo: REPLY_TO,
        to: coordinatorEmail,
        subject: `Nieuwe inschrijving voor ${wgTitel}`,
        text: `Beste ${coordinatorVoornaam},\n\n${vrNaam} heeft zich ingeschreven voor de werkgroep ${wgTitel}.\n\nMet vriendelijke groeten,\nHet Waaranders-team`,
      }).catch((e) => console.error("Fout bij mail 2 (inschrijving trekker):", e))
    );
  }

  await Promise.all(mails);
}

async function sendUitschrijvingMails(
  vrijwilligerId: string,
  werkgroepId: string
): Promise<void> {
  const admin = supabaseAdmin();
  const resend = new Resend(process.env.RESEND_API_KEY);

  const [wg, vrijwilliger] = await Promise.all([
    getWerkgroepInfo(admin, werkgroepId),
    getVrijwillligerInfo(admin, vrijwilligerId),
  ]);

  if (!wg || !vrijwilliger) return;

  const wgTitel = wg.titel;
  const vrVoornaam = vrijwilliger.voornaam;
  const vrNaam = `${vrijwilliger.voornaam} ${vrijwilliger.achternaam}`.trim();
  const vrEmail = vrijwilliger.email;

  // Coordinator ophalen
  let coordinatorNaam = "Het Waaranders-team";
  let coordinatorVoornaam = "";
  let coordinatorEmail: string | null = null;

  if (wg.coordinator_id) {
    const coord = await getVrijwillligerInfo(admin, wg.coordinator_id);
    if (coord) {
      coordinatorNaam = `${coord.voornaam} ${coord.achternaam}`.trim() || "Het Waaranders-team";
      coordinatorVoornaam = coord.voornaam;
      coordinatorEmail = coord.email;
    }
  }

  const mails: Promise<unknown>[] = [];

  // Mail 3: naar de vrijwilliger die zich uitschrijft
  if (vrEmail) {
    mails.push(
      resend.emails.send({
        from: FROM,
        replyTo: REPLY_TO,
        to: vrEmail,
        subject: `Je uitschrijving bij ${wgTitel}`,
        text: `Beste ${vrVoornaam},\n\nJe hebt je uitgeschreven bij de werkgroep ${wgTitel}. Jammer, maar je kan je op elk moment opnieuw inschrijven via je profiel in de app.\n\nMet vriendelijke groeten,\n${coordinatorNaam}`,
      }).catch((e) => console.error("Fout bij mail 3 (uitschrijving vrijwilliger):", e))
    );
  }

  // Mail 4: naar de trekker bij uitschrijving
  if (wg.coordinator_id && coordinatorEmail) {
    mails.push(
      resend.emails.send({
        from: FROM,
        replyTo: REPLY_TO,
        to: coordinatorEmail,
        subject: `Uitschrijving bij ${wgTitel}`,
        text: `Beste ${coordinatorVoornaam},\n\n${vrNaam} heeft zich uitgeschreven bij de werkgroep ${wgTitel}.\n\nMet vriendelijke groeten,\nHet Waaranders-team`,
      }).catch((e) => console.error("Fout bij mail 4 (uitschrijving trekker):", e))
    );
  }

  await Promise.all(mails);
}

export async function schrijfIn(
  werkgroepId: string
): Promise<{ ok: boolean; error?: string }> {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { ok: false, error: "Niet ingelogd." };

  const { error } = await db
    .from("werkgroep_deelnemers")
    .insert({ vrijwilliger_id: user.id, werkgroep_id: werkgroepId });
  if (error) return { ok: false, error: error.message };

  try {
    await sendInschrijvingMails(user.id, werkgroepId);
  } catch (e) {
    console.error("Onverwachte fout bij inschrijving mails:", e);
  }

  return { ok: true };
}

export async function schrijfUit(
  werkgroepId: string
): Promise<{ ok: boolean; error?: string }> {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { ok: false, error: "Niet ingelogd." };

  const { error } = await db
    .from("werkgroep_deelnemers")
    .delete()
    .eq("vrijwilliger_id", user.id)
    .eq("werkgroep_id", werkgroepId);
  if (error) return { ok: false, error: error.message };

  try {
    await sendUitschrijvingMails(user.id, werkgroepId);
  } catch (e) {
    console.error("Onverwachte fout bij uitschrijving mails:", e);
  }

  return { ok: true };
}
