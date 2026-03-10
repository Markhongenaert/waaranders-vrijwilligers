"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin } from "@/lib/auth";

type Werkgroep = {
  id: string;
  titel: string;
  opdracht: string | null;
  trekker: string | null;
  aantalDeelnemers: number;
};

export default function WerkgroepenPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [werkgroepen, setWerkgroepen] = useState<Werkgroep[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const ok = await isDoenkerOrAdmin();
      if (!mounted) return;
      setAllowed(ok);
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (allowed !== true) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const { data, error } = await supabase
          .from("werkgroepen")
          .select("id, titel, opdracht, trekker, werkgroep_deelnemers(vrijwilliger_id, vrijwilligers(actief))")
          .order("titel", { ascending: true });
        if (error) throw error;
        if (!mounted) return;
        setWerkgroepen(
          (data ?? []).map((w: any) => ({
            id: w.id,
            titel: w.titel,
            opdracht: w.opdracht,
            trekker: w.trekker ?? null,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            aantalDeelnemers: (w.werkgroep_deelnemers ?? []).filter((d: any) => d.vrijwilligers?.actief !== false).length,
          }))
        );
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message ?? "Fout bij laden.");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [allowed]);

  if (allowed === null) return <main className="p-6">Laden…</main>;
  if (allowed === false) {
    return (
      <main className="p-6">
        <div className="wa-alert-error">Geen toegang.</div>
      </main>
    );
  }

  return (
    <main className="p-5 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Werkgroepen</h1>
        <div className="flex gap-2">
          <a href="/admin/werkgroepen/beheer" className="wa-btn-action px-4 py-2 text-sm">
            Beheer
          </a>
        </div>
      </div>

      {err && <div className="wa-alert-error">{err}</div>}

      {loading ? (
        <div className="text-gray-600">Laden…</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {werkgroepen.map((w) => (
            <a
              key={w.id}
              href={`/admin/werkgroepen/${w.id}`}
              className="wa-card p-4 hover:shadow-md transition block"
            >
              <div className="font-semibold text-gray-900">{w.titel}</div>
              {w.trekker && (
                <div className="text-sm text-gray-600 mt-0.5">
                  Trekker: {w.trekker}
                </div>
              )}
              <div className="text-sm text-gray-500 mt-1">
                {w.aantalDeelnemers} deelnemer{w.aantalDeelnemers !== 1 ? "s" : ""}
              </div>
            </a>
          ))}
          {werkgroepen.length === 0 && (
            <p className="text-gray-600">Geen werkgroepen gevonden.</p>
          )}
        </div>
      )}
    </main>
  );
}
