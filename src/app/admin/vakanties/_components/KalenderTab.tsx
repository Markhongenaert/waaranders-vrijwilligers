"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Doenker, VakantiePerio } from "../page";

type Props = {
  doenkers: Doenker[];
  perioden: VakantiePerio[];
};

type Popup = {
  iso: string;
  aanwezig: Doenker[];
};

const MAANDEN = [
  "januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december",
];
const WEEKDAGEN = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

// Gebruik lokale datumonderdelen om UTC-verschuiving te vermijden
function toISOLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Maandag-gebaseerde weekdag (0=ma, 6=zo)
function mondayBasedDay(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function isOnVakantie(p: VakantiePerio, iso: string): boolean {
  return p.begin_datum <= iso && iso <= p.eind_datum;
}

function fullName(d: Doenker) {
  return [d.voornaam ?? "", d.achternaam ?? ""].join(" ").trim() || "—";
}

function badgeColor(count: number): string {
  if (count >= 6) return "bg-green-500";
  if (count >= 4) return "bg-orange-500";
  return "bg-red-500";
}

export default function KalenderTab({ doenkers, perioden }: Props) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0–11
  const [popup, setPopup] = useState<Popup | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const prevMonth = useCallback(() => {
    setMonth((m) => {
      if (m === 0) {
        setYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }, []);

  const nextMonth = useCallback(() => {
    setMonth((m) => {
      if (m === 11) {
        setYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }, []);

  // Scroll-navigatie via native event listener (passive: false zodat preventDefault werkt)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY > 0) nextMonth();
      else prevMonth();
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [prevMonth, nextMonth]);

  // Bouw dag-array voor de huidige maand
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const offset = mondayBasedDay(firstDay);

  const days: Date[] = [];
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d));
  }

  const todayISO = toISOLocal(now);

  function getAanwezig(date: Date): Doenker[] {
    const iso = toISOLocal(date);
    return doenkers.filter((d) => {
      return !perioden.some(
        (p) => p.vrijwilliger_id === d.id && isOnVakantie(p, iso)
      );
    });
  }

  return (
    <div className="space-y-3">
      {/* Maandnavigatie */}
      <div className="flex items-center gap-4">
        <button onClick={prevMonth} className="wa-btn wa-btn-ghost px-3 py-1.5 text-sm">
          ‹
        </button>
        <span className="font-semibold text-gray-800 min-w-[160px] text-center capitalize">
          {MAANDEN[month]} {year}
        </span>
        <button onClick={nextMonth} className="wa-btn wa-btn-ghost px-3 py-1.5 text-sm">
          ›
        </button>
        <button
          onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()); }}
          className="wa-btn wa-btn-ghost px-3 py-1.5 text-sm"
        >
          Vandaag
        </button>
      </div>

      {/* Kalender grid — scroll navigeert maanden */}
      <div ref={containerRef} className="select-none cursor-default">
        {/* Weekdagnamen */}
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAGEN.map((d) => (
            <div key={d} className="text-xs font-medium text-gray-500 text-center py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Dagen */}
        <div className="grid grid-cols-7 gap-1">
          {/* Lege vakjes voor offset */}
          {Array.from({ length: offset }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}

          {days.map((date) => {
            const iso = toISOLocal(date);
            const aanwezig = getAanwezig(date);
            const color = badgeColor(aanwezig.length);
            const isToday = iso === todayISO;

            return (
              <div
                key={iso}
                onClick={() => setPopup({ iso, aanwezig })}
                className={`rounded-lg p-1 flex flex-col items-center gap-0.5 cursor-pointer hover:bg-gray-50 transition ${
                  isToday ? "ring-2 ring-blue-400" : ""
                }`}
              >
                <span className="text-xs text-gray-700 font-medium leading-none">
                  {date.getDate()}
                </span>
                <span
                  className={`text-xs font-bold text-white rounded-full px-1.5 py-0.5 leading-none ${color}`}
                >
                  {aanwezig.length}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Popup */}
      {popup && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setPopup(null)}
        >
          <div
            className="wa-card p-5 w-full max-w-sm space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">
                Aanwezig op {popup.iso.split("-").reverse().join("/")}
              </h2>
              <button
                onClick={() => setPopup(null)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                aria-label="Sluiten"
              >
                ✕
              </button>
            </div>

            {popup.aanwezig.length === 0 ? (
              <p className="text-sm text-gray-500">Niemand aanwezig.</p>
            ) : (
              <ul className="space-y-1">
                {popup.aanwezig.map((d) => (
                  <li key={d.id} className="text-sm text-gray-700">
                    {fullName(d)}
                  </li>
                ))}
              </ul>
            )}

            <button
              onClick={() => setPopup(null)}
              className="wa-btn wa-btn-ghost w-full py-2 text-sm"
            >
              Sluiten
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
