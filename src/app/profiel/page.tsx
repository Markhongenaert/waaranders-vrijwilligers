"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ProfielPage() {
  const [loading, setLoading] = useState(true);
  const [naam, setNaam] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data: prof, error } = await supabase
        .from("vrijwilligers")
        .select("naam")
        .eq("id", user.id)
        .maybeSingle();

      if (error) setErr(error.message);
      if (prof?.naam) setNaam(prof.naam);

      setLoading(false);
    };

    load();
  }, []);

  const save = async () => {
    setErr(null);
    setMsg(null);

    const n = naam.trim();
    if (n.length < 2) {
      setErr("Kies een naam van minstens 2 tekens.");
      return;
    }

    setBusy(true);

    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) {
      window.location.href = "/login";
      return;
    }

    // upsert: maakt rij als die nog niet bestaat, of update als die bestaat
    const { error } = await supabase
      .from("vrijwilligers")
      .upsert({ id: user.id, naam: n });

    if (error) {
      setErr(error.message);
      setBusy(false);
      return;
    }

    setMsg("Opgeslagen.");
    setBusy(false);
    window.location.href = "/activiteiten";
  };

  if (loading) return <main className="p-8">Laden…</main>;

  return (
    <main className="p-8 max-w-md">
      <h1 className="text-3xl font-bold mb-4">Jouw profiel</h1>

      <label className="block font-medium mb-2">Hoe mogen we je noemen?</label>
      <input
        className="w-full border rounded-xl p-3 mb-4"
        value={naam}
        onChange={(e) => setNaam(e.target.value)}
        placeholder="bv. Mark"
      />

      <button
        className="border rounded-xl px-5 py-3 font-medium"
        onClick={save}
        disabled={busy}
      >
        {busy ? "Bezig…" : "Opslaan"}
      </button>

      {msg && <p className="mt-4 text-green-700">{msg}</p>}
      {err && <p className="mt-4 text-red-600">Fout: {err}</p>}
    </main>
  );
}
 