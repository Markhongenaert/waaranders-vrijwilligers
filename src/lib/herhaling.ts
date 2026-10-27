export type HerhalingType = "wekelijks" | "maandelijks";
export type StopType = "aantal" | "datum";

export type HerhalingWaarden = {
  herhaling: boolean;
  type: HerhalingType;
  interval: string;
  stopType: StopType;
  stopAantal: string;
  stopDatum: string;
};

export function standaardHerhalingWaarden(): HerhalingWaarden {
  return {
    herhaling: false,
    type: "wekelijks",
    interval: "1",
    stopType: "aantal",
    stopAantal: "4",
    stopDatum: "",
  };
}

/** Genereer alle datums voor een herhalende activiteit, vanaf (en inclusief) `start`. */
export function genereerHerhalingsDatums(
  start: string,
  type: HerhalingType,
  interval: number,
  stop: { type: "aantal"; count: number } | { type: "datum"; until: string }
): string[] {
  const dates: string[] = [];
  let current = new Date(`${start}T00:00:00`);
  const MAX = 500;

  while (dates.length < MAX) {
    const iso = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;

    if (stop.type === "datum" && iso > stop.until) break;
    if (stop.type === "aantal" && dates.length >= stop.count) break;

    dates.push(iso);

    if (type === "wekelijks") {
      current = new Date(current.getTime() + interval * 7 * 24 * 60 * 60 * 1000);
    } else {
      const next = new Date(current);
      next.setMonth(next.getMonth() + interval);
      current = next;
    }
  }

  return dates;
}

/** Valideert de herhalingsvelden. Geeft een foutmelding terug, of null als alles in orde is. */
export function valideerHerhaling(w: HerhalingWaarden, startDatum: string): string | null {
  if (!w.herhaling) return null;

  const intervalNum = parseInt(w.interval, 10);
  if (isNaN(intervalNum) || intervalNum < 1) return "Interval moet minstens 1 zijn.";

  if (w.stopType === "datum") {
    if (!w.stopDatum) return "Einddatum is verplicht bij 'Tot datum'.";
    if (w.stopDatum <= startDatum) return "Einddatum moet na de startdatum liggen.";
  } else {
    const stopAantalNum = parseInt(w.stopAantal, 10);
    if (isNaN(stopAantalNum) || stopAantalNum < 1) return "Aantal herhalingen moet minstens 1 zijn.";
  }

  return null;
}

/** Zet herhalingswaarden om naar de datumlijst, uitgaande van `startDatum`. */
export function datumsVoorWaarden(w: HerhalingWaarden, startDatum: string): string[] {
  if (!w.herhaling) return [startDatum];
  return genereerHerhalingsDatums(
    startDatum,
    w.type,
    parseInt(w.interval, 10),
    w.stopType === "aantal"
      ? { type: "aantal", count: parseInt(w.stopAantal, 10) }
      : { type: "datum", until: w.stopDatum }
  );
}

/** Zet herhalingswaarden om naar de kolommen zoals opgeslagen op een activiteiten-rij. */
export function herhalingKolommen(w: HerhalingWaarden) {
  if (!w.herhaling) {
    return {
      herhaling_type: null as HerhalingType | null,
      herhaling_interval: null as number | null,
      herhaling_einde_datum: null as string | null,
      herhaling_einde_aantal: null as number | null,
    };
  }
  return {
    herhaling_type: w.type,
    herhaling_interval: parseInt(w.interval, 10),
    herhaling_einde_datum: w.stopType === "datum" ? w.stopDatum : null,
    herhaling_einde_aantal: w.stopType === "aantal" ? parseInt(w.stopAantal, 10) : null,
  };
}

/**
 * Vergelijkt twee herhalingsregels op betekenisvolle wijze: enkel de velden die
 * de regel zelf bepalen (niet bv. of je toevallig hetzelfde "stopAantal" intikte
 * terwijl stopType "datum" is).
 */
export function herhalingRegelGelijk(a: HerhalingWaarden, b: HerhalingWaarden): boolean {
  if (a.herhaling !== b.herhaling) return false;
  if (!a.herhaling) return true; // beide uit -> gelijk, ongeacht de andere velden

  if (a.type !== b.type) return false;
  if (parseInt(a.interval, 10) !== parseInt(b.interval, 10)) return false;
  if (a.stopType !== b.stopType) return false;

  if (a.stopType === "datum") return a.stopDatum === b.stopDatum;
  return parseInt(a.stopAantal, 10) === parseInt(b.stopAantal, 10);
}
