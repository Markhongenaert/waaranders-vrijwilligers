"use server";

import { Resend } from "resend";
import { supabaseServer } from "@/lib/supabase/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function stuurMailNaarWerkgroep(
  werkgroepId: string,
  onderwerp: string,
  boodschap: string
): Promise<{ verstuurd: number }> {
  const supabase = await supabaseServer();

  // Werkgroep ophalen
  const { data: wg, error: wErr } = await supabase
    .from("werkgroepen")
    .select("id, titel")
    .eq("id", werkgroepId)
    .maybeSingle();

  if (wErr) throw new Error(wErr.message);
  if (!wg) throw new Error("Werkgroep niet gevonden.");

  // Deelnemers ophalen met e-mailadres
  const { data: dd, error: dErr } = await supabase
    .from("werkgroep_deelnemers")
    .select("vrijwilligers(id, email, voornaam)")
    .eq("werkgroep_id", werkgroepId);

  if (dErr) throw new Error(dErr.message);

  type VrijwilligerRow = { id: string; email: string; voornaam: string | null };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deelnemers = ((dd ?? []) as any[])
    .map((row) => row.vrijwilligers as VrijwilligerRow | null)
    .filter((v): v is VrijwilligerRow => !!v?.email);

  if (deelnemers.length === 0) return { verstuurd: 0 };

  // Mails versturen
  await Promise.all(
    deelnemers.map((v) =>
      resend.emails.send({
        from: "Waaranders <onboarding@resend.dev>",
        to: v.email,
        subject: onderwerp,
        text: boodschap,
      })
    )
  );

  return { verstuurd: deelnemers.length };
}
