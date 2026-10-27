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
