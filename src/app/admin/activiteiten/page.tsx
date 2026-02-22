"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin } from "@/lib/auth";

type KlantMini = {
  id: string;
  naam: string;
};

type DoelgroepMini = {
  id: string;
  titel: string;
};

type Activiteit = {
  id: string;
  titel: string;
  toelichting: string | null;
  wanneer: string; // YYYY-MM-DD
  aantal_vrijwilligers: number | null;

  klant_id: string | null;
  klanten: { naam: string } | { naam: string }[] | null;

  doelgroep_id: string | null;
  doelgroepen: { titel: string } | { titel: string }[] | null;
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

function doelgroepTitelOfNull(dg: Activiteit["doelgroepen"]): string | null {
  if (!dg) return null;
  if (Array.isArray(dg)) return dg[0]?.titel ?? null;
  return dg.titel ?? null;
}

export default function AdminActiviteitenPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const [items, setItems] = useState<Activiteit[]>([]);
  const [klanten, setKlanten] = useState<KlantMini[]>([]);
  const [doelgroepen, setDoelgroepen] = useState<DoelgroepMini[]>([]);

  const [klantenLoaded, setKlantenLoaded] = useState(false);
  const [doelgroepenLoaded, setDoelgroepenLoaded] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitel, setEditTitel] = useState("");
  const [editToelichting, setEditToelichting] = useState("");
  const [editWanneer, setEditWanneer] = useState("");
  const [editAantal, setEditAantal] = useState<number>(1);
  const [editKlantId, setEditKlantId] = useState<string>("");
  const [editDoelgroepId, setEditDoelgroepId] = useState<string>("");

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

  const loadKlanten = async (): Promise<KlantMini[]> => {
    setKlantenLoaded(false);

    const { data, error: e } = await supabase
      .from("klanten")
      .select("id,naam")
      .eq("actief", true)
      .is("gearchiveerd_op", null)
      .order("naam", { ascending: true });

    if (e) {
      setError(e.message);
      setKlanten([]);
      setKlantenLoaded(true);
      return [];
    }

    const list = (data ?? []) as KlantMini[];
    setKlanten(list);
    setKlantenLoaded(true);
    return list;
  };

  const loadDoelgroepen = async (): Promise<DoelgroepMini[]> => {
    setDoelgroepenLoaded(false);

    const { data, error: e } = await supabase
      .from("doelgroepen")
      .select("id,titel")
      .order("titel", { ascending: true });

    if (e) {
      setError(e.message);
      setDoelgroepen([]);
      setDoelgroepenLoaded(true);
      return [];
    }

    const list = (data ?? []) as DoelgroepMini[];
    setDoelgroepen(list);
    setDoelgroepenLoaded(true);
    return list;
  };

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

    await Promise.all([loadKlanten(), loadDoelgroepen()]);

    const vanaf = todayISODate();

    const { data: acts, error: e1 } = await supabase
      .from("activiteiten")
      .select("id,titel,toelichting,wanneer,aantal_vrijwilligers,klant_id,klanten(naam),doelgroep_id,doelgroepen(titel)")
      .gte("wanneer", vanaf)
      .order("wanneer", { ascending: true });

    if (e1) {
      setError(e1.message);
      setLoading(false);
      return;
    }

    setItems((acts ?? []) as unknown as Activiteit[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startEdit = async (a: Activiteit) => {
    setMsg(null);
    setError(null);

    // safety: zeker dat dropdown data er is
    const [kList, dgList] = await Promise.all([
      klantenLoaded ? Promise.resolve(klanten) : loadKlanten(),
      doelgroepenLoaded ? Promise.resolve(doelgroepen) : loadDoelgroepen(),
    ]);

    setEditingId(a.id);
    setEditTitel(a.titel ?? "");
    setEditToelichting(a.toelichting ?? "");
    setEditWanneer(a.wanneer ?? "");
    setEditAantal(a.aantal_vrijwilligers ?? 1);

    const klantFallback = kList[0]?.id ?? "";
    setEditKlantId(a.klant_id ?? klantFallback);

    const dgFallback = dgList[0]?.id ?? "";
    setEditDoelgroepId(a.doelgroep_id ?? dgFallback);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitel("");
    setEditToelichting("");
    setEditWanneer("");
    setEditAantal(1);
    setEditKlantId("");
    setEditDoelgroepId("");
  };

  const saveEdit = async () => {
    if (!editingId) return;

    setBusy(true);
    setError(null);
    setMsg(null);

    if (!editTitel.trim()) {
      setError("Titel is verplicht.");
      setBusy(false);
      return;
    }
    if (!editWanneer) {
      setError("Datum (wanneer) is verplicht.");
      setBusy(false);
      return;
    }
    if (!editKlantId) {
      setError("Klant is verplicht.");
      setBusy(false);
      return;
    }
    if (!editDoelgroepId) {
      setError("Doelgroep is verplicht.");
      setBusy(false);
      return;
    }

    const payload: any = {
      titel: editTitel.trim(),
      toelichting: editToelichting ? editToelichting : null,
      wanneer: editWanneer,
      aantal_vrijwilligers: Number.isFinite(editAantal) ? editAantal : null,
      klant_id: editKlantId,
      doelgroep_id: editDoelgroepId,
    };

    const { error } = await supabase.from("activiteiten").update(payload).eq("id", editingId);

    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }

    setMsg("Activiteit bijgewerkt.");
    cancelEdit();
    await load();
    setBusy(false);
  };

  const deleteActiviteit = async (id: string) => {
    const ok = window.confirm("Activiteit verwijderen? Dit kan niet ongedaan gemaakt worden.");
    if (!ok) return;

    setBusy(true);
    setError(null);
    setMsg(null);

    const { error } = await supabase.from("activiteiten").delete().eq("id", id);

    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }

    setMsg("Activiteit verwijderd.");
    await load();
    setBusy(false);
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
    <main className="mx-auto max-w-4xl p-4 sm:p-6 md:p-10">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight mb-1">Activiteiten beheren</h1>
        </div>

        <div className="flex gap-2">
          <a className="border rounded-xl px-3 py-2 text-sm bg-white" href="/admin/toevoegen">
            + Toevoegen
          </a>
          <button className="border rounded-xl px-3 py-2 text-sm bg-white" onClick={load} disabled={busy}>
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <p className="text-red-700 bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
          Fout: {error}
        </p>
      )}
      {msg && (
        <p className="text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-xl p-3 mb-4">
          {msg}
        </p>
      )}

      {items.length === 0 ? (
        <p className="text-gray-700">Geen toekomstige activiteiten.</p>
      ) : (
        <div className="space-y-8">
          {grouped.map((g) => (
            <section key={g.key}>
              {/* Plakt tegen bovenrand */}
              <div className="sticky top-0 z-10 -mx-4 sm:-mx-6 md:-mx-10">
                <div className="bg-blue-100 text-black font-semibold px-4 sm:px-6 md:px-10 py-2 border-b border-blue-200">
                  {g.title}
                </div>
              </div>

              <ul className="space-y-3 mt-3">
                {g.items.map((a) => {
                  const isEditing = editingId === a.id;
                  const kNaam = klantNaamOfNull(a.klanten);
                  const dgTitel = doelgroepTitelOfNull(a.doelgroepen);

                  return (
                    <li key={a.id} className="rounded-2xl p-4 shadow-sm bg-white border border-gray-200">
                      {!isEditing ? (
                        <div className="space-y-3">
                          <div className="font-semibold whitespace-pre-line break-words text-base sm:text-lg">
                            {a.titel}
                          </div>

                          {a.toelichting && (
                            <div className="text-sm text-gray-700 whitespace-pre-line break-words">
                              {a.toelichting}
                            </div>
                          )}

                          <div className="text-sm text-gray-700 flex flex-wrap gap-x-3 gap-y-1">
                            <span className="text-gray-600">{formatDatumNL(a.wanneer)}</span>
                            {a.aantal_vrijwilligers != null ? <span>nodig: {a.aantal_vrijwilligers}</span> : null}
                            <span>klant: {kNaam ?? "(niet ingesteld)"}</span>
                            <span>doelgroep: {dgTitel ?? "(niet ingesteld)"}</span>
                          </div>

                          {/* Buttons onderaan naast elkaar */}
                          <div className="pt-2 flex gap-2">
                            <button
                              className="flex-1 rounded-xl px-4 py-2 text-sm font-medium bg-white border hover:bg-gray-50 transition"
                              onClick={() => startEdit(a)}
                              disabled={busy}
                            >
                              Bewerken
                            </button>
                            <button
                              className="flex-1 rounded-xl px-4 py-2 text-sm font-medium bg-white border hover:bg-gray-50 transition"
                              onClick={() => deleteActiviteit(a.id)}
                              disabled={busy}
                            >
                              Verwijderen
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium block mb-1">Titel</label>
                            <input className="w-full border rounded-xl p-3 bg-white" value={editTitel} onChange={(e) => setEditTitel(e.target.value)} />
                          </div>

                          <div>
                            <label className="text-sm font-medium block mb-1">Toelichting</label>
                            <textarea className="w-full border rounded-xl p-3 bg-white" rows={4} value={editToelichting} onChange={(e) => setEditToelichting(e.target.value)} />
                          </div>

                          <div>
                            <label className="text-sm font-medium block mb-1">Datum</label>
                            <input type="date" className="w-full border rounded-xl p-3 bg-white" value={editWanneer} onChange={(e) => setEditWanneer(e.target.value)} />
                          </div>

                          <div>
                            <label className="text-sm font-medium block mb-1">Klant (verplicht)</label>
                            <select className="w-full border rounded-xl p-3 bg-white" value={editKlantId} onChange={(e) => setEditKlantId(e.target.value)}>
                              {klanten.map((k) => (
                                <option key={k.id} value={k.id}>
                                  {k.naam}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-sm font-medium block mb-1">Doelgroep (verplicht)</label>
                            <select className="w-full border rounded-xl p-3 bg-white" value={editDoelgroepId} onChange={(e) => setEditDoelgroepId(e.target.value)}>
                              {doelgroepen.map((dg) => (
                                <option key={dg.id} value={dg.id}>
                                  {dg.titel}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-sm font-medium block mb-1">Aantal vrijwilligers (nodig)</label>
                            <input type="number" min={0} className="w-full border rounded-xl p-3 bg-white" value={editAantal} onChange={(e) => setEditAantal(Number(e.target.value))} />
                          </div>

                          <div className="flex gap-2">
                            <button className="flex-1 rounded-xl px-4 py-2 text-sm font-medium bg-white border hover:bg-gray-50 transition" onClick={saveEdit} disabled={busy}>
                              {busy ? "Bezig…" : "Opslaan"}
                            </button>
                            <button className="flex-1 rounded-xl px-4 py-2 text-sm font-medium bg-white border hover:bg-gray-50 transition" onClick={cancelEdit} disabled={busy}>
                              Annuleren
                            </button>
                          </div>
                        </div>
                      )}
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