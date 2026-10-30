const KEY = "wa_activiteiten_scroll_target";

/** Onthoudt welke activiteit na navigatie terug naar de lijst in beeld moet komen. */
export function setActiviteitenScrollTarget(id: string) {
  try {
    sessionStorage.setItem(KEY, id);
  } catch {
    // sessionStorage niet beschikbaar (bv. privénavigatie) -> gewoon negeren
  }
}

/** Leest het onthouden doel uit en wist het meteen, zodat het maar één keer gebruikt wordt. */
export function consumeActiviteitenScrollTarget(): string | null {
  try {
    const v = sessionStorage.getItem(KEY);
    if (v) sessionStorage.removeItem(KEY);
    return v;
  } catch {
    return null;
  }
}

export type ActiviteitenWeergave = "lijst" | "kalender";

const WEERGAVE_KEY = "wa_activiteiten_weergave";

/** Onthoudt in welke weergave (lijst/kalender) je zat vóór je naar het bewerkscherm ging. */
export function setActiviteitenWeergave(weergave: ActiviteitenWeergave) {
  try {
    sessionStorage.setItem(WEERGAVE_KEY, weergave);
  } catch {
    // sessionStorage niet beschikbaar -> gewoon negeren
  }
}

/** Leest de onthouden weergave uit en wist ze meteen, zodat ze maar één keer gebruikt wordt. */
export function consumeActiviteitenWeergave(): ActiviteitenWeergave | null {
  try {
    const v = sessionStorage.getItem(WEERGAVE_KEY);
    if (v) sessionStorage.removeItem(WEERGAVE_KEY);
    return v === "lijst" || v === "kalender" ? v : null;
  } catch {
    return null;
  }
}
