"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Activiteit = {
  id: string;
  titel: string;
  wanneer: string; // YYYY-MM-DD
  startuur: string | null; // "HH:MM:SS" of "HH:MM"
  einduur: string | null;  // "HH:MM:SS" of "HH:MM"
  aantal_vrijwilligers: number | null;
  toelichting: string | null;
};

type MeedoenMetNaamRow = {
  activiteit_id: string;
  vrijwilliger_id: string; // dit is public.vrijwilligers.id (niet auth.uid)
  naam: string | null;     // roepnaam uit vrijwilligers_public
};

const WEEKDAY_FMT = new Intl.DateTimeFormat("nl-BE", { weekday: "long" });
const DAY_MONTH_FMT = new Intl.DateTimeFormat("nl-BE", { day: "numeric", month: "short" });
const MONTH_HEADER_FMT = new Intl.DateTimeFormat("nl-BE", { month: "long", year: "numeric" });

function capitalize(s: string) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function asLocalDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`);
}

function formatDatumKaart(dateStr: string) {
  const d = asLocalDate(dateStr);
  const wd = capitalize(WEEKDAY_FMT.format(d));
  const dm = DAY_MONTH_FMT.format(d);
  return `${wd} ${dm}`;
}

function formatMaandTussentitel(dateStr: string) {
  const d = asLocalDate(dateStr);
  return capitalize(MONTH_HEADER_FMT.format(d));
}

function monthKey(dateStr: string) {
  return dateStr.slice(0, 7); // YYYY-MM
}

function todayISODate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function hhmm(t: string | null): string | null {
  if (!t) return null;
  if (t.length >= 5) return t.slice(0, 5);
  return t;
}

export default function ActiviteitenPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Activiteit[]>([]);
  const [meedoen, setMeedoen] = useState<MeedoenMetNaamRow[]>([]);
  const [myAuthUserId, setMyAuthUserId] = useState<string | null>(null);
  const [myVrijwilligerId, setMyVrijwilligerId] = useState<string | null>(null);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const meedoenByAct = useMemo(() => {
    const map = new Map<string, { vrijwilligerIds: Set<string>; namen: string[] }>();

    for (const r of meedoen) {
      const actId = r.activiteit_id;
      if (!map.has(actId)) map.set(actId, { vrijwilligerIds: new Set(), namen: [] });

      const entry = map.get(actId)!;
      entry.vrijwilligerIds.add(r.vrijwilliger_id);

      const nm = r.naam?.trim();
      if (nm) entry.namen.push(nm);
    }

    for (const v of map.values()) v.namen.sort((a, b) => a.localeCompare(b));
    return map;
  }, [meedoen]);

  const ingeschreven = (activiteitId: string) => {
    if (!myVrijwilligerId) return false;
    const entry = meedoenByAct.get(activiteitId);
    return entry ? entry.vrijwilligerIds.has(myVrijwilligerId) : false;
  };

  const grouped = useMemo(() => {
    const sorted = [...items].sort((a, b) =>
      a.wanneer < b.wanneer ? -1 : a.wanneer > b.wanneer ? 1 : 0
    );

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

    const { data: sess, error: sessErr } = await supabase.auth.getSession();
    if (sessErr) {
      setError(sessErr.message);
      setLoading(false);
      return;
    }

    const user = sess.session?.user ?? null;
    if (!user) {
      window.location.href = "/login";
      return;
    }

    setMyAuthUserId(user.id);

    // 1) Zoek de gekoppelde vrijwilligers.id (jouw “eigen” vrijwilliger-uuid)
    const { data: vRow, error: vErr } = await supabase
      .from("vrijwilligers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (vErr) {
      setError(vErr.message);
      setLoading(false);
      return;
    }

    if (!vRow?.id) {
      // Geen profiel-rij gevonden: dan kan inschrijven nooit correct werken.
      setError("Je vrijwilligersprofiel is nog niet aangemaakt. Ga eerst naar je profiel en vul je roepnaam in.");
      setLoading(false);
      return;
    }

    setMyVrijwilligerId(vRow.id);

    const vanaf = todayISODate();

    // 2) Activiteiten laden
    const { data: acts, error: e1 } = await supabase
      .from("activiteiten")
      .select("id,titel,wanneer,startuur,einduur,aantal_vrijwilligers,toelichting")
      .gte("wanneer", vanaf)
      .order("wanneer", { ascending: true })
      .order("startuur", { ascending: true });

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

    // 3) Meedoen + roepnaam via view (geen join op vrijwilligers meer)
    const { data: md, error: e2 } = await supabase
      .from("meedoen_met_naam")
      .select("activiteit_id,vrijwilliger_id,naam")
      .in("activiteit_id", ids);

    if (e2) {
      setError(e2.message);
      setLoading(false);
      return;
    }

    setMeedoen((md ?? []) as MeedoenMetNaamRow[]);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inschrijven = async (activiteitId: string) => {
    if (!myVrijwilligerId) return;
    setBusyId(activiteitId);
    setError(null);

    const { error } = await supabase.from("meedoen").insert({
      activiteit_id: activiteitId,
      vrijwilliger_id: myVrijwilligerId, // ✅ juiste id
    });

    if (error) setError(error.message);

    await loadAll();
    setBusyId(null);
  };

  const uitschrijven = async (activiteitId: string) => {
    if (!myVrijwilligerId) return;
    setBusyId(activiteitId);
    setError(null);

    const { error } = await supabase
      .from("meedoen")
      .delete()
      .eq("activiteit_id", activiteitId)
      .eq("vrijwilliger_id", myVrijwilligerId); // ✅ juiste id

    if (error) setError(error.message);

    await loadAll();
    setBusyId(null);
  };

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-6 md:p-10">
      {error && (
        <p className="text-red-700 bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
          Fout: {error}
        </p>
      )}

      {loading ? (
        <p>Laden…</p>
      ) : items.length === 0 ? (
        <p className="text-gray-700">Geen toekomstige activiteiten.</p>
      ) : (
        <div className="space-y-8">
          {grouped.map((g) => (
            <section key={g.key}>
              <div className="sticky top-0 z-10 -mx-4 sm:-mx-6 md:-mx-10">
                <div className="bg-blue-100 text-black font-semibold px-4 sm:px-6 md:px-10 py-2 border-b border-blue-200">
                  {g.title}
                </div>
              </div>

              <ul className="space-y-3 mt-3">
                {g.items.map((a) => {
                  const busy = busyId === a.id;
                  const entry = meedoenByAct.get(a.id);
                  const namen = entry?.namen ?? [];
                  const count = namen.length;

                  const preview = namen.slice(0, 3);
                  const rest = Math.max(0, count - preview.length);

                  const isIn = ingeschreven(a.id);

                  const nodig = a.aantal_vrijwilligers ?? null;
                  const x = nodig == null ? 0 : Math.max(0, nodig - count);
                  const woordVrijwilliger = x === 1 ? "vrijwilliger" : "vrijwilligers";

                  const showNeed = nodig != null && x > 0;
                  const isAllMissing = nodig != null && x === nodig;

                  const s = hhmm(a.startuur);
                  const e = hhmm(a.einduur);
                  const showTime = !!(s && e);

                  return (
                    <li
                      key={a.id}
                      className={[
                        "rounded-2xl p-4 shadow-sm bg-white",
                        isIn ? "border-2 border-emerald-600" : "border border-gray-200",
                      ].join(" ")}
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold whitespace-pre-line break-words text-base sm:text-lg">
                              {a.titel}
                            </div>
                          </div>

                          {isIn && (
                            <span className="font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full text-sm border border-emerald-200 whitespace-nowrap">
                              Jij doet mee
                            </span>
                          )}
                        </div>

                        {a.toelichting && (
                          <div className="text-sm text-gray-700 whitespace-pre-line break-words">
                            {a.toelichting}
                          </div>
                        )}

                        <div className="text-sm text-gray-700 flex flex-wrap gap-x-3 gap-y-1">
                          <span className="text-gray-600">{formatDatumKaart(a.wanneer)}</span>

                          {showNeed && (
                            <span
                              className={[
                                "font-semibold",
                                isAllMissing ? "text-red-700 text-base" : "text-orange-700 text-base",
                              ].join(" ")}
                            >
                              nog <span className="font-extrabold">{x}</span> {woordVrijwilliger} nodig
                            </span>
                          )}
                        </div>

                        {showTime && (
                          <div className="text-sm text-gray-700">
                            <span className="text-gray-600">van</span> {s}{" "}
                            <span className="text-gray-600">tot</span> {e}
                          </div>
                        )}

                        <div className="text-sm text-gray-700">
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

                        <div className="pt-2 flex gap-2">
                          {!isIn ? (
                            <button
                              className="flex-1 rounded-xl px-4 py-2 text-sm font-medium bg-white border hover:bg-gray-50 transition disabled:opacity-60"
                              onClick={() => inschrijven(a.id)}
                              disabled={busy}
                            >
                              {busy ? "Bezig…" : "Inschrijven"}
                            </button>
                          ) : (
                            <button
                              className="flex-1 rounded-xl px-4 py-2 text-sm font-medium bg-white border hover:bg-gray-50 transition disabled:opacity-60"
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