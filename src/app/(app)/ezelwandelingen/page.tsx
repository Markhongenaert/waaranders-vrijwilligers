"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Ezelwandeling = {
  id: string;
  titel: string;
  wanneer: string;
  startuur: string | null;
  einduur: string | null;
  omschrijving: string | null;
};

type Deelnemer = {
  ezelwandeling_id: string;
  vrijwilliger_id: string;
  opmerking: string | null;
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

function formatDatum(dateStr: string) {
  const d = asLocalDate(dateStr);
  return `${capitalize(WEEKDAY_FMT.format(d))} ${DAY_MONTH_FMT.format(d)}`;
}

function formatMaand(dateStr: string) {
  return capitalize(MONTH_HEADER_FMT.format(asLocalDate(dateStr)));
}

function monthKey(dateStr: string) {
  return dateStr.slice(0, 7);
}

function todayISODate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

function firstWeekday(year: number, month: number) {
  const d = new Date(year, month, 1).getDay();
  return (d + 6) % 7;
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// --- Kalender sub-component ---
function Kalender({
  items,
  onBadgeClick,
}: {
  items: Ezelwandeling[];
  onBadgeClick: (id: string) => void;
}) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const wandelingenByDate = useMemo(() => {
    const map = new Map<string, Ezelwandeling[]>();
    for (const w of items) {
      if (!map.has(w.wanneer)) map.set(w.wanneer, []);
      map.get(w.wanneer)!.push(w);
    }
    return map;
  }, [items]);

  const totalDays = daysInMonth(year, month);
  const startOffset = firstWeekday(year, month);
  const totalCells = Math.ceil((startOffset + totalDays) / 7) * 7;
  const todayStr = todayISODate();

  const prevMonth = () => {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="wa-btn wa-btn-ghost px-4 py-1 text-xl leading-none">
          ‹
        </button>
        <span className="font-semibold text-base sm:text-lg">{calMonthLabel(year, month)}</span>
        <button onClick={nextMonth} className="wa-btn wa-btn-ghost px-4 py-1 text-xl leading-none">
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {WEEKDAY_SHORT.map((d) => (
          <div key={d} className="text-center text-xs font-semibold text-gray-500 py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-lg overflow-hidden">
        {Array.from({ length: totalCells }, (_, i) => {
          const dayNum = i - startOffset + 1;
          const isInMonth = dayNum >= 1 && dayNum <= totalDays;
          const dateStr = isInMonth ? isoDate(year, month, dayNum) : null;
          const wandelingen = dateStr ? (wandelingenByDate.get(dateStr) ?? []) : [];
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
                    {wandelingen.map((w) => (
                      <button
                        key={w.id}
                        onClick={() => onBadgeClick(w.id)}
                        className="text-left text-xs text-white rounded px-1 py-0.5 leading-tight truncate w-full bg-blue-900 hover:bg-blue-800 transition-colors"
                        title={w.titel}
                      >
                        {w.titel.split(/\s+/)[0]}
                      </button>
                    ))}
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
export default function EzelwandelingenPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Ezelwandeling[]>([]);
  const [deelnemers, setDeelnemers] = useState<Deelnemer[]>([]);
  const [voornaamById, setVoornaamById] = useState<Map<string, string>>(new Map());
  const [myId, setMyId] = useState<string | null>(null);
  const [mijnVoornaam, setMijnVoornaam] = useState<string>("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"lijst" | "kalender">("lijst");
  const [scrollToId, setScrollToId] = useState<string | null>(null);

  type Modal = { wandelingId: string; wandelingTitel: string; mode: "inschrijven" | "wijzigen" };
  const [modal, setModal] = useState<Modal | null>(null);
  const [modalOpmerking, setModalOpmerking] = useState("");
  const [modalBezig, setModalBezig] = useState(false);
  const [modalFout, setModalFout] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === "lijst" && scrollToId) {
      const id = scrollToId;
      setScrollToId(null);
      setTimeout(() => {
        document.getElementById(`wand-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
    }
  }, [activeTab, scrollToId]);

  const handleBadgeClick = (id: string) => {
    setActiveTab("lijst");
    setScrollToId(id);
  };

  const deelnemersByWandeling = useMemo(() => {
    const map = new Map<string, { vrijwilligerIds: Set<string>; voornamen: string[] }>();
    for (const d of deelnemers) {
      if (!map.has(d.ezelwandeling_id))
        map.set(d.ezelwandeling_id, { vrijwilligerIds: new Set(), voornamen: [] });
      const entry = map.get(d.ezelwandeling_id)!;
      entry.vrijwilligerIds.add(d.vrijwilliger_id);
      const naam = voornaamById.get(d.vrijwilliger_id)?.trim();
      if (naam) entry.voornamen.push(naam);
    }
    for (const v of map.values()) v.voornamen.sort((a, b) => a.localeCompare(b));
    return map;
  }, [deelnemers, voornaamById]);

  const isIngeschreven = (id: string) =>
    myId ? (deelnemersByWandeling.get(id)?.vrijwilligerIds.has(myId) ?? false) : false;

  const getMijnOpmerking = (id: string) =>
    deelnemers.find((d) => d.ezelwandeling_id === id && d.vrijwilliger_id === myId)?.opmerking ?? null;

  const grouped = useMemo(() => {
    const sorted = [...items].sort((a, b) =>
      a.wanneer < b.wanneer ? -1 : a.wanneer > b.wanneer ? 1 : 0
    );
    const groups: { key: string; title: string; items: Ezelwandeling[] }[] = [];
    const idx = new Map<string, number>();
    for (const a of sorted) {
      const key = monthKey(a.wanneer);
      const pos = idx.get(key);
      if (pos === undefined) {
        idx.set(key, groups.length);
        groups.push({ key, title: formatMaand(a.wanneer), items: [a] });
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
    if (userErr) { setError(userErr.message); setLoading(false); return; }

    const user = userData.user;
    if (!user) { window.location.href = "/login"; return; }

    setMyId(user.id);

    const { data: vRow, error: vErr } = await supabase
      .from("vrijwilligers")
      .select("id, actief, profiel_afgewerkt, voornaam")
      .eq("id", user.id)
      .maybeSingle();

    if (vErr) { setError(vErr.message); setLoading(false); return; }
    if (!vRow) { window.location.href = "/profiel"; return; }
    if (vRow.actief === false) { window.location.href = "/login?blocked=1"; return; }
    if (!vRow.profiel_afgewerkt) { window.location.href = "/profiel"; return; }

    setMijnVoornaam(vRow.voornaam ?? "");

    const { data: wandelingen, error: e1 } = await supabase
      .from("ezelwandelingen")
      .select("id,titel,wanneer,startuur,einduur,omschrijving")
      .gte("wanneer", todayISODate())
      .order("wanneer", { ascending: true })
      .order("startuur", { ascending: true });

    if (e1) { setError(e1.message); setLoading(false); return; }

    const lijst = (wandelingen ?? []) as Ezelwandeling[];
    setItems(lijst);

    const ids = lijst.map((w) => w.id);
    if (ids.length === 0) { setDeelnemers([]); setLoading(false); return; }

    const { data: dl, error: e2 } = await supabase
      .from("ezelwandeling_deelnemers")
      .select("ezelwandeling_id,vrijwilliger_id,opmerking")
      .in("ezelwandeling_id", ids);

    if (e2) { setError(e2.message); setLoading(false); return; }

    const deelnemersList = (dl ?? []) as Deelnemer[];
    setDeelnemers(deelnemersList);

    const vrijwilligerIds = [...new Set(deelnemersList.map((d) => d.vrijwilliger_id))];
    if (vrijwilligerIds.length > 0) {
      const { data: vv } = await supabase
        .from("vrijwilligers")
        .select("id,voornaam")
        .in("id", vrijwilligerIds);

      const namenMap = new Map<string, string>();
      for (const v of vv ?? []) namenMap.set(v.id, v.voornaam ?? "");
      setVoornaamById(namenMap);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openInschrijfModal(w: Ezelwandeling) {
    setModalOpmerking("");
    setModalFout(null);
    setModal({ wandelingId: w.id, wandelingTitel: w.titel, mode: "inschrijven" });
  }

  function openWijzigModal(w: Ezelwandeling) {
    setModalOpmerking(getMijnOpmerking(w.id) ?? "");
    setModalFout(null);
    setModal({ wandelingId: w.id, wandelingTitel: w.titel, mode: "wijzigen" });
  }

  async function bevestigInschrijving() {
    if (!modal || !myId) return;
    const { wandelingId } = modal;
    const opmerking = modalOpmerking.trim() || null;

    setModalBezig(true);
    setModalFout(null);

    const { error } = await supabase.from("ezelwandeling_deelnemers").insert({
      ezelwandeling_id: wandelingId,
      vrijwilliger_id: myId,
      opmerking,
    });

    if (error) { setModalFout(error.message); setModalBezig(false); return; }

    setDeelnemers((prev) => [...prev, { ezelwandeling_id: wandelingId, vrijwilliger_id: myId, opmerking }]);
    setVoornaamById((prev) => {
      if (prev.has(myId)) return prev;
      return new Map(prev).set(myId, mijnVoornaam);
    });
    setModal(null);
    setModalBezig(false);
  }

  async function bevestigWijziging() {
    if (!modal || !myId) return;
    const { wandelingId } = modal;
    const opmerking = modalOpmerking.trim() || null;

    setModalBezig(true);
    setModalFout(null);

    const { error } = await supabase
      .from("ezelwandeling_deelnemers")
      .update({ opmerking })
      .eq("ezelwandeling_id", wandelingId)
      .eq("vrijwilliger_id", myId);

    if (error) { setModalFout(error.message); setModalBezig(false); return; }

    setDeelnemers((prev) =>
      prev.map((d) =>
        d.ezelwandeling_id === wandelingId && d.vrijwilliger_id === myId ? { ...d, opmerking } : d
      )
    );
    setModal(null);
    setModalBezig(false);
  }

  async function uitschrijven(wandelingId: string) {
    if (!myId) return;
    setBusyId(wandelingId);
    setError(null);

    const { error } = await supabase
      .from("ezelwandeling_deelnemers")
      .delete()
      .eq("ezelwandeling_id", wandelingId)
      .eq("vrijwilliger_id", myId);

    if (error) { setError(error.message); setBusyId(null); return; }

    setDeelnemers((prev) =>
      prev.filter((d) => !(d.ezelwandeling_id === wandelingId && d.vrijwilliger_id === myId))
    );
    setBusyId(null);
  }

  return (
    <>
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full space-y-4">
            <h2 className="font-semibold text-lg">
              {modal.mode === "inschrijven" ? "Inschrijven" : "Opmerking wijzigen"}
            </h2>
            <p className="text-sm text-gray-600">{modal.wandelingTitel}</p>
            {modalFout && <div className="wa-alert-error">{modalFout}</div>}
            <textarea
              className="w-full border rounded-xl px-3 py-2 text-sm min-h-[100px] resize-y"
              placeholder="Opmerking (optioneel)"
              value={modalOpmerking}
              onChange={(e) => setModalOpmerking(e.target.value)}
              disabled={modalBezig}
            />
            <div className="flex flex-col gap-2">
              <button
                className="wa-btn wa-btn-brand py-2 text-sm"
                onClick={modal.mode === "inschrijven" ? bevestigInschrijving : bevestigWijziging}
                disabled={modalBezig}
              >
                {modalBezig ? "Bezig…" : modal.mode === "inschrijven" ? "Bevestigen" : "Opslaan"}
              </button>
              <button
                className="wa-btn wa-btn-ghost py-2 text-sm"
                onClick={() => setModal(null)}
                disabled={modalBezig}
              >
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-4xl p-4 sm:p-6 md:p-10">
        <h1 className="text-2xl font-bold mb-2">Ezelwandelingen</h1>
        <p className="text-gray-600 mb-6 text-sm">
          Hieronder vind je alle geplande ezelwandelingen. Schrijf je in en vergeet je goeie schoenen niet!
          Vertrekpunt is altijd de weide op Waaranders.
        </p>

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
          <Kalender items={items} onBadgeClick={handleBadgeClick} />
        ) : items.length === 0 ? (
          <p className="text-gray-700">Geen toekomstige ezelwandelingen.</p>
        ) : (
          <div className="space-y-8">
            {grouped.map((g) => (
              <section key={g.key}>
                <div className="sticky top-0 z-10 -mx-4 sm:-mx-6 md:-mx-10">
                  <div className="wa-section-header px-4 sm:px-6 md:px-10 py-2">{g.title}</div>
                </div>

                <ul className="space-y-3 mt-3">
                  {g.items.map((w) => {
                    const busy = busyId === w.id;
                    const entry = deelnemersByWandeling.get(w.id);
                    const voornamen = entry?.voornamen ?? [];
                    const count = voornamen.length;
                    const preview = voornamen.slice(0, 3);
                    const rest = Math.max(0, count - preview.length);
                    const isIn = isIngeschreven(w.id);
                    const s = hhmm(w.startuur);
                    const e = hhmm(w.einduur);

                    return (
                      <li
                        key={w.id}
                        id={`wand-${w.id}`}
                        className={["wa-card p-4", isIn ? "wa-active-card" : "wa-neutral-card"].join(" ")}
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
                                {w.titel}
                              </div>
                            </div>
                            {isIn && (
                              <span className="wa-active-badge px-3 py-1 rounded-full text-sm font-bold whitespace-nowrap">
                                Jij doet mee
                              </span>
                            )}
                          </div>

                          {w.omschrijving && (
                            <div className="text-sm text-gray-700 whitespace-pre-line break-words">
                              {w.omschrijving}
                            </div>
                          )}

                          <div className="text-sm text-gray-600">{formatDatum(w.wanneer)}</div>

                          {s && e && (
                            <div className="text-sm text-gray-700">
                              <span className="text-gray-600">van</span> {s}{" "}
                              <span className="text-gray-600">tot</span> {e}
                            </div>
                          )}

                          <div className="text-sm text-gray-700">
                            <span className="text-gray-600">Deelnemers:</span>{" "}
                            {count === 0 ? (
                              <span className="text-gray-500">nog niemand</span>
                            ) : (
                              <>
                                {preview.join(", ")}
                                {rest > 0 ? ` (+${rest} meer)` : ""}
                              </>
                            )}
                          </div>

                          <div className="pt-2 flex gap-2 flex-wrap">
                            {!isIn ? (
                              <button
                                className="wa-btn wa-btn-ghost flex-1"
                                onClick={() => openInschrijfModal(w)}
                                disabled={busy}
                              >
                                Inschrijven
                              </button>
                            ) : (
                              <>
                                <button
                                  className="wa-btn wa-btn-ghost flex-1"
                                  onClick={() => uitschrijven(w.id)}
                                  disabled={busy}
                                >
                                  {busy ? "Bezig…" : "Uitschrijven"}
                                </button>
                                <button
                                  className="wa-btn wa-btn-ghost flex-1"
                                  onClick={() => openWijzigModal(w)}
                                  disabled={busy}
                                >
                                  Opmerking wijzigen
                                </button>
                              </>
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
    </>
  );
}
