"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Doenker, VakantiePerio } from "./page";

export async function loadVakantieData(): Promise<{
  doenkers: Doenker[];
  perioden: VakantiePerio[];
  error?: string;
}> {
  const admin = supabaseAdmin();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: vData, error: vErr } = await admin
    .from("vrijwilligers")
    .select("id, voornaam, achternaam, vrijwilliger_roles!vrijwilliger_id(roles(code))")
    .eq("actief", true)
    .order("achternaam", { ascending: true, nullsFirst: false })
    .order("voornaam", { ascending: true, nullsFirst: false });

  if (vErr) return { doenkers: [], perioden: [], error: vErr.message };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doenkers: Doenker[] = (vData ?? []).filter((v: any) => {
    if (v.voornaam === "Alle doenkers" && v.achternaam === "Waaranders") return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const codes: string[] = (v.vrijwilliger_roles ?? []).map((r: any) => r.roles?.code);
    return codes.includes("doenker") || codes.includes("admin");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }).map((v: any) => ({
    id: v.id,
    voornaam: v.voornaam,
    achternaam: v.achternaam,
  }));

  const { data: periData, error: periErr } = await admin
    .from("vakantie_perioden")
    .select("id, vrijwilliger_id, begin_datum, eind_datum")
    .order("begin_datum", { ascending: true });

  if (periErr) return { doenkers: [], perioden: [], error: periErr.message };

  return {
    doenkers,
    perioden: (periData ?? []) as VakantiePerio[],
  };
}

export async function addVakantiePerio(
  vrijwilligerId: string,
  beginDatum: string,
  eindDatum: string
): Promise<{ error?: string }> {
  const { error } = await supabaseAdmin()
    .from("vakantie_perioden")
    .insert({ vrijwilliger_id: vrijwilligerId, begin_datum: beginDatum, eind_datum: eindDatum });
  if (error) return { error: error.message };
  return {};
}

export async function deleteVakantiePerio(id: string): Promise<{ error?: string }> {
  const { error } = await supabaseAdmin()
    .from("vakantie_perioden")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };
  return {};
}
