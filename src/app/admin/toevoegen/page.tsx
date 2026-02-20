"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin } from "@/lib/auth";

const DOELGROEPEN = [
  { code: "DG1", label: "DG1 – (naam later)" },
  { code: "DG2", label: "DG2 – (naam later)" },
  { code: "DG3", label: "DG3 – (naam later)" },
  { code: "DG4", label: "DG4 – (naam later)" },
  { code: "DG5", label: "DG5 – (naam later)" },
  { code: "DG6", label: "DG6 – (naam later)" },
  { code: "DG7", label: "DG7 – (naam later)" },
  { code: "DG8", label: "DG8 – (naam later)" },
] as const;

export default function ToevoegenActiviteitPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const [titel, setTitel] = useState("");
  const [toelichting, settoelichting] = useState("");
  const [wanneer, setWanneer] = useState("");
  const [aantal, setAantal] = useState<number>(1);
  const [doelgroep, setDoelgroep] = useState<string>("DG1");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user ?? null;
      if (!user) {
        window.location.href = "/login";
        return;
      }

      const ok = await isDoenkerOrAdmin();
      setAllowed(ok);
      setLoading(false);
    };

    init();
  }, []);

  const save = async () => {
    setError(null);
    setMsg(null);

    if (!titel.trim()) {
      setError("Titel is verplicht.");
      return;
    }
    if (!wanneer) {
      setError("Datum (wanneer) is verplicht.");
      return;
    }

    setBusy(true);

    const payload: any = {
      titel: titel.trim(),
      toelichting: toelichting ? toelichting : null,
      wanneer, // YYYY-MM-DD
      aantal_vrijwilligers: Number.isFinite(aantal) ? aantal : null,
      doelgroep: doelgroep || null,
    };

    const { error } = await supabase.from("activiteiten").insert(payload);

    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }

    setMsg("Activiteit toegevoegd.");
    setTitel("");
    settoelichting("");
    setWanneer("");
    setAantal(1);
    setDoelgroep("DG1");

    setBusy(false);
  };

  if (loading) return <main className="mx-auto max-w-3xl p-6 md:p-10">Laden…</main>;

  if (!allowed) {
    return (
      <main className="mx-auto max-w-3xl p-6 md:p-10">
        <h1 className="text-3xl font-semibold tracking-tight mb-2">Activiteit toevoegen</h1>
        <p>Je hebt geen rechten om deze pagina te bekijken.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-6 md:p-10">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight mb-1">Activiteit toevoegen</h1>
        </div>

        <a className="border rounded-xl px-3 py-2 text-sm" href="/admin/activiteiten">
          Naar beheren
        </a>
      </div>

      {error && <p className="text-red-600 mb-4">Fout: {error}</p>}
      {msg && <p className="text-green-700 mb-4">{msg}</p>}

      <div className="border rounded-2xl p-4 bg-white/80 shadow-sm space-y-4">
        <div>
          <label className="text-sm font-medium block mb-1">Titel</label>
          <input
            className="w-full border rounded-xl p-3"
            value={titel}
            onChange={(e) => setTitel(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">toelichting</label>
          <textarea
            className="w-full border rounded-xl p-3"
            rows={4}
            value={toelichting}
            onChange={(e) => settoelichting(e.target.value)}
            placeholder="Extra info voor vrijwilligers (mag meerdere regels bevatten)"
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Datum</label>
          <input
            type="date"
            className="w-full border rounded-xl p-3"
            value={wanneer}
            onChange={(e) => setWanneer(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Aantal vrijwilligers (nodig)</label>
          <input
            type="number"
            min={0}
            className="w-full border rounded-xl p-3"
            value={aantal}
            onChange={(e) => setAantal(Number(e.target.value))}
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Doelgroep</label>
          <select
            className="w-full border rounded-xl p-3"
            value={doelgroep}
            onChange={(e) => setDoelgroep(e.target.value)}
          >
          {DOELGROEPEN.map((dg) => (<option key={dg.code} value={dg.code}> {dg.label} </option>))}
          </select>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button className="border rounded-xl px-4 py-2" onClick={save} disabled={busy}>
            {busy ? "Bezig…" : "Opslaan"}
          </button>
          <a className="border rounded-xl px-4 py-2" href="/admin/activiteiten">
            Annuleren
          </a>
        </div>
      </div>
    </main>
  );
}
