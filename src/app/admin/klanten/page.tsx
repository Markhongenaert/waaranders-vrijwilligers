"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin } from "@/lib/auth";

type Klant = {
  id: string;
  naam: string;
  contactpersoon_naam: string | null;
  contactpersoon_telefoon: string | null;
  adres: string | null;
  actief: boolean;
  gearchiveerd_op: string | null;
};

function safeReturnTo(raw: string | null): string | null {
  if (!raw) return null;
  // alleen interne paden toelaten
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//")) return null;
  return raw;
}

export default function KlantenPage() {
  const sp = useSearchParams();
  const returnTo = safeReturnTo(sp.get("returnTo"));

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const [items, setItems] = useState<Klant[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);

    const { data } = await supabase.auth.getSession();
    const user = data.session?.user ?? null;
    if (!user) {
      window.location.href = "/login";
      return;
    }

    const ok = await isDoenkerOrAdmin();
    setAllowed(ok);
    if (!ok) {
      setLoading(false);
      return;
    }

    let q = supabase
      .from("klanten")
      .select("id,naam,contactpersoon_naam,contactpersoon_telefoon,adres,actief,gearchiveerd_op")
      .order("naam", { ascending: true });

    if (!showArchived) {
      q = q.eq("actief", true).is("gearchiveerd_op", null);
    }

    const { data: rows, error: e } = await q;

    if (e) {
      setError(e.message);
      setItems([]);
      setLoading(false);
      return;
    }

    setItems((rows ?? []) as Klant[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchived]);

  const newHref = useMemo(() => {
    const base = "/admin/klanten/nieuw";
    if (!returnTo) return base;
    return `${base}?returnTo=${encodeURIComponent(returnTo)}`;
  }, [returnTo]);

  if (loading) return <main className="mx-auto max-w-3xl p-6 md:p-10">Laden…</main>;

  if (!allowed) {
    return (
      <main className="mx-auto max-w-3xl p-6 md:p-10">
        <h1 className="text-3xl font-semibold tracking-tight mb-2">Klanten beheren</h1>
        <p>Je hebt geen rechten om deze pagina te bekijken.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-6 md:p-10">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight mb-1">Klanten beheren</h1>
          {returnTo && (
            <p className="text-sm text-gray-600">
              Terugkeren naar: <span className="font-mono">{returnTo}</span>
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <Link className="border rounded-xl px-3 py-2 text-sm" href={newHref}>
            + Nieuwe klant
          </Link>
          {returnTo && (
            <Link className="border rounded-xl px-3 py-2 text-sm" href={returnTo}>
              Terug
            </Link>
          )}
        </div>
      </div>

      {error && <p className="text-red-600 mb-4">Fout: {error}</p>}

      <div className="flex items-center justify-between gap-3 mb-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Toon gearchiveerde klanten
        </label>

        <button className="border rounded-xl px-3 py-2 text-sm" onClick={load}>
          Refresh
        </button>
      </div>

      <div className="grid gap-3">
        {/* Tegel "nieuwe klant" bovenaan */}
        <Link
          href={newHref}
          className="border rounded-2xl p-4 bg-white/80 shadow-sm hover:bg-white"
        >
          <div className="font-medium">+ Nieuwe klant</div>
          <div className="text-sm text-gray-600 mt-1">Klant aanmaken</div>
        </Link>

        {items.length === 0 ? (
          <p className="text-gray-600">Nog geen klanten.</p>
        ) : (
          items.map((k) => {
            const editBase = `/admin/klanten/${k.id}`;
            const href = returnTo ? `${editBase}?returnTo=${encodeURIComponent(returnTo)}` : editBase;

            const archived = !k.actief || !!k.gearchiveerd_op;

            return (
              <Link key={k.id} href={href} className="border rounded-2xl p-4 bg-white/80 shadow-sm hover:bg-white">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium break-words">
                      {k.naam}{" "}
                      {archived && (
                        <span className="ml-2 text-xs px-2 py-0.5 rounded-full border bg-gray-100 text-gray-700">
                          gearchiveerd
                        </span>
                      )}
                    </div>

                    <div className="text-sm text-gray-700 mt-1">
                      {k.contactpersoon_naam ? `Contact: ${k.contactpersoon_naam}` : "Contact: —"}
                      {k.contactpersoon_telefoon ? ` • Tel: ${k.contactpersoon_telefoon}` : ""}
                    </div>

                    {k.adres && <div className="text-sm text-gray-600 mt-1 break-words">{k.adres}</div>}
                  </div>

                  <div className="text-sm text-gray-500 shrink-0">Bewerken →</div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </main>
  );
}