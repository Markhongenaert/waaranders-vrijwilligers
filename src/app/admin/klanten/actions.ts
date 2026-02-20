"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

type KlantInput = {
  naam: string;
  contactpersoon_naam?: string | null;
  contactpersoon_telefoon?: string | null;
  adres?: string | null;
  doelgroep_id?: string | null; // single
  actief?: boolean;
};

function normalizeName(s: string) {
  return s.trim();
}

export async function createKlantAction(form: KlantInput & { returnTo?: string | null }) {
  const supabase = await supabaseServer();

  const naam = normalizeName(form.naam);
  if (!naam) throw new Error("Naam is verplicht.");

  // 1) klant maken
  const { data: klant, error: err1 } = await supabase
    .from("klanten")
    .insert({
      naam,
      contactpersoon_naam: form.contactpersoon_naam ?? null,
      contactpersoon_telefoon: form.contactpersoon_telefoon ?? null,
      adres: form.adres ?? null,
      actief: form.actief ?? true,
      gearchiveerd_op: null,
    })
    .select("id")
    .single();

  if (err1) throw new Error(err1.message);

  // 2) doelgroep koppelen (max 1, enforced via unique index)
  if (form.doelgroep_id) {
    const { error: err2 } = await supabase.from("klant_doelgroepen").upsert(
      {
        klant_id: klant.id,
        doelgroep_id: form.doelgroep_id,
      },
      { onConflict: "klant_id" }
    );
    if (err2) throw new Error(err2.message);
  }

  revalidatePath("/admin/klanten");

  // UX: terug naar returnTo met klant_id
  if (form.returnTo) {
    const u = new URL(form.returnTo, "http://dummy.local");
    u.searchParams.set("klant_id", klant.id);
    redirect(u.pathname + "?" + u.searchParams.toString());
  }

  redirect(`/admin/klanten/${klant.id}`);
}

export async function updateKlantAction(
  klantId: string,
  form: KlantInput & { returnTo?: string | null }
) {
  const supabase = await supabaseServer();

  const naam = normalizeName(form.naam);
  if (!naam) throw new Error("Naam is verplicht.");

  const { error: err1 } = await supabase
    .from("klanten")
    .update({
      naam,
      contactpersoon_naam: form.contactpersoon_naam ?? null,
      contactpersoon_telefoon: form.contactpersoon_telefoon ?? null,
      adres: form.adres ?? null,
      actief: form.actief ?? true,
    })
    .eq("id", klantId);

  if (err1) throw new Error(err1.message);

  // Doelgroep: upsert of delete
  if (form.doelgroep_id) {
    const { error: err2 } = await supabase.from("klant_doelgroepen").upsert(
      { klant_id: klantId, doelgroep_id: form.doelgroep_id },
      { onConflict: "klant_id" }
    );
    if (err2) throw new Error(err2.message);
  } else {
    // als je doelgroep optioneel maakt
    const { error: err3 } = await supabase.from("klant_doelgroepen").delete().eq("klant_id", klantId);
    if (err3) throw new Error(err3.message);
  }

  revalidatePath("/admin/klanten");
  revalidatePath(`/admin/klanten/${klantId}`);

  if (form.returnTo) redirect(form.returnTo);

  redirect(`/admin/klanten/${klantId}`);
}

export async function archiveKlantAction(klantId: string) {
  const supabase = await supabaseServer();

  const { error } = await supabase
    .from("klanten")
    .update({
      actief: false,
      gearchiveerd_op: new Date().toISOString(),
    })
    .eq("id", klantId);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/klanten");
  revalidatePath(`/admin/klanten/${klantId}`);

  redirect("/admin/klanten");
}