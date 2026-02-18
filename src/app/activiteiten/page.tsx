"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Activiteit = {
  id: string;
  titel: string;
  wanneer: string; // date (YYYY-MM-DD)
  aantal_vrijwilligers: number | null;
  toelichting: string | null;
  doelgroep: string | null; // blijft in tabel, maar tonen we hier niet
};

type MeedoenRow = {
  activiteit_id: string;
  vrijwilliger_id: string;
  // Supabase kan dit als object of als array teruggeven, afhankelijk van relatie/join
  vrijwilligers: { naam: string | null } | { naam: string | null }[] | null;
};

const WEEKDAY_FMT = new Intl.DateTimeFormat("nl-BE", { weekday: "long" });
const DAY_MONTH_FMT = new Intl.DateTimeFormat("nl-BE", { day: "numeric", month: "short" });
const MONTH_HEADER_FMT = new Intl.DateTimeFormat("nl-BE", { month: "long", year: "numeric" });

function capitalize(s: string) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDatumKaart(dateStr: string) {
  // dateStr = "YYYY-MM-DD"
  const d = new Date(dateStr);
  const wd = capitalize(WEEKDAY_FMT.format(d));
  const dm = DAY_MONTH_FMT.format(d);
  return `${wd} ${dm}`; // bv. "Maandag 1 jan"
}

function formatMaandTussentitel(dateStr: string) {
  const d = new Date(dateStr);
  return capitalize(MONTH_HEADER_FMT.format(d)); // bv. "Februari 2026"
}

function monthKey(dateStr: string) {
  // YYYY-MM
  return dateStr.slice(0, 7);
}

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

function extractNaam(v: MeedoenRow["vrijwilligers"]): string | null {
  if (!v) return null;
  if (Array.isArray(v)) return v[0]?.naam ?? null;
  return v.naam ?? null;
}

export default function ActiviteitenPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Activiteit[]>([]);
  const [meedoen, setMeedoen] = useState<MeedoenRow[]>([]);

  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  const meedoenByAct = useMemo(() => {
    const map = new Map<string, { userIds: Set<string>; namen: string[] }>();

    for (const r of meedoen) {
      const actId = r.activiteit_id;
      if (!map.has(actId)) map.set(actId, { userIds: new Set(), namen: [] });

      const entry = map.get(actId)!;
      entry.userIds.add(r.vrijwilliger_id);

      const naam = extractNaam(r.vrijwilligers);
      if (naam) entry.namen.push(naam);
    }

    for (const v of map.values()) v.namen.sort((a, b) => a.localeCompare(b));
    return map;
  }, [meedoen]);

  const grouped = useMemo(() => {
    // items zijn al gesorteerd desc door de query, maar we sorteren nog eens defensief
    const sorted = [...items].sort((a, b) => (a.wanneer < b.wanneer ? 1 : a.wanneer > b.wanneer ? -1 : 0));

    const groups: { key: string; title: string; items: Activiteit[] }[] = [];
    const idx = new Map<string, number>();

    for (const a of sorted) {
      const key = monthKey(a.wanneer);
      const pos = idx.get(key);
      if (pos === undefined) {
        idx.set(key, groups.length);
        groups.push({ key, title: formatMaandTussentitel(a.wanneer), items: [a] });
      } else {
        groups[pos].items.push(a);
      }
    }

    return groups;
  }, [items]);

  const loadAll = async () => {
    setLoading(true);
    setError(null);

    const { data: sess } = await supabase.auth.getSession();
    const user = sess.session?.user ?? null;

    if (!user) {
      window.location.href = "/login";
      return;
    }

    setMyUserId(user.id);

    const vanaf = todayISODate();

    // ✅ sorteren: recentste eerst (descending)
    const { data: acts, error: e1 } = await supabase
      .from("activiteiten")
      .select("id,titel,wanneer,aantal_vrijwilligers,toelichting,doelgroep")
      .gte("wanneer", vanaf)
      .order("wanneer", { ascending: false });

    if (e1) {
      setError(e1.message);
      setLoading(false);
      return;
    }

    const activiteiten = (acts ?? []) as Activiteit[];
    setItems(activiteiten);

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

  const ingeschreven = (activiteitId: string) => {
    if (!myUserId) return false;
    const entry = meedoenByAct.get(activiteitId);
    return entry ? entry.userIds.has(myUserId) : false;
  };

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
    <main className="mx-auto max-w-3xl p-6 md:p-10">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl bg-blue-900 text-white font-bold px-4 py-2 rounded-xl">Activiteiten</h1>
          <p className="text-gray-600">Geplande activiteiten vanaf vandaag.</p>
        </div>

        <button className="border rounded-xl px-3 py-2 text-sm" onClick={loadAll} disabled={loading}>
          Refresh
        </button>
      </div>

      {error && <p className="text-red-600 mb-4">Fout: {error}</p>}

      {loading ? (
        <p>Laden…</p>
      ) : items.length === 0 ? (
        <p className="text-gray-600">Geen toekomstige activiteiten.</p>
      ) : (
        <div className="space-y-8">
          {grouped.map((g) => (
            <section key={g.key}>
             <h2 className="text-lg bg-blue-900 text-white font-bold mb-3 sticky top-0 z-10 px-3 py-2 -mx-2">  {g.title}
              </h2>


              <ul className="space-y-3">
                {g.items.map((a) => {
                  const busy = busyId === a.id;
                  const entry = meedoenByAct.get(a.id);
                  const namen = entry?.namen ?? [];
                  const count = namen.length;

                  const preview = namen.slice(0, 3);
                  const rest = Math.max(0, count - preview.length);

                  const isIn = ingeschreven(a.id);

                  return (
                    <li key={a.id} className="border rounded-2xl p-4 bg-white/80 shadow-sm">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="font-medium whitespace-pre-line break-words">{a.titel}</div>

                          {a.toelichting && (
                            <div className="text-sm text-gray-700 mt-2 whitespace-pre-line break-words">
                              {a.toelichting}
                            </div>
                          )}

                          <div className="text-sm text-gray-600 mt-2">
                            {formatDatumKaart(a.wanneer)}
                            {a.aantal_vrijwilligers != null ? ` • nodig: ${a.aantal_vrijwilligers}` : ""}
                            {` • ingeschreven: ${count}`}
                          </div>

                          <div className="text-sm text-gray-700 mt-2">
                            <span className="text-gray-600">Meedoen:</span>{" "}
                            {count === 0 ? (
                              <span className="text-gray-500">nog niemand</span>
                            ) : (
                              <>
                                {preview.join(", ")}
                                {rest > 0 ? ` (+${rest} meer)` : ""}
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2 shrink-0">
                          {!isIn ? (
                            <button
                              className="border rounded-xl px-3 py-2 text-sm"
                              onClick={() => inschrijven(a.id)}
                              disabled={busy}
                            >
                              {busy ? "Bezig…" : "Inschrijven"}
                            </button>
                          ) : (
                            <button
                              className="border rounded-xl px-3 py-2 text-sm"
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
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
