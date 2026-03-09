"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Prikbord = {
  id: string;
  titel: string;
  gesloten: boolean;
  werkgroepen: { titel: string } | null;
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

export default function PrikbordPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [loading, setLoading] = useState(true);
  const [prikbord, setPrikbord] = useState<Prikbord | null>(null);
  const [momenten, setMomenten] = useState<Moment[]>([]);
  const [antwoorden, setAntwoorden] = useState<Antwoord[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // Formulier state
  const [naam, setNaam] = useState("");
  const [keuzes, setKeuzes] = useState<Record<string, "ja" | "misschien" | "nee">>({});
  const [opslaaBezig, setOpslaBezig] = useState(false);
  const [opslaanResultaat, setOpslaanResultaat] = useState<string | null>(null);
  const [opslaanFout, setOpslaanFout] = useState<string | null>(null);

  async function laadData() {
    if (!id) return;
    setErr(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: pb, error: pbErr } = await supabase
        .from("prikborden")
        .select("id, titel, gesloten, werkgroepen(titel)")
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

  useEffect(() => { laadData(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Unieke namen (op volgorde van eerste antwoord, neem laatste waarde per naam/moment)
  const namenGeordend = [...new Set(antwoorden.map((a) => a.naam))];

  // Meest recente antwoord per (naam, moment_id)
  const antwoordMap = new Map<string, "ja" | "misschien" | "nee">();
  for (const a of antwoorden) {
    antwoordMap.set(`${a.naam}|${a.moment_id}`, a.beschikbaar);
  }

  function setKeuze(momentId: string, waarde: "ja" | "misschien" | "nee") {
    setKeuzes((prev) => ({ ...prev, [momentId]: waarde }));
  }

  async function slaanOp() {
    if (!naam.trim()) { setOpslaanFout("Vul je naam in."); return; }
    if (momenten.some((m) => !keuzes[m.id])) { setOpslaanFout("Geef voor elk moment je beschikbaarheid aan."); return; }
    setOpslaBezig(true);
    setOpslaanFout(null);
    setOpslaanResultaat(null);
    try {
      // Upsert: verwijder bestaande antwoorden van deze naam voor deze momenten
      const momentIds = momenten.map((m) => m.id);
      await supabase
        .from("prikbord_antwoorden")
        .delete()
        .in("moment_id", momentIds)
        .eq("naam", naam.trim());

      // Nieuwe antwoorden invoegen
      const { error: insErr } = await supabase.from("prikbord_antwoorden").insert(
        momenten.map((m) => ({
          moment_id: m.id,
          naam: naam.trim(),
          beschikbaar: keuzes[m.id],
        }))
      );
      if (insErr) throw insErr;

      setOpslaanResultaat("Bedankt! Je beschikbaarheid is opgeslagen.");
      setNaam("");
      setKeuzes({});
      await laadData();
    } catch (e: unknown) {
      setOpslaanFout(e instanceof Error ? e.message : "Fout bij opslaan.");
    } finally {
      setOpslaBezig(false);
    }
  }

  if (loading) return <main className="p-6 text-gray-600">Laden…</main>;
  if (err) return <main className="p-6"><div className="wa-alert-error">{err}</div></main>;
  if (!prikbord) return null;

  const werkgroepTitel = (prikbord.werkgroepen as { titel: string } | null)?.titel ?? "";

  return (
    <main className="p-5 sm:p-6 space-y-6 max-w-4xl">
      <div>
        <div className="text-sm text-gray-500 mb-1">{werkgroepTitel}</div>
        <h1 className="text-xl font-semibold">{prikbord.titel}</h1>
        {prikbord.gesloten && (
          <span className="inline-block mt-1 text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5">
            Gesloten
          </span>
        )}
      </div>

      {momenten.length === 0 ? (
        <div className="wa-alert-info">Er zijn nog geen momenten toegevoegd aan dit prikbord.</div>
      ) : (
        <>
          {/* Antwoordentabel */}
          <div className="wa-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-semibold text-gray-700 min-w-[140px]">Naam</th>
                  {momenten.map((m) => (
                    <th key={m.id} className="text-center p-3 font-semibold text-gray-700 min-w-[100px]">
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

          {/* Invulformulier */}
          {!prikbord.gesloten && (
            <div className="wa-card p-5 space-y-4">
              <h2 className="font-semibold text-gray-800">Mijn beschikbaarheid opgeven</h2>

              {opslaanResultaat && <div className="wa-alert-success">{opslaanResultaat}</div>}
              {opslaanFout && <div className="wa-alert-error">{opslaanFout}</div>}

              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Naam</label>
                <input
                  type="text"
                  value={naam}
                  onChange={(e) => setNaam(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm max-w-xs"
                  placeholder="Jouw naam"
                  disabled={opslaaBezig}
                />
              </div>

              <div className="space-y-3">
                {momenten.map((m) => (
                  <div key={m.id} className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
                    <span className="text-sm font-semibold text-gray-700 sm:font-normal sm:min-w-[160px]">
                      {formatMoment(m)}
                    </span>
                    <div className="flex gap-4 mt-1 sm:mt-0">
                      {(["ja", "misschien", "nee"] as const).map((v) => (
                        <label key={v} className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="radio"
                            name={`moment-${m.id}`}
                            value={v}
                            checked={keuzes[m.id] === v}
                            onChange={() => setKeuze(m.id, v)}
                            disabled={opslaaBezig}
                          />
                          <span className={`text-sm ${keuzes[m.id] === v ? KLEUR[v] : "text-gray-600"}`}>
                            {ICOON[v]} {v.charAt(0).toUpperCase() + v.slice(1)}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={slaanOp}
                className="wa-btn wa-btn-brand"
                disabled={opslaaBezig}
              >
                {opslaaBezig ? "Opslaan…" : "Mijn beschikbaarheid opslaan"}
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
