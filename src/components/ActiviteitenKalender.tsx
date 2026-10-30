"use client";

import { useMemo, useState } from "react";

export type KalenderActiviteit = {
  id: string;
  titel: string;
  wanneer: string; // YYYY-MM-DD
  aantal_vrijwilligers: number | null;
};

type Props = {
  items: KalenderActiviteit[];
  /** Aantal ingeschreven vrijwilligers per activiteit-id (voor de rood/groen-kleur van het badge). */
  aantalIngeschrevenByActId: Map<string, number>;
  onActiviteitClick: (id: string) => void;
  /** Vrijwilligersdeel: false (niet terugbladeren vóór de huidige maand). Beheer: true. */
  magVerledenBekijken: boolean;
  /** Maand waarmee de kalender opent (bv. de maand van een net bewerkte activiteit). Standaard: huidige maand. */
  initialeMaand?: { jaar: number; maand: number };
};

const CAL_MONTH_FMT = new Intl.DateTimeFormat("nl-BE", { month: "long", year: "numeric" });
const WEEKDAY_SHORT = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

function capitalize(s: string) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function calMonthLabel(jaar: number, maand: number) {
  return capitalize(CAL_MONTH_FMT.format(new Date(jaar, maand, 1)));
}

function daysInMonth(jaar: number, maand: number) {
  return new Date(jaar, maand + 1, 0).getDate();
}

// 0=Ma … 6=Zo voor de eerste dag van de maand
function firstWeekday(jaar: number, maand: number) {
  const d = new Date(jaar, maand, 1).getDay(); // 0=Zo
  return (d + 6) % 7;
}

function isoDate(jaar: number, maand: number, dag: number) {
  return `${jaar}-${String(maand + 1).padStart(2, "0")}-${String(dag).padStart(2, "0")}`;
}

function todayISODate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function maandIndex(jaar: number, maand: number) {
  return jaar * 12 + maand;
}

export default function ActiviteitenKalender({
  items,
  aantalIngeschrevenByActId,
  onActiviteitClick,
  magVerledenBekijken,
  initialeMaand,
}: Props) {
  const nu = new Date();
  const [jaar, setJaar] = useState(initialeMaand?.jaar ?? nu.getFullYear());
  const [maand, setMaand] = useState(initialeMaand?.maand ?? nu.getMonth());

  const activiteitenByDate = useMemo(() => {
    const map = new Map<string, KalenderActiviteit[]>();
    for (const a of items) {
      if (!map.has(a.wanneer)) map.set(a.wanneer, []);
      map.get(a.wanneer)!.push(a);
    }
    return map;
  }, [items]);

  const totalDays = daysInMonth(jaar, maand);
  const startOffset = firstWeekday(jaar, maand);
  const totalCells = Math.ceil((startOffset + totalDays) / 7) * 7;
  const todayStr = todayISODate();

  const kanTerug = magVerledenBekijken || maandIndex(jaar, maand) > maandIndex(nu.getFullYear(), nu.getMonth());

  const vorigeMaand = () => {
    if (!kanTerug) return;
    if (maand === 0) {
      setJaar((j) => j - 1);
      setMaand(11);
    } else {
      setMaand((m) => m - 1);
    }
  };
  const volgendeMaand = () => {
    if (maand === 11) {
      setJaar((j) => j + 1);
      setMaand(0);
    } else {
      setMaand((m) => m + 1);
    }
  };
  const gaNaarVandaag = () => {
    setJaar(nu.getFullYear());
    setMaand(nu.getMonth());
  };

  return (
    <div>
      {/* Maandnavigatie */}
      <div className="flex items-center justify-between mb-4 gap-2">
        <button
          onClick={vorigeMaand}
          disabled={!kanTerug}
          className={[
            "wa-btn wa-btn-ghost px-4 py-1 text-xl leading-none",
            !kanTerug ? "opacity-40 cursor-not-allowed" : "",
          ].join(" ")}
        >
          ‹
        </button>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-base sm:text-lg">{calMonthLabel(jaar, maand)}</span>
          {magVerledenBekijken && (
            <button onClick={gaNaarVandaag} className="wa-btn wa-btn-ghost px-3 py-1 text-xs">
              Vandaag
            </button>
          )}
        </div>
        <button onClick={volgendeMaand} className="wa-btn wa-btn-ghost px-4 py-1 text-xl leading-none">
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
          const dateStr = isInMonth ? isoDate(jaar, maand, dayNum) : null;
          const acts = dateStr ? (activiteitenByDate.get(dateStr) ?? []) : [];
          const isToday = dateStr === todayStr;
          const isPast = !!dateStr && dateStr < todayStr;

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
                      isToday ? "wa-brand rounded-full" : isPast ? "text-gray-400" : "text-gray-700",
                    ].join(" ")}
                  >
                    {dayNum}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {acts.map((a) => {
                      const ingeschreven = aantalIngeschrevenByActId.get(a.id) ?? 0;
                      const tekort = a.aantal_vrijwilligers != null && a.aantal_vrijwilligers - ingeschreven > 0;
                      const kleur = isPast
                        ? "bg-gray-400 hover:bg-gray-500"
                        : tekort
                        ? "bg-red-600 hover:bg-red-700"
                        : "bg-lime-600 hover:bg-lime-700";
                      return (
                        <button
                          key={a.id}
                          onClick={() => onActiviteitClick(a.id)}
                          className={[
                            "text-left text-xs text-white rounded px-1 py-0.5 leading-tight truncate w-full transition-colors",
                            kleur,
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
