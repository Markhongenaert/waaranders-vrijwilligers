"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Activiteit = {
  id: string;
  titel: string;
  wanneer: string; // YYYY-MM-DD
  startuur: string | null; // "HH:MM:SS" of "HH:MM"
  einduur: string | null; // "HH:MM:SS" of "HH:MM"
  aantal_vrijwilligers: number | null;
  toelichting: string | null;
};

type MeedoenMetNaamRow = {
  activiteit_id: string;
  vrijwilliger_id: string; // = auth.uid()
  naam: string | null;
};

const WEEKDAY_FMT = new Intl.DateTimeFormat("nl-BE", { weekday: "long" });
const DAY_MONTH_FMT = new Intl.DateTimeFormat("nl-BE", { day: "numeric", month: "short" });
const MONTH_HEADER_FMT = new Intl.DateTimeFormat("nl-BE", { month: "long", year: "numeric" });
const CAL_MONTH_FMT = new Intl.DateTimeFormat("nl-BE", { month: "long", year: "numeric" });

const WEEKDAY_SHORT = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

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
  return t.length >= 5 ? t.slice(0, 5) : t;
}

function calMonthLabel(year: number, month: number) {
  return capitalize(CAL_MONTH_FMT.format(new Date(year, month, 1)));
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

// Returns 0=Ma … 6=Zo for the first day of the month
function firstWeekday(year: number, month: number) {
  const d = new Date(year, month, 1).getDay(); // 0=Sun
  return (d + 6) % 7;
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// --- Kalender sub-component ---
function Kalender({
  items,
  meedoenByAct,
  onBadgeClick,
}: {
  items: Activiteit[];
  meedoenByAct: Map<string, { vrijwilligerIds: Set<string>; namen: string[] }>;
  onBadgeClick: (id: string) => void;
}) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const activiteitenByDate = useMemo(() => {
    const map = new Map<string, Activiteit[]>();
    for (const a of items) {
      if (!map.has(a.wanneer)) map.set(a.wanneer, []);
      map.get(a.wanneer)!.push(a);
    }
    return map;
  }, [items]);

  const totalDays = daysInMonth(year, month);
  const startOffset = firstWeekday(year, month);
  const totalCells = Math.ceil((startOffset + totalDays) / 7) * 7;
  const todayStr = todayISODate();

  const prevMonth = () => {
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else {
      setMonth((m) => m - 1);
    }
  };
  const nextMonth = () => {
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else {
      setMonth((m) => m + 1);
    }
  };

  return (
    <div>
      {/* Maandnavigatie */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="wa-btn wa-btn-ghost px-4 py-1 text-xl leading-none">
          ‹
        </button>
        <span className="font-semibold text-base sm:text-lg">{calMonthLabel(year, month)}</span>
        <button onClick={nextMonth} className="wa-btn wa-btn-ghost px-4 py-1 text-xl leading-none">
          ›
        </button>
      </div>

      {/* Weekdagkoppen */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAY_SHORT.map((d) => (
          <div key={d} className="text-center text-xs font-semibold text-gray-500 py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Kalendergrid */}
      <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-lg overflow-hidden">
        {Array.from({ length: totalCells }, (_, i) => {
          const dayNum = i - startOffset + 1;
          const isInMonth = dayNum >= 1 && dayNum <= totalDays;
          const dateStr = isInMonth ? isoDate(year, month, dayNum) : null;
          const acts = dateStr ? (activiteitenByDate.get(dateStr) ?? []) : [];
          const isToday = dateStr === todayStr;

          return (
            <div
              key={i}
              className={[
                "min-h-[60px] sm:min-h-[80px] p-1",
                isInMonth ? "bg-white" : "bg-gray-50",
              ].join(" ")}
            >
              {isInMonth && (
                <>
                  <div
                    className={[
                      "text-xs font-medium mb-1 w-5 h-5 flex items-center justify-center rounded-full mx-auto",
                      isToday ? "wa-brand rounded-full" : "text-gray-700",
                    ].join(" ")}
                  >
                    {dayNum}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {acts.map((a) => {
                      const inschrijvingen = meedoenByAct.get(a.id)?.vrijwilligerIds.size ?? 0;
                      const tekort = a.aantal_vrijwilligers != null && a.aantal_vrijwilligers - inschrijvingen > 0;
                      return (
                      <button
                        key={a.id}
                        onClick={() => onBadgeClick(a.id)}
                        className={[
                          "text-left text-xs text-white rounded px-1 py-0.5 leading-tight truncate w-full transition-colors",
                          tekort ? "bg-red-600 hover:bg-red-700" : "bg-lime-600 hover:bg-lime-700",
                        ].join(" ")}
                        title={a.titel}
                      >
                        {a.titel.split(/\s+/)[0]}
                      </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Hoofdpagina ---
export default function ActiviteitenPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Activiteit[]>([]);
  const [meedoen, setMeedoen] = useState<MeedoenMetNaamRow[]>([]);
  const [myId, setMyId] = useState<string | null>(null);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"lijst" | "kalender">("lijst");
  const [scrollToId, setScrollToId] = useState<string | null>(null);

  // Scroll naar kaart na tab-switch
  useEffect(() => {
    if (activeTab === "lijst" && scrollToId) {
      const id = scrollToId;
      setScrollToId(null);
      setTimeout(() => {
        document.getElementById(`act-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
    }
  }, [activeTab, scrollToId]);

  const handleBadgeClick = (id: string) => {
    setActiveTab("lijst");
    setScrollToId(id);
  };

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
    if (!myId) return false;
    const entry = meedoenByAct.get(activiteitId);
    return entry ? entry.vrijwilligerIds.has(myId) : false;
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

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) {
      setError(userErr.message);
      setLoading(false);
      return;
    }

    const user = userData.user;
    if (!user) {
      window.location.href = "/login";
      return;
    }

    setMyId(user.id);

    // ✅ Onboarding guard: profiel_afgewerkt + actief
    const { data: vRow, error: vErr } = await supabase
      .from("vrijwilligers")
      .select("id, actief, profiel_afgewerkt")
      .eq("id", user.id)
      .maybeSingle();

    if (vErr) {
      setError(vErr.message);
      setLoading(false);
      return;
    }

    if (!vRow) {
      window.location.href = "/profiel";
      return;
    }

    if (vRow.actief === false) {
      window.location.href = "/login?blocked=1";
      return;
    }

    if (!vRow.profiel_afgewerkt) {
      window.location.href = "/profiel";
      return;
    }

    const vanaf = todayISODate();

    // Activiteiten
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

    // Meedoen + roepnaam via view
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
    if (!myId) return;

    setBusyId(activiteitId);
    setError(null);

    const { error } = await supabase.from("meedoen").insert({
      activiteit_id: activiteitId,
      vrijwilliger_id: myId,
    });

    if (error) {
      setError(error.message);
      setBusyId(null);
      return;
    }

    setMeedoen((prev) => [
      ...prev,
      { activiteit_id: activiteitId, vrijwilliger_id: myId, naam: "Jij" },
    ]);

    setBusyId(null);
  };

  const uitschrijven = async (activiteitId: string) => {
    if (!myId) return;

    setBusyId(activiteitId);
    setError(null);

    const { error } = await supabase
      .from("meedoen")
      .delete()
      .eq("activiteit_id", activiteitId)
      .eq("vrijwilliger_id", myId);

    if (error) {
      setError(error.message);
      setBusyId(null);
      return;
    }

    setMeedoen((prev) =>
      prev.filter(
        (r) => !(r.activiteit_id === activiteitId && r.vrijwilliger_id === myId)
      )
    );

    setBusyId(null);
  };

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-6 md:p-10">
      {/* Tabbladen */}
      <div className="flex border-b border-gray-200 mb-6">
        {(["lijst", "kalender"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={[
              "px-5 py-2 text-sm font-medium border-b-2 transition-colors capitalize",
              activeTab === tab
                ? "border-blue-900 text-blue-900"
                : "border-transparent text-gray-500 hover:text-gray-700",
            ].join(" ")}
          >
            {tab === "lijst" ? "Lijst" : "Kalender"}
          </button>
        ))}
      </div>

      {error && (
        <div className="wa-alert-error mb-4">
          <span className="font-semibold">Fout:</span> {error}
        </div>
      )}

      {loading ? (
        <p>Laden…</p>
      ) : activeTab === "kalender" ? (
        items.length === 0 ? (
          <p className="text-gray-700">Geen toekomstige activiteiten.</p>
        ) : (
          <Kalender items={items} meedoenByAct={meedoenByAct} onBadgeClick={handleBadgeClick} />
        )
      ) : items.length === 0 ? (
        <p className="text-gray-700">Geen toekomstige activiteiten.</p>
      ) : (
        <div className="space-y-8">
          {grouped.map((g) => (
            <section key={g.key}>
              <div className="sticky top-0 z-10 -mx-4 sm:-mx-6 md:-mx-10">
                <div className="wa-section-header px-4 sm:px-6 md:px-10 py-2">
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
                      id={`act-${a.id}`}
                      className={[
                        "wa-card p-4",
                        isIn ? "wa-active-card" : "wa-neutral-card",
                      ].join(" ")}
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div
                              className={[
                                "whitespace-pre-line break-words text-base sm:text-lg",
                                isIn ? "font-extrabold" : "font-semibold",
                              ].join(" ")}
                            >
                              {a.titel}
                            </div>
                          </div>

                          {isIn && (
                            <span className="wa-active-badge px-3 py-1 rounded-full text-sm font-bold whitespace-nowrap">
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
                              {rest > 0 ? ` (+${rest} meer)` : ""}{" "}
                            </>
                          )}
                        </div>

                        <div className="pt-2 flex gap-2">
                          {!isIn ? (
                            <button
                              className="wa-btn wa-btn-ghost flex-1"
                              onClick={() => inschrijven(a.id)}
                              disabled={busy}
                            >
                              {busy ? "Bezig…" : "Inschrijven"}
                            </button>
                          ) : (
                            <button
                              className="wa-btn wa-btn-ghost flex-1"
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
