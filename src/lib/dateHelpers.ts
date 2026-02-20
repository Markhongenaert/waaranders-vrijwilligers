const MONTH_HEADER_FMT = new Intl.DateTimeFormat("nl-BE", { month: "long", year: "numeric" });
const WEEKDAY_FMT = new Intl.DateTimeFormat("nl-BE", { weekday: "long" });
const DAY_MONTH_FMT = new Intl.DateTimeFormat("nl-BE", { day: "numeric", month: "short" });

function capitalize(s: string) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDatumKaart(dateStr: string) {
  // dateStr is YYYY-MM-DD → maak er lokaal middernacht van om timezone-dans te vermijden
  const d = new Date(dateStr + "T00:00:00");
  return `${capitalize(WEEKDAY_FMT.format(d))} ${DAY_MONTH_FMT.format(d)}`;
}

function formatMaandTussentitel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return capitalize(MONTH_HEADER_FMT.format(d));
}

function monthKey(dateStr: string) {
  return dateStr.slice(0, 7); // YYYY-MM
}

function groupByMonth<T extends { wanneer: string }>(items: T[]) {
  const sorted = [...items].sort((a, b) => (a.wanneer < b.wanneer ? -1 : a.wanneer > b.wanneer ? 1 : 0));

  const groups: { key: string; title: string; items: T[] }[] = [];
  const idx = new Map<string, number>();

  for (const it of sorted) {
    const key = monthKey(it.wanneer);
    const pos = idx.get(key);
    if (pos === undefined) {
      idx.set(key, groups.length);
      groups.push({ key, title: formatMaandTussentitel(it.wanneer), items: [it] });
    } else {
      groups[pos].items.push(it);
    }
  }
  return groups;
}