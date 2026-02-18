"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin } from "@/lib/auth";

type Activiteit = {
  id: string;
  titel: string;
  toelichting: string | null;
  wanneer: string; // date
  aantal_vrijwilligers: number | null;
  doelgroep: string | null;
};

const DOELGROEPEN = ["DG1", "DG2", "DG3", "DG4", "DG5", "DG6", "DG7", "DG8"] as const;

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

export default function AdminActiviteitenPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const [items, setItems] = useState<Activiteit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);

  // edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitel, setEditTitel] = useState("");
  const [editToelichting, setEditToelichting] = useState("");
  const [editWanneer, setEditWanneer] = useState("");
  const [editAantal, setEditAantal] = useState<number>(1);
  const [editDoelgroep, setEditDoelgroep] = useState<string>("DG1");

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
      .select("id,titel,toelichting,wanneer,aantal_vrijwilligers,doelgroep")
      .gte("wanneer", vanaf)
      .order("wanneer", { ascending: true });

    if (e1) {
      setError(e1.message);
      setLoading(false);
      return;
    }

    setItems((acts ?? []) as Activiteit[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startEdit = (a: Activiteit) => {
    setMsg(null);
    setError(null);

    setEditingId(a.id);
    setEditTitel(a.titel ?? "");
    setEditToelichting(a.toelichting ?? "");
    setEditWanneer(a.wanneer ?? "");
    setEditAantal(a.aantal_vrijwilligers ?? 1);
    setEditDoelgroep(a.doelgroep ?? "DG1");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitel("");
    setEditToelichting("");
    setEditWanneer("");
    setEditAantal(1);
    setEditDoelgroep("DG1");
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

    const payload: any = {
      titel: editTitel.trim(),
      toelichting: editToelichting ? editToelichting : null,
      wanneer: editWanneer,
      aantal_vrijwilligers: Number.isFinite(editAantal) ? editAantal : null,
      doelgroep: editDoelgroep || null,
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

  if (loading) return <main className="mx-auto max-w-3xl p-6 md:p-10">Laden…</main>;

  if (!allowed) {
    return (
      <main className="mx-auto max-w-3xl p-6 md:p-10">
        <h1 className="text-3xl font-semibold tracking-tight mb-2">Activiteiten beheren</h1>
        <p>Je hebt geen rechten om deze pagina te bekijken.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-6 md:p-10">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight mb-1">Activiteiten beheren</h1>
          <p className="text-gray-600">Wijzigen of verwijderen van toekomstige activiteiten.</p>
        </div>

        <div className="flex gap-2">
          <a className="border rounded-xl px-3 py-2 text-sm" href="/admin/toevoegen">
            + Toevoegen
          </a>
          <button className="border rounded-xl px-3 py-2 text-sm" onClick={load} disabled={busy}>
            Refresh
          </button>
        </div>
      </div>

      {error && <p className="text-red-600 mb-4">Fout: {error}</p>}
      {msg && <p className="text-green-700 mb-4">{msg}</p>}

      {items.length === 0 ? (
        <p className="text-gray-600">Geen toekomstige activiteiten.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((a) => {
            const isEditing = editingId === a.id;

            return (
              <li key={a.id} className="border rounded-2xl p-4 bg-white/80 shadow-sm">
                {!isEditing ? (
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-medium whitespace-pre-line break-words">{a.titel}</div>

                      {a.toelichting && (
                        <div className="text-sm text-gray-700 mt-2 whitespace-pre-line break-words">
                          {a.toelichting}
                        </div>
                      )}

                      <div className="text-sm text-gray-600 mt-2">
                        {a.wanneer}
                        {a.aantal_vrijwilligers != null ? ` • nodig: ${a.aantal_vrijwilligers}` : ""}
                        {a.doelgroep ? ` • doelgroep: ${a.doelgroep}` : ""}
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
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium block mb-1">Titel</label>
                      <input
                        className="w-full border rounded-xl p-3"
                        value={editTitel}
                        onChange={(e) => setEditTitel(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium block mb-1">Toelichting</label>
                      <textarea
                        className="w-full border rounded-xl p-3"
                        rows={4}
                        value={editToelichting}
                        onChange={(e) => setEditToelichting(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium block mb-1">Datum</label>
                      <input
                        type="date"
                        className="w-full border rounded-xl p-3"
                        value={editWanneer}
                        onChange={(e) => setEditWanneer(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium block mb-1">Aantal vrijwilligers (nodig)</label>
                      <input
                        type="number"
                        min={0}
                        className="w-full border rounded-xl p-3"
                        value={editAantal}
                        onChange={(e) => setEditAantal(Number(e.target.value))}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium block mb-1">Doelgroep</label>
                      <select
                        className="w-full border rounded-xl p-3"
                        value={editDoelgroep}
                        onChange={(e) => setEditDoelgroep(e.target.value)}
                      >
                        {DOELGROEPEN.map((dg) => (
                          <option key={dg} value={dg}>
                            {dg}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      <button className="border rounded-xl px-4 py-2" onClick={saveEdit} disabled={busy}>
                        {busy ? "Bezig…" : "Opslaan"}
                      </button>
                      <button className="border rounded-xl px-4 py-2" onClick={cancelEdit} disabled={busy}>
                        Annuleren
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
