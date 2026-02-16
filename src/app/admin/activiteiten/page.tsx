"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Activiteit = {
  id: string;
  titel: string;
  wanneer: string;
  doelgroep: string | null;
  aantal_vrijwilligers: number | null;
};

type MeedoenRow = {
  activiteit_id: string;
  vrijwilliger_id: string;
  vrijwilligers: any;
};

function volunteerNaamFromRow(r: any): string | null {
  const v = r?.vrijwilligers;
  if (Array.isArray(v)) return v[0]?.naam ?? null;
  if (v && typeof v === "object") return v.naam ?? null;
  return null;
}

export default function AdminActiviteitenPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [activiteiten, setActiviteiten] = useState<Activiteit[]>([]);
  const [meedoen, setMeedoen] = useState<MeedoenRow[]>([]);

  // edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [titel, setTitel] = useState("");
  const [wanneer, setWanneer] = useState("");
  const [doelgroep, setDoelgroep] = useState("");
  const [aantalVrijwilligers, setAantalVrijwilligers] = useState<string>("");

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    setMsg(null);

    const { data: acts, error: e1 } = await supabase
      .from("activiteiten")
      .select("id,titel,wanneer,doelgroep,aantal_vrijwilligers")
      .order("wanneer", { ascending: true });

    if (e1) {
      setError(e1.message);
      setLoading(false);
      return;
    }

    const list = (acts ?? []) as Activiteit[];
    setActiviteiten(list);

    const ids = list.map((a) => a.id);
    if (ids.length === 0) {
      setMeedoen([]);
      setLoading(false);
      return;
    }

    const { data: md, error: e2 } = await supabase
      .from("meedoen")
      .select("activiteit_id,vrijwilliger_id,vrijwilligers(naam)")
      .in("activiteit_id", ids);

    if (e2) {
      setError(e2.message);
      setLoading(false);
      return;
    }

    setMeedoen((md ?? []) as unknown as MeedoenRow[]);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startEdit = (a: Activiteit) => {
    setMsg(null);
    setError(null);
    setEditId(a.id);
    setTitel(a.titel ?? "");
    setWanneer(a.wanneer ?? "");
    setDoelgroep(a.doelgroep ?? "");
    setAantalVrijwilligers(a.aantal_vrijwilligers != null ? String(a.aantal_vrijwilligers) : "");
  };

  const cancelEdit = () => {
    setEditId(null);
    setTitel("");
    setWanneer("");
    setDoelgroep("");
    setAantalVrijwilligers("");
  };

  const saveEdit = async () => {
    if (!editId) return;
    setBusy(true);
    setError(null);
    setMsg(null);

    const payload: any = {
      titel: titel.trim(),
      wanneer,
      doelgroep: doelgroep.trim() || null,
      aantal_vrijwilligers:
        aantalVrijwilligers.trim() === "" ? null : Number(aantalVrijwilligers.trim()),
    };

    if (!payload.titel) {
      setError("Titel is verplicht.");
      setBusy(false);
      return;
    }
    if (!payload.wanneer) {
      setError("Datum (wanneer) is verplicht.");
      setBusy(false);
      return;
    }
    if (payload.aantal_vrijwilligers !== null && Number.isNaN(payload.aantal_vrijwilligers)) {
      setError("Aantal vrijwilligers moet een getal zijn (of leeg).");
      setBusy(false);
      return;
    }

    const { error } = await supabase.from("activiteiten").update(payload).eq("id", editId);

    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }

    setMsg("Activiteit aangepast.");
    setBusy(false);
    cancelEdit();
    await loadAll();
  };

  const deleteActiviteit = async (id: string) => {
    if (!confirm("Zeker dat je deze activiteit wil verwijderen?")) return;
    setBusy(true);
    setError(null);
    setMsg(null);

    // Eerst meedoen records verwijderen (anders FK error)
    const { error: e1 } = await supabase.from("meedoen").delete().eq("activiteit_id", id);
    if (e1) {
      setError(e1.message);
      setBusy(false);
      return;
    }

    const { error: e2 } = await supabase.from("activiteiten").delete().eq("id", id);
    if (e2) {
      setError(e2.message);
      setBusy(false);
      return;
    }

    setMsg("Activiteit verwijderd.");
    setBusy(false);
    await loadAll();
  };

  return (
    <main className="p-8 max-w-3xl">
      <h1 className="text-3xl font-bold mb-4">Beheren</h1>
      <p className="text-gray-600 mb-6">Bewerk of verwijder activiteiten. (Toevoegen gebeurt via “Toevoegen”.)</p>

      {error && <p className="text-red-600 mb-4">Fout: {error}</p>}
      {msg && <p className="text-green-700 mb-4">{msg}</p>}

      {editId && (
        <div className="border rounded-xl p-4 mb-6">
          <div className="font-medium mb-3">Activiteit bewerken</div>

          <label className="block text-sm font-medium mb-1">Titel</label>
          <input
            className="w-full border rounded-xl p-3 mb-3"
            value={titel}
            onChange={(e) => setTitel(e.target.value)}
          />

          <label className="block text-sm font-medium mb-1">Wanneer (datum)</label>
          <input
            className="w-full border rounded-xl p-3 mb-3"
            type="date"
            value={wanneer}
            onChange={(e) => setWanneer(e.target.value)}
          />

          <label className="block text-sm font-medium mb-1">Doelgroep</label>
          <input
            className="w-full border rounded-xl p-3 mb-3"
            value={doelgroep}
            onChange={(e) => setDoelgroep(e.target.value)}
            placeholder="(optioneel)"
          />

          <label className="block text-sm font-medium mb-1">Aantal nodige vrijwilligers</label>
          <input
            className="w-full border rounded-xl p-3 mb-4"
            value={aantalVrijwilligers}
            onChange={(e) => setAantalVrijwilligers(e.target.value)}
            placeholder="(optioneel)"
          />

          <div className="flex gap-2">
            <button className="border rounded-xl px-4 py-2" onClick={saveEdit} disabled={busy}>
              {busy ? "Bezig…" : "Opslaan"}
            </button>
            <button className="border rounded-xl px-4 py-2" onClick={cancelEdit} disabled={busy}>
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
          {activiteiten.map((a) => {
            const rows = meedoen.filter((r) => r.activiteit_id === a.id);
            const namen = rows.map((r) => volunteerNaamFromRow(r) ?? "(naam onbekend)");
            const namenTekst = namen.join(", ");

            return (
              <li key={a.id} className="border rounded-xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium">{a.titel}</div>
                    <div className="text-sm text-gray-600">
                      {a.wanneer}
                      {a.doelgroep ? ` • ${a.doelgroep}` : ""}
                      {a.aantal_vrijwilligers != null ? ` • nodig: ${a.aantal_vrijwilligers}` : ""}
                    </div>

                    <div className="text-sm text-gray-600 mt-2">
                      Ingeschreven: {rows.length}
                      {rows.length > 0 ? ` • ${namenTekst}` : ""}
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
            );
          })}
        </ul>
      )}
    </main>
  );
}
