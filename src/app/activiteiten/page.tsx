"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Activiteit = {
  id: string;
  titel: string;
  wanneer: string; // "YYYY-MM-DD"
  doelgroep: string | null;
  aantal_vrijwilligers: number;
};

type MeedoenRow = {
  activiteit_id: string;
  vrijwilliger_id: string;
  vrijwilligers: { naam: string | null }[]; // <-- array
};



function todayLocalYYYYMMDD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function ActiviteitenPage() {
  const [items, setItems] = useState<Activiteit[]>([]);
  const [meedoen, setMeedoen] = useState<MeedoenRow[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null); // activiteit_id waar knop bezig is
  const [error, setError] = useState<string | null>(null);

  const activiteitIds = useMemo(() => items.map((a) => a.id), [items]);

  const meedoenByActiviteit = useMemo(() => {
    const map = new Map<string, MeedoenRow[]>();
    for (const row of meedoen) {
      const arr = map.get(row.activiteit_id) ?? [];
      arr.push(row);
      map.set(row.activiteit_id, arr);
    }
    return map;
  }, [meedoen]);

  const isIngeschreven = (activiteitId: string) => {
    if (!myUserId) return false;
    const rows = meedoenByActiviteit.get(activiteitId) ?? [];
    return rows.some((r) => r.vrijwilliger_id === myUserId);
  };

  const loadAll = async () => {
    setLoading(true);
    setError(null);

    // 1) sessie check
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user?.id ?? null;
    if (!uid) {
      window.location.href = "/login";
      return;
    }
    setMyUserId(uid);

    // 2) activiteiten ophalen
    const today = todayLocalYYYYMMDD();
    const { data: acts, error: e1 } = await supabase
      .from("activiteiten")
      .select("id,titel,wanneer,doelgroep,aantal_vrijwilligers")
      .gte("wanneer", today)
      .order("wanneer", { ascending: true });

    if (e1) {
      setError(e1.message);
      setLoading(false);
      return;
    }

    const activiteiten = (acts ?? []) as Activiteit[];
    setItems(activiteiten);

    // 3) meedoen + naam join ophalen voor deze activiteiten
    const ids = activiteiten.map((a) => a.id);
    if (ids.length === 0) {
      setMeedoen([]);
      setLoading(false);
      return;
    }

    // Let op: deze join-syntax is afhankelijk van je FK.
    // Als dit faalt, zie de "Als join niet werkt" tip onderaan.
    const { data: md, error: e2 } = await supabase
      .from("meedoen")
      .select("activiteit_id,vrijwilliger_id,vrijwilligers(naam)")
      .in("activiteit_id", ids);

    if (e2) {
      setError(e2.message);
      setLoading(false);
      return;
    }

    setMeedoen((md ?? []) as MeedoenRow[]);
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

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold mb-4">Toekomstige activiteiten</h1>

      {loading && <p>Laden...</p>}

      {error && <p className="text-red-600">Fout: {error}</p>}

      {!loading && !error && items.length === 0 && (
        <p className="text-gray-600">Geen toekomstige activiteiten.</p>
      )}

      <ul className="space-y-4">
        {items.map((a) => {
          const rows = meedoenByActiviteit.get(a.id) ?? [];
          const ingeschreven = rows.length;
          const nogNodig = Math.max(0, a.aantal_vrijwilligers - ingeschreven);
          const mijnStatus = isIngeschreven(a.id);

          const namen = rows
          .map((r) => r.vrijwilligers?.[0]?.naam ?? "(naam onbekend)")

            .filter(Boolean);

          return (
            <li key={a.id} className="border rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold text-lg">{a.titel}</div>
                  <div className="text-sm text-gray-600">
                    {a.wanneer}
                    {a.doelgroep ? ` • ${a.doelgroep}` : ""} •{" "}
                    {ingeschreven}/{a.aantal_vrijwilligers} ingeschreven
                    {nogNodig > 0 ? ` • nog ${nogNodig} nodig` : " • volzet/ok"}
                  </div>
                </div>

                <div>
                  {!mijnStatus ? (
                    <button
                      className="border rounded-xl px-4 py-2 font-medium"
                      onClick={() => inschrijven(a.id)}
                      disabled={busyId === a.id}
                    >
                      {busyId === a.id ? "Bezig..." : "Ik doe mee"}
                    </button>
                  ) : (
                    <button
                      className="border rounded-xl px-4 py-2 font-medium"
                      onClick={() => uitschrijven(a.id)}
                      disabled={busyId === a.id}
                    >
                      {busyId === a.id ? "Bezig..." : "Uitschrijven"}
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-3 text-sm">
                <div className="text-gray-600 mb-1">Ingeschreven:</div>
                {namen.length === 0 ? (
                  <div className="text-gray-500">Nog niemand.</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {namen.map((n, idx) => (
                      <span
                        key={`${a.id}-${idx}`}
                        className="border rounded-full px-3 py-1"
                      >
                        {n}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
