"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin } from "@/lib/auth";
import { formatDagMaand } from "@/lib/dateHelpers";

type Werkgroep = {
  id: string;
  titel: string;
  opdracht: string | null;
  trekker: string | null;
};

type Deelnemer = {
  id: string;
  voornaam: string | null;
  achternaam: string | null;
};

type OpenTaak = {
  id: string;
  wat: string;
  streefdatum: string | null;
  vrijwilligerNaam: string | null;
};

export default function WerkgroepDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [werkgroep, setWerkgroep] = useState<Werkgroep | null>(null);
  const [deelnemers, setDeelnemers] = useState<Deelnemer[]>([]);
  const [taken, setTaken] = useState<OpenTaak[]>([]);
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
    if (allowed !== true || !id) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const { data: wg, error: wErr } = await supabase
          .from("werkgroepen")
          .select("id, titel, opdracht, trekker")
          .eq("id", id)
          .maybeSingle();
        if (wErr) throw wErr;
        if (!wg) throw new Error("Werkgroep niet gevonden.");

        const { data: dd, error: dErr } = await supabase
          .from("werkgroep_deelnemers")
          .select("vrijwilligers(id, voornaam, achternaam)")
          .eq("werkgroep_id", id);
        if (dErr) throw dErr;

        const { data: tt, error: tErr } = await supabase
          .from("todos")
          .select("id, wat, streefdatum, wie_vrijwilliger_id")
          .eq("werkgroep_id", id)
          .neq("status", "gedaan");
        if (tErr) throw tErr;

        // Vrijwilligersnamen ophalen voor de unieke wie_vrijwilliger_id's
        const vIds = [...new Set((tt ?? []).map((t: any) => t.wie_vrijwilliger_id).filter(Boolean))];
        const namenById = new Map<string, string>();
        if (vIds.length > 0) {
          const { data: vv } = await supabase
            .from("vrijwilligers")
            .select("id, naam")
            .in("id", vIds);
          for (const v of vv ?? []) namenById.set((v as any).id, (v as any).naam ?? "");
        }

        if (!mounted) return;
        setWerkgroep(wg);
        setTaken(
          (tt ?? []).map((t: any) => ({
            id: t.id,
            wat: t.wat,
            streefdatum: t.streefdatum ?? null,
            vrijwilligerNaam: namenById.get(t.wie_vrijwilliger_id) ?? null,
          }))
        );
        setDeelnemers(
          (dd ?? [])
            .map((row: any) => row.vrijwilligers)
            .filter(Boolean)
            .sort((a: Deelnemer, b: Deelnemer) =>
              (a.achternaam ?? "").localeCompare(b.achternaam ?? "")
            )
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
  }, [allowed, id]);

  if (allowed === null) return <main className="p-6">Laden…</main>;
  if (allowed === false) {
    return (
      <main className="p-6">
        <div className="wa-alert-error">Geen toegang.</div>
      </main>
    );
  }

  return (
    <main className="p-5 sm:p-6 space-y-4 max-w-2xl">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{werkgroep?.titel ?? "Werkgroep"}</h1>
        <a href="/admin/werkgroepen" className="border rounded-xl px-4 py-2 text-sm">
          Terug
        </a>
      </div>

      {err && <div className="wa-alert-error">{err}</div>}

      {loading ? (
        <div className="text-gray-600">Laden…</div>
      ) : (
        <>
          {werkgroep?.opdracht && (
            <div className="wa-card p-4 text-gray-700">{werkgroep.opdracht}</div>
          )}

          <div className="wa-card p-4 text-gray-700">
            {werkgroep?.trekker
              ? <><span className="font-bold">Trekker:</span> {werkgroep.trekker}</>
              : <span className="font-bold">Trekker nog te bepalen</span>
            }
          </div>

          <div className="wa-card p-4">
            <div className="font-semibold mb-3">
              Deelnemers ({deelnemers.length})
            </div>
            {deelnemers.length ? (
              <ul className="divide-y">
                {deelnemers.map((d) => (
                  <li key={d.id} className="py-2 text-sm text-gray-800">
                    {[d.voornaam, d.achternaam].filter(Boolean).join(" ") || "—"}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-600">Geen deelnemers.</p>
            )}
          </div>

          <div className="wa-card p-4">
            <div className="font-semibold mb-3">Openstaande taken</div>
            {taken.length ? (
              <ul className="space-y-2">
                {taken.map((t) => (
                  <li key={t.id} className="flex gap-2 text-sm text-gray-800">
                    <span className="mt-0.5 text-gray-400">•</span>
                    <span>
                      {t.wat}
                      {t.streefdatum && (
                        <span className="text-gray-500">
                          {" "}— {formatDagMaand(t.streefdatum)}
                        </span>
                      )}
                      {t.vrijwilligerNaam && (
                        <span className="text-gray-500"> ({t.vrijwilligerNaam})</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-600">Geen openstaande taken.</p>
            )}
          </div>
        </>
      )}
    </main>
  );
}
