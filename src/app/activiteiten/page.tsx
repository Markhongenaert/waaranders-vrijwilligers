"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Activiteit = {
  id: string;
  titel: string;
  wanneer: string; // date in DB -> comes as "YYYY-MM-DD"
  doelgroep: string | null;
  aantal_vrijwilligers: number | null;
};

type MeedoenRow = {
  activiteit_id: string;
  vrijwilliger_id: string;
  vrijwilligers: any; // kan object of array zijn; we normaliseren met helper
};

function volunteerNaamFromRow(r: any): string | null {
  const v = r?.vrijwilligers;
  if (Array.isArray(v)) return v[0]?.naam ?? null; // vaak: [{ naam }]
  if (v && typeof v === "object") return v.naam ?? null; // soms: { naam }
  return null;
}

function isToekomstig(d: string): boolean {
  // d = "YYYY-MM-DD"
  // Vergelijk op datum, niet op tijd.
  const today = new Date();
  const todayYMD = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const [y, m, day] = d.split("-").map(Number);
  const dateYMD = new Date(y, (m ?? 1) - 1, day ?? 1);
  return dateYMD >= todayYMD;
}

export default function ActiviteitenPage() {
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [myUserId, setMyUserId] = useState<string | null>(null);

  const [items, setItems] = useState<Activiteit[]>([]);
  const [meedoen, setMeedoen] = useState<MeedoenRow[]>([]);

  const loadAll = async () => {
    setLoading(true);
    setError(null);

    // 0) user
    const { data: sess } = await supabase.auth.getSession();
    const user = sess.session?.user;
    if (!user) {
      window.location.href = "/login";
      return;
    }
    setMyUserId(user.id);

    // 1) activiteiten
    const { data: acts, error: e1 } = await supabase
      .from("activiteiten")
      .select("id,titel,wanneer,doelgroep,aantal_vrijwilligers")
      .order("wanneer", { ascending: true });

    if (e1) {
      setError(e1.message);
      setLoading(false);
      return;
    }

    const activiteiten = ((acts ?? []) as Activiteit[]).filter((a) => isToekomstig(a.wanneer));
    setItems(activiteiten);

    // 2) meedoen + naam join
    const ids = activiteiten.map((a) => a.id);
    if (ids.length === 0) {
      setMeedoen([]);
      setLoading(false);
      return;
    }

    const { data: md, error: e2 } = await supabase
      .from("meedoen")
      .select("activiteit_id,vrijwilliger_id,vrijwilligers(naam)")
      .in("activiteit_id", ids);

    if (e2) {
      setError(e2.message);
      setLoading(false);
      return;
    }

    setMeedoen((md ?? []) as unknown as MeedoenRow[]);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inschrijven = async (activiteitId: string) => {
    if (!myUserId) return;
    setBusyId(activiteitId);
    setError(null);

    const { error } = await supabase.from("meedoen").insert({
      activiteit_id: activiteitId,
      vrijwilliger_id: myUserId,
    });

    if (error) setError(error.message);
    await loadAll();
    setBusyId(null);
  };

  const uitschrijven = async (activiteitId: string) => {
    if (!myUserId) return;
    setBusyId(activiteitId);
    setError(null);

    const { error } = await supabase
      .from("meedoen")
      .delete()
      .eq("activiteit_id", activiteitId)
      .eq("vrijwilliger_id", myUserId);

    if (error) setError(error.message);
    await loadAll();
    setBusyId(null);
  };

  const myInschrijvingSet = useMemo(() => {
    const s = new Set<string>();
    if (!myUserId) return s;
    for (const r of meedoen) {
      if (r.vrijwilliger_id === myUserId) s.add(r.activiteit_id);
    }
    return s;
  }, [meedoen, myUserId]);

  return (
    <main className="p-8 max-w-3xl">
      <h1 className="text-3xl font-bold mb-4">Activiteiten</h1>
      <p className="text-gray-600 mb-6">Alleen toekomstige activiteiten worden getoond.</p>

      {error && <p className="text-red-600 mb-4">Fout: {error}</p>}

      {loading ? (
        <p>Laden…</p>
      ) : items.length === 0 ? (
        <p className="text-gray-600">Geen toekomstige activiteiten.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((a) => {
            const rows = meedoen.filter((r) => r.activiteit_id === a.id);
            const namen = rows.map((r) => volunteerNaamFromRow(r) ?? "(naam onbekend)");
            const namenTekst = namen.join(", ");
            const ikDoeMee = myInschrijvingSet.has(a.id);
            const busy = busyId === a.id;

            return (
              <li key={a.id} className="border rounded-xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium">{a.titel}</div>
                    <div className="text-sm text-gray-600">
                      {a.wanneer}
                      {a.doelgroep ? ` • ${a.doelgroep}` : ""}
                      {a.aantal_vrijwilligers != null ? ` • nodig: ${a.aantal_vrijwilligers}` : ""}
                    </div>

                    <div className="text-sm text-gray-600 mt-2">
                      Ingeschreven: {rows.length}
                      {rows.length > 0 ? ` • ${namenTekst}` : ""}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {!ikDoeMee ? (
                      <button
                        className="border rounded-xl px-3 py-1 text-sm"
                        onClick={() => inschrijven(a.id)}
                        disabled={busy}
                      >
                        {busy ? "Bezig…" : "Inschrijven"}
                      </button>
                    ) : (
                      <button
                        className="border rounded-xl px-3 py-1 text-sm"
                        onClick={() => uitschrijven(a.id)}
                        disabled={busy}
                      >
                        {busy ? "Bezig…" : "Uitschrijven"}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
