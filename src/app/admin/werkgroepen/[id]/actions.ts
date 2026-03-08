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
  onderwerp: string,
  boodschap: string
): Promise<{ verstuurd: number; error?: string }> {
  try {
    const supabase = supabaseAdmin();

    // 1) Vrijwilliger-id's ophalen voor deze werkgroep
    const { data: wd, error: wdErr } = await supabase
      .from("werkgroep_deelnemers")
      .select("vrijwilliger_id")
      .eq("werkgroep_id", werkgroepId);

    if (wdErr) return { verstuurd: 0, error: wdErr.message };
    const vrijwilligerIds = (wd ?? []).map((r) => r.vrijwilliger_id as string).filter(Boolean);

    if (vrijwilligerIds.length === 0) return { verstuurd: 0 };

    // 2) user_id's ophalen uit vrijwilligers tabel
    const { data: vv, error: vErr } = await supabase
      .from("vrijwilligers")
      .select("user_id")
      .in("id", vrijwilligerIds);

    if (vErr) return { verstuurd: 0, error: vErr.message };
    const userIds = (vv ?? []).map((r) => r.user_id as string).filter(Boolean);

    if (userIds.length === 0) return { verstuurd: 0 };

    // 3) E-mailadressen ophalen via auth.admin
    const { data: usersData, error: usersErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (usersErr) return { verstuurd: 0, error: usersErr.message };

    const emails = usersData.users
      .filter((u) => userIds.includes(u.id) && !!u.email)
      .map((u) => u.email as string);

    if (emails.length === 0) return { verstuurd: 0 };

    // 4) Mails versturen via Resend
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
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Onbekende fout bij het versturen.";
    return { verstuurd: 0, error: msg };
  }
}
