export const dynamic = "force-dynamic";
export const revalidate = 0;

import { supabaseServer } from "@/lib/supabase/server";
import KlantForm from "../_components/KlantForm";
import { archiveKlantAction, updateKlantAction } from "../actions";

export default async function KlantDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const supabase = await supabaseServer();
  const klantId = params.id;

  const returnTo = typeof searchParams.returnTo === "string" ? searchParams.returnTo : null;

  const { data: klant, error: e1 } = await supabase
    .from("klanten")
    .select("id, naam, contactpersoon_naam, contactpersoon_telefoon, adres, actief, gearchiveerd_op")
    .eq("id", klantId)
    .single();

  if (e1) throw new Error(e1.message);

  const { data: doelgroepen, error: e2 } = await supabase.from("doelgroepen").select("id, naam").order("naam");
  if (e2) throw new Error(e2.message);

  // huidige doelgroep (single) via join tabel
  const { data: kd, error: e3 } = await supabase
    .from("klant_doelgroepen")
    .select("doelgroep_id")
    .eq("klant_id", klantId)
    .maybeSingle();

  if (e3) throw new Error(e3.message);

  return (
    <main className="mx-auto max-w-2xl p-6 md:p-10 space-y-6">
      <div className="bg-blue-900 text-white font-bold px-4 py-2 rounded-xl">Klant</div>

      <KlantForm
        mode="edit"
        doelgroepen={doelgroepen ?? []}
        returnTo={returnTo}
        initial={{
          naam: klant.naam ?? "",
          contactpersoon_naam: klant.contactpersoon_naam ?? "",
          contactpersoon_telefoon: klant.contactpersoon_telefoon ?? "",
          adres: klant.adres ?? "",
          doelgroep_id: kd?.doelgroep_id ?? null,
          actief: !!klant.actief && !klant.gearchiveerd_op,
        }}
        onSubmit={async (payload) => {
          "use server";
          await updateKlantAction(klantId, payload);
        }}
        onArchive={async () => {
          "use server";
          await archiveKlantAction(klantId);
        }}
      />
    </main>
  );
}