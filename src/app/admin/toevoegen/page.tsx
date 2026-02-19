"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin } from "@/lib/auth";

type Klant = {
  id: string;
  naam: string;
};

const DG_OPTIONS = ["DG1", "DG2", "DG3", "DG4", "DG5", "DG6", "DG7", "DG8"] as const;

export default function AdminToevoegenPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const [klanten, setKlanten] = useState<Klant[]>([]);

  const [titel, setTitel] = useState("");
  const [toelichting, setToelichting] = useState("");
  const [wanneer, setWanneer] = useState(""); // YYYY-MM-DD
  const [aantalVrijwilligers, setAantalVrijwilligers] = useState<number>(1);

  const [doelgroep, setDoelgroep] = useState<string>("");
  const [klantId, setKlantId] = useState<string>("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const klantById = useMemo(() => {
    const m = new Map<string, string>();
    for (const k of klanten) m.set(k.id, k.naam);
    return m;
  }, [klanten]);

  const load = async () => {
    setLoading(true);
    setError(null);

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

    const { data: k, error: eK } = await supabase
      .from("klanten")
      .select("id,naam")
      .order("naam", { ascending: true });

    if (eK) {
      setError(eK.message);
      setLoading(false);
      return;
    }

    setKlanten((k ?? []) as Klant[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => {
    setTitel("");
    setToelichting("");
    setWanneer("");
    setAantalVrijwilligers(1);
    setDoelgroep("");
    setKlantId("");
  };

  const save = async () => {
    setError(null);
    setMsg(null);

    if (!titel.trim()) {
      setError("Titel is verplicht.");
      return;
    }
    if (!wanneer) {
      setError("Kies een datum.");
      return;
    }

    setBusy(true);

    const payload: any = {
      titel: titel.trim(),
      toelichting: toelichting.trim() ? toelichting.trim() : null,
      wanneer,
      aantal_vrijwilligers: Number.isFinite(aantalVrijwilligers) ? aantalVrijwilligers : null,
      doelgroep: doelgroep || null,
      klant_id: klantId || null,
    };

    const { error } = await supabase.from("activiteiten").insert(payload);

    setBusy(false);

    if (error) {
      setError(error.message);
      return;
    }

    setMsg(
      `Activiteit toegevoegd${
        payload.klant_id ? ` (klant: ${klantById.get(payload.klant_id) ?? "?"})` : ""
      }.`
    );
    resetForm();
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
        Activiteit toevoegen
      </div>

      {error && <p className="text-red-600 mb-4">Fout: {error}</p>}
      {msg && <p className="text-green-700 mb-4">{msg}</p>}

      <div className="border rounded-2xl p-4 bg-white/80 shadow-sm space-y-4">
        <div>
          <label className="block font-medium mb-2">Titel</label>
          <input
            className="w-full border rounded-xl p-3"
            value={titel}
            onChange={(e) => setTitel(e.target.value)}
            placeholder="bv. Boswandeling met groep X"
          />
        </div>

        <div>
          <label className="block font-medium mb-2">Toelichting</label>
          <textarea
            className="w-full border rounded-xl p-3 min-h-[110px]"
            value={toelichting}
            onChange={(e) => setToelichting(e.target.value)}
            placeholder="Korte uitleg / praktische afspraken..."
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
            onClick={save}
            disabled={busy}
          >
            {busy ? "Bezig…" : "Opslaan"}
          </button>
          <button
            className="border rounded-xl px-4 py-2 text-sm"
            onClick={resetForm}
            disabled={busy}
          >
            Leegmaken
          </button>
        </div>
      </div>
    </main>
  );
}

