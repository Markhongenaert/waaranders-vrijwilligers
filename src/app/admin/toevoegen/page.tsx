"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type NewActiviteit = {
  titel: string;
  wanneer: string; // YYYY-MM-DD
  doelgroep: string;
  aantal_vrijwilligers: number;
};

function todayLocalYYYYMMDD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function AdminToevoegenPage() {
  const [form, setForm] = useState<NewActiviteit>({
    titel: "",
    wanneer: todayLocalYYYYMMDD(),
    doelgroep: "",
    aantal_vrijwilligers: 1,
  });

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // optioneel: zet focus of init later
  useEffect(() => {}, []);

  const update = (patch: Partial<NewActiviteit>) => {
    setForm((f) => ({ ...f, ...patch }));
  };

  const createActiviteit = async () => {
    setMsg(null);
    setErr(null);

    if (!form.titel.trim()) {
      setErr("Titel is verplicht.");
      return;
    }
    if (!form.wanneer) {
      setErr("Datum (wanneer) is verplicht.");
      return;
    }
    if (!Number.isFinite(form.aantal_vrijwilligers) || form.aantal_vrijwilligers < 0) {
      setErr("Aantal vrijwilligers moet 0 of hoger zijn.");
      return;
    }

    setBusy(true);

    const { error } = await supabase.from("activiteiten").insert({
      titel: form.titel.trim(),
      wanneer: form.wanneer,
      doelgroep: form.doelgroep.trim() || null,
      aantal_vrijwilligers: form.aantal_vrijwilligers,
    });

    if (error) {
      setErr(error.message);
      setBusy(false);
      return;
    }

    setMsg("Activiteit toegevoegd.");
    setForm((f) => ({ ...f, titel: "", doelgroep: "", aantal_vrijwilligers: 1 }));
    setBusy(false);
  };

  return (
    <>
      <h2 className="text-2xl font-bold mb-4">Activiteit toevoegen</h2>

      <label className="block font-medium mb-2">Titel</label>
      <input
        className="w-full border rounded-xl p-3 mb-4"
        value={form.titel}
        onChange={(e) => update({ titel: e.target.value })}
        placeholder="bv. Ponywandeling Meerdaalwoud"
      />

      <label className="block font-medium mb-2">Wanneer (datum)</label>
      <input
        className="w-full border rounded-xl p-3 mb-4"
        type="date"
        value={form.wanneer}
        onChange={(e) => update({ wanneer: e.target.value })}
      />

      <label className="block font-medium mb-2">Doelgroep</label>
      <input
        className="w-full border rounded-xl p-3 mb-4"
        value={form.doelgroep}
        onChange={(e) => update({ doelgroep: e.target.value })}
        placeholder="bv. gezinnen / scholen / iedereen"
      />

      <label className="block font-medium mb-2">Aantal vrijwilligers nodig</label>
      <input
        className="w-full border rounded-xl p-3 mb-6"
        type="number"
        min={0}
        value={form.aantal_vrijwilligers}
        onChange={(e) => update({ aantal_vrijwilligers: Number(e.target.value) })}
      />

      <button
        className="border rounded-xl px-5 py-3 font-medium"
        onClick={createActiviteit}
        disabled={busy}
      >
        {busy ? "Bezig…" : "Toevoegen"}
      </button>

      {msg && <p className="mt-4 text-green-700">{msg}</p>}
      {err && <p className="mt-4 text-red-600">Fout: {err}</p>}
    </>
  );
}
