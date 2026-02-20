export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";

export default async function KlantenPage() {
  const supabase = await supabaseServer();

  const { data: klanten, error } = await supabase
    .from("klanten")
    .select("id, naam, actief, gearchiveerd_op")
    .order("naam");

  if (error) throw new Error(error.message);

  return (
    <main className="mx-auto max-w-5xl p-6 md:p-10 space-y-6">
      <div className="bg-blue-900 text-white font-bold px-4 py-2 rounded-xl">Klanten</div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link href="/admin/klanten/nieuw" className="border rounded-2xl p-4 bg-white/80 shadow-sm hover:shadow">
          <div className="font-bold">+ Nieuwe klant</div>
          <div className="text-sm text-gray-600 mt-1">Klant toevoegen</div>
        </Link>

        {klanten?.map((k) => {
          const archived = !!k.gearchiveerd_op || !k.actief;
          return (
            <Link
              key={k.id}
              href={`/admin/klanten/${k.id}`}
              className={`border rounded-2xl p-4 bg-white/80 shadow-sm hover:shadow ${archived ? "opacity-60" : ""}`}
            >
              <div className="font-bold">{k.naam}</div>
              {archived ? (
                <div className="text-sm text-gray-600 mt-1">Gearchiveerd / inactief</div>
              ) : (
                <div className="text-sm text-gray-600 mt-1">Actief</div>
              )}
            </Link>
          );
        })}
      </div>
    </main>
  );
}