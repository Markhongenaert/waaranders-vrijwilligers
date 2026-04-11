"use server";

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is niet geconfigureerd.");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

function formatDatum(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return new Intl.DateTimeFormat("nl-BE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

export async function stuurOpmerkingMail(
  activiteitId: string,
  vrijwilligerNaam: string,
  opmerking: string,
  isUpdate: boolean
): Promise<void> {
  try {
    const supabase = supabaseAdmin();

    const { data: act } = await supabase
      .from("activiteiten")
      .select("titel, wanneer, klant_id")
      .eq("id", activiteitId)
      .maybeSingle();
    if (!act?.klant_id) return;

    const { data: klant } = await supabase
      .from("klanten")
      .select("aanspreekpunt_vrijwilliger_id")
      .eq("id", act.klant_id)
      .maybeSingle();
    if (!klant?.aanspreekpunt_vrijwilliger_id) return;

    const { data: ap } = await supabase
      .from("vrijwilligers")
      .select("user_id, voornaam")
      .eq("id", klant.aanspreekpunt_vrijwilliger_id)
      .maybeSingle();
    if (!ap?.user_id) return;

    const { data: usersData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const apUser = usersData?.users.find((u) => u.id === ap.user_id);
    if (!apUser?.email) return;

    const datumStr = formatDatum(act.wanneer);
    const actie = isUpdate
      ? `heeft zijn/haar opmerking bij de activiteit ${act.titel} op ${datumStr} aangepast: "${opmerking}"`
      : `heeft een opmerking toegevoegd bij de activiteit ${act.titel} op ${datumStr}: "${opmerking}"`;

    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "Waaranders <noreply@waaranders.be>",
      replyTo: "info@waaranders.be",
      to: apUser.email,
      subject: `Opmerking bij ${act.titel}`,
      text: `Beste ${ap.voornaam ?? ""},\n\n${vrijwilligerNaam} ${actie}\n\nMet vriendelijke groeten,\nhet Waaranders-team`,
    });
  } catch (e) {
    console.error("Fout bij versturen opmerkingmail:", e);
  }
}
