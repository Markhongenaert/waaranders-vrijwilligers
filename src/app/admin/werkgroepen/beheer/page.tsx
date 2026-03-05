"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { isAdmin } from "@/lib/auth";

type Werkgroep = {
  id: string;
  titel: string;
  opdracht: string | null;
};

export default function WerkgroepenBeheerPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [werkgroepen, setWerkgroepen] = useState<Werkgroep[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // form state
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Werkgroep | null>(null);
  const [titel, setTitel] = useState("");
  const [opdracht, setOpdracht] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const ok = await isAdmin();
      if (!mounted) return;
      setAllowed(ok);
    })();
    return () => { mounted = false; };
  }, []);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const { data, error } = await supabase
        .from("werkgroepen")
        .select("id, titel, opdracht")
        .order("titel", { ascending: true });
      if (error) throw error;
      setWerkgroepen((data ?? []) as Werkgroep[]);
    } catch (e: any) {
      setErr(e?.message ?? "Fout bij laden.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (allowed !== true) return;
    load();
  }, [allowed]);

  function openNew() {
    setEditing(null);
    setTitel("");
    setOpdracht("");
    setErr(null);
    setMsg(null);
    setFormOpen(true);
  }

  function openEdit(w: Werkgroep) {
    setEditing(w);
    setTitel(w.titel);
    setOpdracht(w.opdracht ?? "");
    setErr(null);
    setMsg(null);
    setFormOpen(true);
  }

  async function saveForm() {
    if (!titel.trim()) { setErr("Titel is verplicht."); return; }
    setBusy(true);
    setErr(null);
    try {
      if (editing) {
        const { error } = await supabase
          .from("werkgroepen")
          .update({ titel: titel.trim(), opdracht: opdracht.trim() || null })
          .eq("id", editing.id);
        if (error) throw error;
        setMsg("Werkgroep bijgewerkt.");
      } else {
        const { error } = await supabase
          .from("werkgroepen")
          .insert({ titel: titel.trim(), opdracht: opdracht.trim() || null });
        if (error) throw error;
        setMsg("Werkgroep aangemaakt.");
      }
      setFormOpen(false);
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Fout bij opslaan.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteWerkgroep(w: Werkgroep) {
    if (!confirm(`Werkgroep "${w.titel}" verwijderen? Dit verwijdert ook alle deelnemers.`)) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const { error: dErr } = await supabase
        .from("werkgroep_deelnemers")
        .delete()
        .eq("werkgroep_id", w.id);
      if (dErr) throw dErr;

      const { error } = await supabase
        .from("werkgroepen")
        .delete()
        .eq("id", w.id);
      if (error) throw error;

      setMsg("Werkgroep verwijderd.");
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Fout bij verwijderen.");
    } finally {
      setBusy(false);
    }
  }

  if (allowed === null) return <main className="p-6">Laden…</main>;
  if (allowed === false) {
    return (
      <main className="p-6">
        <div className="wa-alert-error">Geen toegang. Alleen admins kunnen werkgroepen beheren.</div>
      </main>
    );
  }

  return (
    <main className="p-5 sm:p-6 space-y-4 max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Werkgroepen beheren</h1>
        <div className="flex gap-2">
          <button
            className="wa-btn wa-btn-brand px-4 py-2 text-sm"
            onClick={openNew}
            disabled={busy}
          >
            + Nieuw
          </button>
          <a href="/admin/werkgroepen" className="border rounded-xl px-4 py-2 text-sm">
            Terug
          </a>
        </div>
      </div>

      {err && <div className="wa-alert-error">{err}</div>}
      {msg && <div className="wa-alert-success">{msg}</div>}

      {formOpen && (
        <div className="wa-card p-5 space-y-3">
          <div className="font-semibold">{editing ? "Bewerken" : "Nieuwe werkgroep"}</div>

          <div>
            <label className="block font-medium mb-1">
              Titel <span className="text-red-600">*</span>
            </label>
            <input
              className="w-full border rounded-xl p-3 bg-white"
              value={titel}
              onChange={(e) => setTitel(e.target.value)}
              placeholder="bv. Communicatie"
              autoFocus
            />
          </div>

          <div>
            <label className="block font-medium mb-1">Opdracht</label>
            <textarea
              className="w-full border rounded-xl p-3 bg-white min-h-[80px]"
              value={opdracht}
              onChange={(e) => setOpdracht(e.target.value)}
              placeholder="Korte omschrijving van de werkgroep…"
            />
          </div>

          <div className="flex gap-2">
            <button
              className="wa-btn wa-btn-brand px-4 py-2 font-medium"
              onClick={saveForm}
              disabled={busy}
            >
              {busy ? "Bezig…" : "Opslaan"}
            </button>
            <button
              className="wa-btn wa-btn-ghost px-4 py-2"
              onClick={() => setFormOpen(false)}
              disabled={busy}
            >
              Annuleren
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-gray-600">Laden…</div>
      ) : (
        <div className="space-y-2">
          {werkgroepen.map((w) => (
            <div key={w.id} className="wa-card p-4 flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{w.titel}</div>
                {w.opdracht && (
                  <div className="text-sm text-gray-600 mt-0.5">{w.opdracht}</div>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  className="border rounded-xl px-3 py-1.5 text-sm bg-white hover:shadow-sm transition"
                  onClick={() => openEdit(w)}
                  disabled={busy}
                >
                  Bewerken
                </button>
                <button
                  className="border border-red-200 rounded-xl px-3 py-1.5 text-sm text-red-700 bg-white hover:shadow-sm transition"
                  onClick={() => deleteWerkgroep(w)}
                  disabled={busy}
                >
                  Verwijderen
                </button>
              </div>
            </div>
          ))}
          {werkgroepen.length === 0 && (
            <p className="text-gray-600">Geen werkgroepen gevonden.</p>
          )}
        </div>
      )}
    </main>
  );
}
