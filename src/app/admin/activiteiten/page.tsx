"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Activiteit = {
  id: string;
  titel: string;
  wanneer: string;
  doelgroep: string | null;
  aantal_vrijwilligers: number;
};

type FormState = {
  titel: string;
  wanneer: string;
  doelgroep: string;
  aantal_vrijwilligers: number;
};

export default function AdminActiviteitenPage() {
  const [activiteiten, setActiviteiten] = useState<Activiteit[]>([]);
  const [loading, setLoading] = useState(true);

  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    titel: "",
    wanneer: "",
    doelgroep: "",
    aantal_vrijwilligers: 1,
  });

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadActiviteiten = async () => {
    setLoading(true);
    setErr(null);

    const { data, error } = await supabase
      .from("activiteiten")
      .select("id,titel,wanneer,doelgroep,aantal_vrijwilligers")
      .order("wanneer", { ascending: true });

    if (error) setErr(error.message);
    setActiviteiten((data ?? []) as Activiteit[]);
    setLoading(false);
  };

  useEffect(() => {
    loadActiviteiten();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startEdit = (a: Activiteit) => {
    setMsg(null);
    setErr(null);
    setEditId(a.id);
    setForm({
      titel: a.titel,
      wanneer: a.wanneer,
      doelgroep: a.doelgroep ?? "",
      aantal_vrijwilligers: a.aantal_vrijwilligers,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditId(null);
    setForm({ titel: "", wanneer: "", doelgroep: "", aantal_vrijwilligers: 1 });
    setMsg(null);
    setErr(null);
  };

  const saveEdit = async () => {
    if (!editId) return;

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

    const { error } = await supabase
      .from("activiteiten")
      .update({
        titel: form.titel.trim(),
        wanneer: form.wanneer,
        doelgroep: form.doelgroep.trim() || null,
        aantal_vrijwilligers: form.aantal_vrijwilligers,
      })
      .eq("id", editId);

    if (error) {
      setErr(error.message);
      setBusy(false);
      return;
    }

    setMsg("Activiteit bijgewerkt.");
    await loadActiviteiten();
    cancelEdit();
    setBusy(false);
  };

  const deleteActiviteit = async (id: string) => {
    setMsg(null);
    setErr(null);

    if (!confirm("Ben je zeker dat je deze activiteit wil verwijderen?")) return;

    setBusy(true);
    const { error } = await supabase.from("activiteiten").delete().eq("id", id);

    if (error) {
      setErr(error.message);
      setBusy(false);
      return;
    }

    setMsg("Activiteit verwijderd.");
    await loadActiviteiten();

    if (editId === id) cancelEdit();
    setBusy(false);
  };

  return (
    <>
      <h2 className="text-2xl font-bold mb-4">Activiteiten beheren</h2>

      {msg && <p className="mb-4 text-green-700">{msg}</p>}
      {err && <p className="mb-4 text-red-600">Fout: {err}</p>}

      {editId && (
        <div className="border rounded-xl p-4 mb-6">
          <div className="font-semibold mb-3">Bewerken</div>

          <label className="block font-medium mb-2">Titel</label>
          <input
            className="w-full border rounded-xl p-3 mb-4"
            value={form.titel}
            onChange={(e) => setForm((f) => ({ ...f, titel: e.target.value }))}
          />

          <label className="block font-medium mb-2">Wanneer</label>
          <input
            className="w-full border rounded-xl p-3 mb-4"
            type="date"
            value={form.wanneer}
            onChange={(e) => setForm((f) => ({ ...f, wanneer: e.target.value }))}
          />

          <label className="block font-medium mb-2">Doelgroep</label>
          <input
            className="w-full border rounded-xl p-3 mb-4"
            value={form.doelgroep}
            onChange={(e) => setForm((f) => ({ ...f, doelgroep: e.target.value }))}
          />

          <label className="block font-medium mb-2">Aantal vrijwilligers nodig</label>
          <input
            className="w-full border rounded-xl p-3 mb-4"
            type="number"
            min={0}
            value={form.aantal_vrijwilligers}
            onChange={(e) =>
              setForm((f) => ({ ...f, aantal_vrijwilligers: Number(e.target.value) }))
            }
          />

          <div className="flex gap-2">
            <button
              className="border rounded-xl px-4 py-2 font-medium"
              onClick={saveEdit}
              disabled={busy}
            >
              {busy ? "Bezig…" : "Opslaan"}
            </button>

            <button
              className="border rounded-xl px-4 py-2 font-medium"
              onClick={cancelEdit}
              disabled={busy}
            >
              Annuleren
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p>Laden…</p>
      ) : activiteiten.length === 0 ? (
        <p className="text-gray-600">Nog geen activiteiten.</p>
      ) : (
        <ul className="space-y-3">
          {activiteiten.map((a) => (
            <li key={a.id} className="border rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium">{a.titel}</div>
                  <div className="text-sm text-gray-600">
                    {a.wanneer}
                    {a.doelgroep ? ` • ${a.doelgroep}` : ""}
                    {` • nodig: ${a.aantal_vrijwilligers}`}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    className="border rounded-xl px-3 py-1 text-sm"
                    onClick={() => startEdit(a)}
                    disabled={busy}
                  >
                    Bewerken
                  </button>
                  <button
                    className="border rounded-xl px-3 py-1 text-sm"
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
    </>
  );
}
