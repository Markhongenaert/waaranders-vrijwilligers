"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin } from "@/lib/auth";

type Activiteit = {
  id: string;
  titel: string;
  wanneer: string; // YYYY-MM-DD
  aantal_vrijwilligers: number | null;
  toelichting: string | null;
  doelgroep: string | null;

  klant_id: string | null;
  klanten?: { naam: string | null } | null; // join in beheer
};

type Klant = {
  id: string;
  naam: string;
};

const WEEKDAY_FMT = new Intl.DateTimeFormat("nl-BE", { weekday: "long" });
const DAY_MONTH_FMT = new Intl.DateTimeFormat("nl-BE", { day: "numeric", month: "short" });
function capitalize(s: string) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function formatDatumKaart(dateStr: string) {
  const d = new Date(dateStr);
  return `${capitalize(WEEKDAY_FMT.format(d))} ${DAY_MONTH_FMT.format(d)}`;
}
function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

const DG_OPTIONS = ["DG1", "DG2", "DG3", "DG4", "DG5", "DG6", "DG7", "DG8"] as const;

export default function AdminActiviteitenPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const [items, setItems] = useState<Activiteit[]>([]);
  const [klanten, setKlanten] = useState<Klant[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [editing, setEditing] = useState<Activiteit | null>(null);

  // edit fields
  const [titel, setTitel] = useState("");
  const [toelichting, setToelichting] = useState("");
  const [wanneer, setWanneer] = useState("");
  const [aantalVrijwilligers, setAantalVrijwilligers] = useState<number>(1);
  const [doelgroep, setDoelgroep] = useState<string>("");
  const [klantId, setKlantId] = useState<string>("");

  const klantById = useMemo(() => {
    const m = new Map<string, string>();
    for (const k of klanten) m.set(k.id, k.naam);
    return m;
  }, [klanten]);

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

    // klanten voor dropdown
    const { data: k, error: eK } = await supabase
      .from("klanten")
      .select("id,naam")
      .order("naam", { ascending: true });

    if (eK) {
      setError(eK.message);
      setLoading(false);
      return;
    }

    // activiteiten vanaf vandaag (zoals beheer)
    const vanaf = todayISODate();
    const { data: a, error: eA } = await supabase
      .from("activiteiten")
      .select("id,titel,wanneer,aantal_vrijwilligers,toelichting,doelgroep,klant_id,klanten(naam)")
      .gte("wanneer", vanaf)
      .order("wanneer", { ascending: true });

    if (eA) {
      setError(eA.message);
      setLoading(false);
      return;
    }

    setKlanten((k ?? []) as Klant[]);
    setItems((a ?? []) as Activiteit[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startEdit = (a: Activiteit) => {
    setEditing(a);
    setTitel(a.titel ?? "");
    setToelichting(a.toelichting ?? "");
    setWanneer(a.wanneer ?? "");
    setAantalVrijwilligers(a.aantal_vrijwilligers ?? 1);
    setDoelgroep(a.doelgroep ?? "");
    setKlantId(a.klant_id ?? "");
    setMsg(null);
    setError(null);
  };

  const cancelEdit = () => {
    setEditing(null);
  };

  const saveEdit = async () => {
    if (!editing) return;

    setBusy(true);
    setError(null);
    setMsg(null);

    if (!titel.trim()) {
      setError("Titel is verplicht.");
      setBusy(false);
      return;
    }
    if (!wanneer) {
      setError("Kies een datum.");
      setBusy(false);
      return;
    }

    const payload: any = {
      titel: titel.trim(),
      toelichting: toelichting.trim() ? toelichting.trim() : null,
      wanneer,
      aantal_vrijwilligers: Number.isFinite(aantalVrijwilligers) ? aantalVrijwilligers : null,
      doelgroep: doelgroep || null,
      klant_id: klantId || null,
    };

    const { error } = await supabase.from("activiteiten").update(payload).eq("id", editing.id);

    setBusy(false);

    if (error) {
      setError(error.message);
      return;
    }

    setMsg(
      `Activiteit aangepast${
        payload.klant_id ? ` (klant: ${klantById.get(payload.klant_id) ?? "?"})` : ""
      }.`
    );
    setEditing(null);
    await load();
  };

  const deleteActiviteit = async (id: string) => {
    if (!confirm("Deze activiteit verwijderen?")) return;

    setBusy(true);
    setError(null);
    setMsg(null);

    const { error } = await supabase.from("activiteiten").delete().eq("id", id);

    setBusy(false);

    if (error) {
      setError(error.message);
      return;
    }

    setMsg("Activiteit verwijderd.");
    await load();
  };

  if (loading) return <main className="mx-auto max-w-3xl p-6 md:p-10">Laden…</main>;

  if (!allowed) {
    return (
      <main className="mx-auto max-w-3xl p-6 md:p-10">
        <p>Je hebt geen toegang.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-6 md:p-10">
      <div className="bg-blue-900 text-white font-bold px-4 py-2 rounded-xl mb-6">
        Activiteiten beheren
      </div>

      {error && <p className="text-red-600 mb-4">Fout: {error}</p>}
      {msg && <p className="text-green-700 mb-4">{msg}</p>}

      {editing && (
        <div className="border rounded-2xl p-4 bg-white/80 shadow-sm mb-6">
          <div className="font-semibold mb-4">Bewerken</div>

          <div className="space-y-4">
            <div>
              <label className="block font-medium mb-2">Titel</label>
              <input
                className="w-full border rounded-xl p-3"
                value={titel}
                onChange={(e) => setTitel(e.target.value)}
              />
            </div>

            <div>
              <label className="block font-medium mb-2">Toelichting</label>
              <textarea
                className="w-full border rounded-xl p-3 min-h-[110px]"
                value={toelichting}
                onChange={(e) => setToelichting(e.target.value)}
              />
            </div>

            <div>
              <label className="block font-medium mb-2">Klant</label>
              <select
                className="w-full border rounded-xl p-3"
                value={klantId}
                onChange={(e) => setKlantId(e.target.value)}
              >
                <option value="">(geen klant)</option>
                {klanten.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.naam}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-medium mb-2">Datum</label>
                <input
                  className="w-full border rounded-xl p-3"
                  type="date"
                  value={wanneer}
                  onChange={(e) => setWanneer(e.target.value)}
                />
              </div>

              <div>
                <label className="block font-medium mb-2">Nodig # vrijwilligers</label>
                <input
                  className="w-full border rounded-xl p-3"
                  type="number"
                  min={0}
                  value={aantalVrijwilligers}
                  onChange={(e) => setAantalVrijwilligers(parseInt(e.target.value || "0", 10))}
                />
              </div>

              <div>
                <label className="block font-medium mb-2">Doelgroep</label>
                <select
                  className="w-full border rounded-xl p-3"
                  value={doelgroep}
                  onChange={(e) => setDoelgroep(e.target.value)}
                >
                  <option value="">(geen)</option>
                  {DG_OPTIONS.map((dg) => (
                    <option key={dg} value={dg}>
                      {dg}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                className="border rounded-xl px-4 py-2 text-sm"
                onClick={saveEdit}
                disabled={busy}
              >
                {busy ? "Bezig…" : "Opslaan"}
              </button>
              <button
                className="border rounded-xl px-4 py-2 text-sm"
                onClick={cancelEdit}
                disabled={busy}
              >
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-gray-600">Nog geen toekomstige activiteiten.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((a) => (
            <li key={a.id} className="border rounded-2xl p-4 bg-white/80 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-medium break-words">{a.titel}</div>

                  {a.toelichting && (
                    <div className="text-sm text-gray-700 mt-2 whitespace-pre-line break-words">
                      {a.toelichting}
                    </div>
                  )}

                  <div className="text-sm text-gray-600 mt-2 flex flex-wrap gap-2">
                    <span>{formatDatumKaart(a.wanneer)}</span>

                    {a.klanten?.naam ? <span>• {a.klanten.naam}</span> : null}

                    {a.aantal_vrijwilligers != null ? (
                      <span>• nodig: {a.aantal_vrijwilligers}</span>
                    ) : null}

                    {a.doelgroep ? <span>• {a.doelgroep}</span> : null}
                  </div>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button
                    className="border rounded-xl px-3 py-2 text-sm"
                    onClick={() => startEdit(a)}
                    disabled={busy}
                  >
                    Bewerken
                  </button>
                  <button
                    className="border rounded-xl px-3 py-2 text-sm"
                    onClick={() => deleteActiviteit(a.id)}
                    disabled={busy}
                  >
                    Verwijderen
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

