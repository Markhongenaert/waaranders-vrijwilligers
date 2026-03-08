"use server";

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is niet geconfigureerd.");
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export async function stuurMailNaarWerkgroep(
  werkgroepId: string,
  onderwerp: string,
  boodschap: string
): Promise<{ verstuurd: number }> {
  const supabase = supabaseAdmin();

  // 1) Werkgroep ophalen
  const { data: wg, error: wErr } = await supabase
    .from("werkgroepen")
    .select("id, titel")
    .eq("id", werkgroepId)
    .maybeSingle();

  if (wErr) throw new Error(wErr.message);
  if (!wg) throw new Error("Werkgroep niet gevonden.");

  // 2) Vrijwilliger-id's ophalen voor deze werkgroep
  const { data: wd, error: wdErr } = await supabase
    .from("werkgroep_deelnemers")
    .select("vrijwilliger_id")
    .eq("werkgroep_id", werkgroepId);

  if (wdErr) throw new Error(wdErr.message);
  const vrijwilligerIds = (wd ?? []).map((r) => r.vrijwilliger_id as string).filter(Boolean);

  if (vrijwilligerIds.length === 0) return { verstuurd: 0 };

  // 3) user_id's ophalen uit vrijwilligers tabel
  const { data: vv, error: vErr } = await supabase
    .from("vrijwilligers")
    .select("user_id")
    .in("id", vrijwilligerIds);

  if (vErr) throw new Error(vErr.message);
  const userIds = (vv ?? []).map((r) => r.user_id as string).filter(Boolean);

  if (userIds.length === 0) return { verstuurd: 0 };

  // 4) E-mailadressen ophalen via auth.admin
  const { data: usersData, error: usersErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (usersErr) throw new Error(usersErr.message);

  const emails = usersData.users
    .filter((u) => userIds.includes(u.id) && !!u.email)
    .map((u) => u.email as string);

  if (emails.length === 0) return { verstuurd: 0 };

  // 5) Mails versturen via Resend
  const resend = new Resend(process.env.RESEND_API_KEY);
  await Promise.all(
    emails.map((email) =>
      resend.emails.send({
        from: "Waaranders <onboarding@resend.dev>",
        to: email,
        subject: onderwerp,
        text: boodschap,
      })
    )
  );

  return { verstuurd: emails.length };
}
