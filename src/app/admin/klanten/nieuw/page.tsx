export const dynamic = "force-dynamic";
export const revalidate = 0;

import { supabaseServer } from "@/lib/supabase/server";
import KlantForm from "../_components/KlantForm";
import { createKlantAction } from "../actions";

export default async function NieuweKlantPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const supabase = await supabaseServer();

  const returnTo = typeof searchParams.returnTo === "string" ? searchParams.returnTo : null;
  const prefillNaam = typeof searchParams.prefillNaam === "string" ? searchParams.prefillNaam : "";

  const { data: doelgroepen, error } = await supabase.from("doelgroepen").select("id, naam").order("naam");
  if (error) throw new Error(error.message);

  return (
    <main className="mx-auto max-w-2xl p-6 md:p-10 space-y-6">
      <div className="bg-blue-900 text-white font-bold px-4 py-2 rounded-xl">Nieuwe klant</div>

      <KlantForm
        mode="create"
        doelgroepen={doelgroepen ?? []}
        returnTo={returnTo}
        initial={{
          naam: prefillNaam,
          contactpersoon_naam: "",
          contactpersoon_telefoon: "",
          adres: "",
          doelgroep_id: null,
          actief: true,
        }}
        onSubmit={async (payload) => {
          "use server";
          await createKlantAction(payload);
        }}
      />
    </main>
  );
}