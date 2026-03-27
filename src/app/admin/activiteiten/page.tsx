"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin } from "@/lib/auth";

type Activiteit = {
  id: string;
  titel: string;
  toelichting: string | null;
  wanneer: string; // YYYY-MM-DD
  startuur: string | null;
  einduur: string | null;
  aantal_vrijwilligers: number | null;
  klant_id: string | null;
  klanten: { naam: string } | { naam: string }[] | null;
  herhaling_reeks_id: string | null;
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

function formatDatumNL(dateStr: string) {
  const d = asLocalDate(dateStr);
  const weekday = capitalize(WEEKDAY_FMT.format(d));
  const dayMonth = DAY_MONTH_FMT.format(d);
  return `${weekday} ${dayMonth}`;
}

function formatMaandTussentitel(dateStr: string) {
  const d = asLocalDate(dateStr);
  return capitalize(MONTH_HEADER_FMT.format(d));
}

function monthKey(dateStr: string) {
  return dateStr.slice(0, 7);
}

function todayISODate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function klantNaamOfNull(k: Activiteit["klanten"]): string | null {
  if (!k) return null;
  if (Array.isArray(k)) return k[0]?.naam ?? null;
  return k.naam ?? null;
}

function hhmm(t: string | null): string | null {
  if (!t) return null;
  return t.length >= 5 ? t.slice(0, 5) : t;
}

export default function AdminActiviteitenPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const [items, setItems] = useState<Activiteit[]>([]);
  const [inschrijvingen, setInschrijvingen] = useState<Map<string, string[]>>(new Map());
  const loadedActIds = useRef<Set<string>>(new Set());

  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  type ReeksModal = { reeksId: string; deleteId: string };
  const [reeksModal, setReeksModal] = useState<ReeksModal | null>(null);

  const grouped = useMemo(() => {
    const sorted = [...items].sort((a, b) => (a.wanneer < b.wanneer ? -1 : a.wanneer > b.wanneer ? 1 : 0));

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

  const load = async () => {
    setLoading(true);
    setError(null);
    setMsg(null);

    const { data } = await supabase.auth.getSession();
    const user = data.session?.user ?? null;
    if (!user) {
      window.location.href = "/login";
      return;
    }

    const ok = await isDoenkerOrAdmin();
    setAllowed(ok);
    if (!ok) {
      setLoading(false);
      return;
    }

    const vanaf = todayISODate();

    const { data: acts, error: e1 } = await supabase
      .from("activiteiten")
      .select("id,titel,toelichting,wanneer,startuur,einduur,aantal_vrijwilligers,klant_id,klanten(naam),herhaling_reeks_id")
      .gte("wanneer", vanaf)
      .order("wanneer", { ascending: true })
      .order("startuur", { ascending: true });

    if (e1) {
      setError(e1.message);
      setLoading(false);
      return;
    }

    const actLijst = (acts ?? []) as unknown as Activiteit[];
    setItems(actLijst);

    const ids = actLijst.map((a) => a.id);
    loadedActIds.current = new Set(ids);

    if (ids.length > 0) {
      const { data: md } = await supabase
        .from("meedoen_met_naam")
        .select("activiteit_id,naam")
        .in("activiteit_id", ids);

      const map = new Map<string, string[]>();
      for (const row of (md ?? []) as { activiteit_id: string; naam: string }[]) {
        const lijst = map.get(row.activiteit_id) ?? [];
        lijst.push(row.naam);
        map.set(row.activiteit_id, lijst);
      }
      setInschrijvingen(map);
    } else {
      setInschrijvingen(new Map());
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const executeDelete = async (scope: "enkel" | "reeks", id: string, reeksId: string | null) => {
    setBusy(true);
    setReeksModal(null);
    setError(null);
    setMsg(null);

    let dbError = null;

    if (scope === "enkel") {
      const { error } = await supabase.from("activiteiten").delete().eq("id", id);
      dbError = error;
    } else {
      const { error } = await supabase.from("activiteiten").delete().eq("herhaling_reeks_id", reeksId);
      dbError = error;
    }

    if (dbError) {
      setError(dbError.message);
      setBusy(false);
      return;
    }

    setMsg(scope === "reeks" ? "Hele reeks verwijderd." : "Activiteit verwijderd.");
    await load();
    setBusy(false);
  };

  const deleteActiviteit = (a: Activiteit) => {
    if (a.herhaling_reeks_id) {
      setReeksModal({ reeksId: a.herhaling_reeks_id, deleteId: a.id });
      return;
    }

    const ok = window.confirm("Activiteit verwijderen? Dit kan niet ongedaan gemaakt worden.");
    if (!ok) return;

    executeDelete("enkel", a.id, null);
  };

  if (loading) return <main className="mx-auto max-w-4xl p-4 sm:p-6 md:p-10">Laden…</main>;

  if (!allowed) {
    return (
      <main className="mx-auto max-w-4xl p-4 sm:p-6 md:p-10">
        <h1 className="text-3xl font-semibold tracking-tight mb-2">Activiteiten beheren</h1>
        <p>Je hebt geen rechten om deze pagina te bekijken.</p>
      </main>
    );
  }

  return (
    <>
      {/* Modaal voor reeksverwijdering */}
      {reeksModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full space-y-4">
            <h2 className="font-semibold text-lg">Herhalende activiteit verwijderen</h2>
            <p className="text-sm text-gray-700">
              Wil je enkel deze activiteit verwijderen, of alle activiteiten in deze reeks?
            </p>
            <div className="flex flex-col gap-2">
              <button
                className="border rounded-xl px-4 py-3 text-sm bg-white hover:bg-gray-50 transition text-left"
                onClick={() => executeDelete("enkel", reeksModal.deleteId, null)}
                disabled={busy}
              >
                <span className="font-medium">Enkel deze</span>
                <span className="block text-xs text-gray-500 mt-0.5">Alleen deze activiteit wordt verwijderd.</span>
              </button>
              <button
                className="border rounded-xl px-4 py-3 text-sm bg-red-50 border-red-200 hover:bg-red-100 transition text-left"
                onClick={() => executeDelete("reeks", reeksModal.deleteId, reeksModal.reeksId)}
                disabled={busy}
              >
                <span className="font-medium text-red-700">Hele reeks</span>
                <span className="block text-xs text-gray-500 mt-0.5">Alle activiteiten in deze reeks worden verwijderd.</span>
              </button>
              <button
                className="border rounded-xl px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 transition"
                onClick={() => setReeksModal(null)}
                disabled={busy}
              >
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-4xl p-4 sm:p-6 md:p-10">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h1 className="text-3xl font-semibold tracking-tight mb-1">Activiteiten beheren</h1>
          <div className="flex gap-2">
            <a className="wa-btn-action px-3 py-2 text-sm text-center" href="/admin/toevoegen">
              Activiteit toevoegen
            </a>
          </div>
        </div>

        {error && <div className="wa-alert-error mb-4">Fout: {error}</div>}
        {msg && <div className="wa-alert-success mb-4">{msg}</div>}

        {items.length === 0 ? (
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
                    const kNaam = klantNaamOfNull(a.klanten);
                    const s = hhmm(a.startuur);
                    const e = hhmm(a.einduur);

                    return (
                      <li key={a.id} className="wa-card p-4">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-semibold whitespace-pre-line break-words text-base sm:text-lg">
                              {a.titel}
                            </div>
                            {a.herhaling_reeks_id && (
                              <span className="shrink-0 wa-badge-herhaling">↻ Reeks</span>
                            )}
                          </div>

                          {a.toelichting && (
                            <div className="text-sm text-gray-700 whitespace-pre-line break-words">
                              {a.toelichting}
                            </div>
                          )}

                          <div className="text-sm text-gray-700 flex flex-wrap gap-x-3 gap-y-1">
                            <span className="text-gray-600">{formatDatumNL(a.wanneer)}</span>
                            {s && e ? <span>van {s} tot {e}</span> : <span className="text-gray-500">(geen uren)</span>}
                            {a.aantal_vrijwilligers != null ? <span>nodig: {a.aantal_vrijwilligers}</span> : null}
                            <span>klant: {kNaam ?? "(niet ingesteld)"}</span>
                          </div>

                          {(() => {
                            const namen = inschrijvingen.get(a.id) ?? [];
                            return (
                              <div className="text-sm text-gray-700">
                                <span className="font-medium">{namen.length} ingeschreven</span>
                                {namen.length > 0 && <>: {namen.join(", ")}</>}
                              </div>
                            );
                          })()}

                          <div className="pt-2 flex gap-2">
                            <button
                              className="wa-btn wa-btn-ghost flex-1 px-4 py-2 text-sm"
                              onClick={() => router.push(`/admin/activiteiten/${a.id}`)}
                              disabled={busy}
                            >
                              Bewerken
                            </button>
                            <button
                              className="wa-btn-danger flex-1 px-4 py-2 text-sm"
                              onClick={() => deleteActiviteit(a)}
                              disabled={busy}
                            >
                              Verwijderen
                            </button>
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
