"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Deelnemer = {
  vrijwilligerId: string;
  naam: string;
};

type Vrijwilliger = {
  id: string;
  naam: string;
};

type MeedoenMetNaamRow = {
  vrijwilliger_id: string;
  naam: string | null;
};

export default function DeelnemersBeheer({
  activiteitId,
  aantalVrijwilligers,
}: {
  activiteitId: string;
  aantalVrijwilligers: number | null;
}) {
  const [laden, setLaden] = useState(true);
  const [deelnemers, setDeelnemers] = useState<Deelnemer[]>([]);
  const [alleVrijwilligers, setAlleVrijwilligers] = useState<Vrijwilliger[]>([]);
  const [geselecteerd, setGeselecteerd] = useState("");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  const load = async () => {
    setFout(null);

    const { data: md, error: e1 } = await supabase
      .from("meedoen_met_naam")
      .select("vrijwilliger_id,naam")
      .eq("activiteit_id", activiteitId);

    if (e1) {
      console.error(e1);
      setFout(`Ophalen deelnemers lukte niet: ${e1.message}`);
      setLaden(false);
      return;
    }

    const lijst = ((md ?? []) as MeedoenMetNaamRow[])
      .map((r) => ({ vrijwilligerId: r.vrijwilliger_id, naam: r.naam ?? "(onbekend)" }))
      .sort((a, b) => a.naam.localeCompare(b.naam));
    setDeelnemers(lijst);

    const { data: v, error: e2 } = await supabase
      .from("vrijwilligers")
      .select("id,naam")
      .eq("actief", true)
      .order("naam", { ascending: true });

    if (e2) {
      console.error(e2);
      setFout(`Ophalen vrijwilligers lukte niet: ${e2.message}`);
      setLaden(false);
      return;
    }

    setAlleVrijwilligers((v ?? []) as Vrijwilliger[]);
    setLaden(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activiteitId]);

  const toevoegen = async () => {
    if (!geselecteerd) return;
    setBezig(true);
    setFout(null);

    const { data, error } = await supabase
      .from("meedoen")
      .insert({ activiteit_id: activiteitId, vrijwilliger_id: geselecteerd })
      .select();

    if (error) {
      console.error(error);
      setFout(`Toevoegen lukte niet: ${error.message}`);
      setBezig(false);
      return;
    }

    if (!data || data.length === 0) {
      console.error("Insert in meedoen leverde geen rij op (mogelijk RLS-blokkering)");
      setFout("Toevoegen lukte niet: geen rechten om deze vrijwilliger toe te voegen.");
      setBezig(false);
      return;
    }

    setGeselecteerd("");
    await load();
    setBezig(false);
  };

  const verwijderen = async (deelnemer: Deelnemer) => {
    const ok = window.confirm(`${deelnemer.naam} uitschrijven voor deze activiteit?`);
    if (!ok) return;

    setBezig(true);
    setFout(null);

    const { error } = await supabase
      .from("meedoen")
      .delete()
      .eq("activiteit_id", activiteitId)
      .eq("vrijwilliger_id", deelnemer.vrijwilligerId);

    if (error) {
      console.error(error);
      setFout(`Uitschrijven lukte niet: ${error.message}`);
      setBezig(false);
      return;
    }

    await load();
    setBezig(false);
  };

  if (laden) {
    return <div className="text-sm text-gray-500">Deelnemers laden…</div>;
  }

  const ingeschrevenIds = new Set(deelnemers.map((d) => d.vrijwilligerId));
  const beschikbaar = alleVrijwilligers.filter((v) => !ingeschrevenIds.has(v.id));

  const nodig = aantalVrijwilligers ?? 0;
  const telTekst = nodig > 0 ? `${deelnemers.length} van ${nodig} vrijwilligers` : `${deelnemers.length} ingeschreven`;

  return (
    <div className="wa-card p-5 space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <div className="font-semibold">Wie doet mee</div>
        <div className="text-sm text-gray-600">{telTekst}</div>
      </div>

      {fout && <div className="wa-alert-error">{fout}</div>}

      {deelnemers.length === 0 ? (
        <p className="text-sm text-gray-500">Nog niemand ingeschreven.</p>
      ) : (
        <ul className="space-y-1">
          {deelnemers.map((d) => (
            <li key={d.vrijwilligerId} className="flex items-center justify-between gap-2 text-sm">
              <span>{d.naam}</span>
              <button
                className="wa-btn wa-btn-danger px-2 py-0.5 text-xs"
                onClick={() => verwijderen(d)}
                disabled={bezig}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col sm:flex-row gap-2 pt-1">
        <select
          className="w-full border rounded-xl p-3"
          value={geselecteerd}
          onChange={(e) => setGeselecteerd(e.target.value)}
          disabled={bezig || beschikbaar.length === 0}
        >
          <option value="">
            {beschikbaar.length === 0 ? "Geen vrijwilligers beschikbaar" : "Kies een vrijwilliger…"}
          </option>
          {beschikbaar.map((v) => (
            <option key={v.id} value={v.id}>
              {v.naam}
            </option>
          ))}
        </select>
        <button
          className="wa-btn wa-btn-brand px-4 py-2 text-sm"
          onClick={toevoegen}
          disabled={bezig || !geselecteerd}
        >
          Toevoegen
        </button>
      </div>
    </div>
  );
}
