"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin } from "@/lib/auth";
import RijkeTekstEditor from "@/components/RijkeTekstEditor";

type Werkgroep = {
  id: string;
  titel: string;
  opdracht: string | null;
  trekker: string | null;
  meer_info_url: string | null;
};

export default function WerkgroepenBeheerPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [werkgroepen, setWerkgroepen] = useState<Werkgroep[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // form state (alleen voor nieuw)
  const [formOpen, setFormOpen] = useState(false);
  const [titel, setTitel] = useState("");
  const [opdracht, setOpdracht] = useState("");
  const [trekker, setTrekker] = useState("");
  const [meerInfoUrl, setMeerInfoUrl] = useState("");
  const [uitgebreideInfo, setUitgebreideInfo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const ok = await isDoenkerOrAdmin();
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
        .select("id, titel, opdracht, trekker, meer_info_url")
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
    setTitel("");
    setOpdracht("");
    setTrekker("");
    setMeerInfoUrl("");
    setUitgebreideInfo("");
    setErr(null);
    setMsg(null);
    setFormOpen(true);
  }

  async function saveNew() {
    if (!titel.trim()) { setErr("Titel is verplicht."); return; }
    setBusy(true);
    setErr(null);
    try {
      const { error } = await supabase
        .from("werkgroepen")
        .insert({
            titel: titel.trim(),
            opdracht: opdracht.trim() || null,
            trekker: trekker.trim() || null,
            meer_info_url: meerInfoUrl.trim() || null,
            uitgebreide_info: uitgebreideInfo || null,
          });
      if (error) throw error;
      setMsg("Werkgroep aangemaakt.");
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
        <div className="wa-alert-error">Geen toegang.</div>
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
          <div className="font-semibold">Nieuwe werkgroep</div>

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
            <label className="block font-medium mb-1">Trekker</label>
            <input
              className="w-full border rounded-xl p-3 bg-white"
              value={trekker}
              onChange={(e) => setTrekker(e.target.value)}
              placeholder="Naam van de trekker (optioneel)"
            />
          </div>

          <div>
            <label className="block font-medium mb-1">Toelichting</label>
            <textarea
              className="w-full border rounded-xl p-3 bg-white min-h-[80px]"
              value={opdracht}
              onChange={(e) => setOpdracht(e.target.value)}
              placeholder="Korte omschrijving van de werkgroep…"
            />
          </div>

          <div>
            <label className="block font-medium mb-1">Uitgebreide informatie</label>
            <RijkeTekstEditor value={uitgebreideInfo} onChange={setUitgebreideInfo} />
          </div>

          <div>
            <label className="block font-medium mb-1">Link voor meer info (optioneel)</label>
            <input
              className="w-full border rounded-xl p-3 bg-white"
              value={meerInfoUrl}
              onChange={(e) => setMeerInfoUrl(e.target.value)}
              placeholder="https://…"
              type="url"
            />
            <p className="text-xs text-gray-500 mt-1">Plak hier de link naar een Google Doc of andere pagina</p>
          </div>

          <div className="flex gap-2">
            <button
              className="wa-btn wa-btn-brand px-4 py-2 font-medium"
              onClick={saveNew}
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
            <div key={w.id} className="wa-card p-4 space-y-3">
              <div>
                <div className="font-semibold">{w.titel}</div>
                {w.opdracht && (
                  <div className="text-sm text-gray-600 mt-1">{w.opdracht}</div>
                )}
              </div>
              <div className="flex gap-2">
                <a
                  href={`/admin/werkgroepen/beheer/${w.id}`}
                  className="border rounded-xl px-3 py-1.5 text-sm bg-white hover:shadow-sm transition"
                >
                  Bewerken
                </a>
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
