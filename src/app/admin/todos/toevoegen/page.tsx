"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin } from "@/lib/auth";

type Vrijwilliger = { id: string; naam: string | null };

export default function TodoToevoegenPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const [vrijwilligers, setVrijwilligers] = useState<Vrijwilliger[]>([]);
  const [wat, setWat] = useState("");
  const [wie, setWie] = useState<string>("");
  const [streefdatum, setStreefdatum] = useState<string>("");
  const [prioriteit, setPrioriteit] = useState<"laag" | "normaal" | "hoog">("normaal");

  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setError(null);

      const { data: sess } = await supabase.auth.getSession();
      const user = sess.session?.user;
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

      const { data: v, error: e1 } = await supabase
        .from("vrijwilligers")
        .select("id,naam")
        .order("naam", { ascending: true });

      if (e1) {
        setError(e1.message);
        setLoading(false);
        return;
      }

      setVrijwilligers((v ?? []) as Vrijwilliger[]);
      if ((v ?? []).length > 0) setWie((v ?? [])[0].id);
      setLoading(false);
    };

    init();
  }, []);

  const save = async () => {
    setBusy(true);
    setError(null);
    setMsg(null);

    if (!wat.trim()) {
      setError("Veld 'Wat' is verplicht.");
      setBusy(false);
      return;
    }
    if (!wie) {
      setError("Kies een persoon.");
      setBusy(false);
      return;
    }

    const { data } = await supabase.auth.getSession();
    const me = data.session?.user?.id ?? null;


    const payload: any = {
      wat: wat.trim(),
      wie_vrijwilliger_id: wie,
      status: "gepland",
      prioriteit,
      streefdatum: streefdatum.trim() ? streefdatum : null,
      aangemaakt_door: me,
      bijgewerkt_door: me,
    };

    const { error } = await supabase.from("todos").insert(payload);
    if (error) setError(error.message);
    else {
      setMsg("TODO toegevoegd.");
      setWat("");
      setStreefdatum("");
      setPrioriteit("normaal");
    }

    setBusy(false);
  };

  if (loading) return <main className="mx-auto max-w-3xl p-6 md:p-10">Laden…</main>;

  if (!allowed) {
    return (
      <main className="mx-auto max-w-3xl p-6 md:p-10">
        <h1 className="text-3xl font-semibold tracking-tight mb-2">TODO toevoegen</h1>
        <p>Je hebt geen rechten om deze pagina te bekijken.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-6 md:p-10">
      <h1 className="text-3xl font-semibold tracking-tight mb-2">TODO toevoegen</h1>
      <p className="text-gray-600 mb-6">Maak een taak aan en wijs ze toe aan iemand.</p>

      {error && <p className="text-red-600 mb-4">Fout: {error}</p>}
      {msg && <p className="text-green-700 mb-4">{msg}</p>}

      <div className="border rounded-2xl p-4 bg-white/80 shadow-sm space-y-4">
        <div>
          <label className="text-sm font-medium block mb-1">Wat</label>
          <input
            className="w-full border rounded-xl p-3"
            value={wat}
            onChange={(e) => setWat(e.target.value)}
            placeholder="bv. Bel klant X terug"
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Wie</label>
          <select className="w-full border rounded-xl p-3" value={wie} onChange={(e) => setWie(e.target.value)}>
            {vrijwilligers.map((v) => (
              <option key={v.id} value={v.id}>
                {v.naam ?? "(naam ontbreekt)"}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Streefdatum</label>
          <input className="w-full border rounded-xl p-3" type="date" value={streefdatum} onChange={(e) => setStreefdatum(e.target.value)} />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Prioriteit</label>
          <select className="w-full border rounded-xl p-3" value={prioriteit} onChange={(e) => setPrioriteit(e.target.value as any)}>
            <option value="laag">Laag</option>
            <option value="normaal">Normaal</option>
            <option value="hoog">Hoog</option>
          </select>
        </div>

        <div className="flex gap-2">
          <button className="border rounded-xl px-4 py-2" onClick={save} disabled={busy}>
            {busy ? "Bezig…" : "Opslaan"}
          </button>
          <a className="border rounded-xl px-4 py-2" href="/admin/todos">
            Terug
          </a>
        </div>
      </div>
    </main>
  );
}
