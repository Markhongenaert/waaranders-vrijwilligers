"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin } from "@/lib/auth";
import { sluitPrikbord, stuurDefinitieveMail } from "./actions";

type Prikbord = {
  id: string;
  titel: string;
  gesloten: boolean;
  werkgroep_id: string;
  werkgroepen: { titel: string; id: string } | null;
};

type Moment = {
  id: string;
  datum: string;
  beginuur: string | null;
  einduur: string | null;
};

type Antwoord = {
  id: string;
  moment_id: string;
  naam: string;
  beschikbaar: "ja" | "misschien" | "nee";
};

const ICOON: Record<string, string> = { ja: "✓", misschien: "?", nee: "✗" };
const KLEUR: Record<string, string> = {
  ja: "text-green-600 font-bold",
  misschien: "text-orange-500 font-bold",
  nee: "text-red-500 font-bold",
};

function formatMoment(m: Moment) {
  const d = new Date(m.datum + "T00:00:00");
  const dag = d.toLocaleDateString("nl-BE", { weekday: "short", day: "numeric", month: "short" });
  if (!m.beginuur) return dag;
  if (!m.einduur) return `${dag} ${m.beginuur}`;
  return `${dag} ${m.beginuur}–${m.einduur}`;
}

export default function PrikbordBeheerPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [prikbord, setPrikbord] = useState<Prikbord | null>(null);
  const [momenten, setMomenten] = useState<Moment[]>([]);
  const [antwoorden, setAntwoorden] = useState<Antwoord[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // Sluiten state
  const [sluitBezig, setSluitBezig] = useState(false);
  const [sluitFout, setSluitFout] = useState<string | null>(null);

  // Definitief moment mail modal
  const [mailModalOpen, setMailModalOpen] = useState(false);
  const [mailBoodschap, setMailBoodschap] = useState("");
  const [mailBezig, setMailBezig] = useState(false);
  const [mailFout, setMailFout] = useState<string | null>(null);
  const [mailResultaat, setMailResultaat] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const ok = await isDoenkerOrAdmin();
      if (!mounted) return;
      setAllowed(ok);
    })();
    return () => { mounted = false; };
  }, []);

  async function laadData() {
    if (!id) return;
    setErr(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: pb, error: pbErr } = await supabase
        .from("prikborden")
        .select("id, titel, gesloten, werkgroep_id, werkgroepen(id, titel)")
        .eq("id", id)
        .maybeSingle();
      if (pbErr) throw pbErr;
      if (!pb) throw new Error("Prikbord niet gevonden.");

      const { data: mm, error: mErr } = await supabase
        .from("prikbord_momenten")
        .select("id, datum, beginuur, einduur")
        .eq("prikbord_id", id)
        .order("datum", { ascending: true })
        .order("beginuur", { ascending: true });
      if (mErr) throw mErr;

      const momentIds = (mm ?? []).map((m) => m.id);
      let ant: Antwoord[] = [];
      if (momentIds.length > 0) {
        const { data: aa, error: aErr } = await supabase
          .from("prikbord_antwoorden")
          .select("id, moment_id, naam, beschikbaar")
          .in("moment_id", momentIds)
          .order("aangemaakt_op", { ascending: true });
        if (aErr) throw aErr;
        ant = (aa ?? []) as Antwoord[];
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setPrikbord(pb as any);
      setMomenten(mm ?? []);
      setAntwoorden(ant);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Fout bij laden.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (allowed !== true) return;
    laadData();
  }, [allowed, id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function sluit() {
    if (!id) return;
    setSluitBezig(true);
    setSluitFout(null);
    const result = await sluitPrikbord(id);
    if (result.error) {
      setSluitFout(result.error);
    } else {
      setPrikbord((prev) => prev ? { ...prev, gesloten: true } : prev);
    }
    setSluitBezig(false);
  }

  async function verstuurDefinitieveMail() {
    if (!id || !mailBoodschap.trim()) return;
    setMailBezig(true);
    setMailFout(null);
    setMailResultaat(null);
    const result = await stuurDefinitieveMail(id, mailBoodschap);
    if (result.error) {
      setMailFout(result.error);
    } else {
      setMailResultaat(`Mail verstuurd naar ${result.verstuurd} vrijwilliger${result.verstuurd !== 1 ? "s" : ""}.`);
    }
    setMailBezig(false);
  }

  const namenGeordend = [...new Set(antwoorden.map((a) => a.naam))];
  const antwoordMap = new Map<string, "ja" | "misschien" | "nee">();
  for (const a of antwoorden) {
    antwoordMap.set(`${a.naam}|${a.moment_id}`, a.beschikbaar);
  }

  if (allowed === null) return <main className="p-6">Laden…</main>;
  if (allowed === false) {
    return <main className="p-6"><div className="wa-alert-error">Geen toegang.</div></main>;
  }

  const werkgroepId = prikbord?.werkgroepen
    ? (prikbord.werkgroepen as { id: string; titel: string }).id
    : prikbord?.werkgroep_id;

  return (
    <main className="p-5 sm:p-6 space-y-5 max-w-5xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          {prikbord && (
            <div className="text-sm text-gray-500 mb-0.5">
              {(prikbord.werkgroepen as { titel: string } | null)?.titel}
            </div>
          )}
          <h1 className="text-xl font-semibold">{prikbord?.titel ?? "Prikbord"}</h1>
          {prikbord?.gesloten && (
            <span className="inline-block mt-1 text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5">
              Gesloten
            </span>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {werkgroepId && (
            <Link href={`/admin/werkgroepen/${werkgroepId}`} className="border rounded-xl px-4 py-2 text-sm">
              Terug naar werkgroep
            </Link>
          )}
        </div>
      </div>

      {err && <div className="wa-alert-error">{err}</div>}
      {sluitFout && <div className="wa-alert-error">{sluitFout}</div>}

      {loading ? (
        <div className="text-gray-600">Laden…</div>
      ) : (
        <>
          {momenten.length === 0 ? (
            <div className="wa-alert-info">Geen momenten gevonden voor dit prikbord.</div>
          ) : (
            <div className="wa-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-semibold text-gray-700 min-w-[140px]">Naam</th>
                    {momenten.map((m) => (
                      <th key={m.id} className="text-center p-3 font-semibold text-gray-700 min-w-[110px]">
                        {formatMoment(m)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {namenGeordend.length === 0 ? (
                    <tr>
                      <td colSpan={momenten.length + 1} className="p-3 text-gray-500 text-center">
                        Nog geen antwoorden.
                      </td>
                    </tr>
                  ) : (
                    namenGeordend.map((naam) => (
                      <tr key={naam} className="border-b last:border-0">
                        <td className="p-3 font-medium text-gray-800">{naam}</td>
                        {momenten.map((m) => {
                          const a = antwoordMap.get(`${naam}|${m.id}`);
                          return (
                            <td key={m.id} className="p-3 text-center">
                              {a ? (
                                <span className={KLEUR[a]}>{ICOON[a]}</span>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Acties */}
          <div className="flex flex-wrap gap-3">
            {!prikbord?.gesloten && (
              <button
                onClick={sluit}
                className="wa-btn wa-btn-ghost border-red-300 text-red-600 hover:bg-red-50"
                disabled={sluitBezig}
              >
                {sluitBezig ? "Sluiten…" : "Prikbord sluiten"}
              </button>
            )}
            {prikbord?.gesloten && (
              <button
                onClick={() => { setMailBoodschap(""); setMailFout(null); setMailResultaat(null); setMailModalOpen(true); }}
                className="wa-btn wa-btn-brand"
              >
                Definitief moment communiceren
              </button>
            )}
          </div>
        </>
      )}

      {/* Definitief moment modal */}
      {mailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="wa-card w-full max-w-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold">Definitief moment communiceren</h2>

            {mailResultaat ? (
              <>
                <div className="wa-alert-success">{mailResultaat}</div>
                <div className="flex justify-end">
                  <button onClick={() => setMailModalOpen(false)} className="wa-btn wa-btn-ghost">
                    Sluiten
                  </button>
                </div>
              </>
            ) : (
              <>
                {mailFout && <div className="wa-alert-error">{mailFout}</div>}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Boodschap</label>
                  <textarea
                    value={mailBoodschap}
                    onChange={(e) => setMailBoodschap(e.target.value)}
                    rows={6}
                    className="w-full border rounded-lg px-3 py-2 text-sm resize-y"
                    placeholder="bv. We plannen onze volgende werkgroepbijeenkomst op dinsdag 4 februari om 14:00."
                    disabled={mailBezig}
                  />
                  <p className="text-xs text-blue-900 mt-1">
                    Gepersonaliseerde begroeting en afsluiting worden automatisch toegevoegd.
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setMailModalOpen(false)} className="wa-btn wa-btn-ghost" disabled={mailBezig}>
                    Annuleren
                  </button>
                  <button
                    onClick={verstuurDefinitieveMail}
                    className="wa-btn wa-btn-brand"
                    disabled={mailBezig || !mailBoodschap.trim()}
                  >
                    {mailBezig ? "Versturen…" : "Versturen"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
