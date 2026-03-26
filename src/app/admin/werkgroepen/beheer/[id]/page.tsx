"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin } from "@/lib/auth";
import RijkeTekstEditor from "@/components/RijkeTekstEditor";

export default function WerkgroepBewerkPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [titel, setTitel] = useState("");
  const [opdracht, setOpdracht] = useState("");
  const [trekker, setTrekker] = useState("");
  const [meerInfoUrl, setMeerInfoUrl] = useState("");
  const [uitgebreideInfo, setUitgebreideInfo] = useState("");
  const [savedSuccessfully, setSavedSuccessfully] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const ok = await isDoenkerOrAdmin();
      if (!mounted) return;
      setAllowed(ok);
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (allowed !== true || !id) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const { data, error } = await supabase
          .from("werkgroepen")
          .select("id, titel, opdracht, trekker, meer_info_url, uitgebreide_info")
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("Werkgroep niet gevonden.");
        if (!mounted) return;
        setTitel(data.titel ?? "");
        setOpdracht(data.opdracht ?? "");
        setTrekker((data as any).trekker ?? "");
        setMeerInfoUrl((data as any).meer_info_url ?? "");
        setUitgebreideInfo((data as any).uitgebreide_info ?? "");
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message ?? "Fout bij laden.");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [allowed, id]);

  useEffect(() => {
    setSavedSuccessfully(false);
  }, [uitgebreideInfo]);

  async function save() {
    if (!titel.trim()) { setErr("Titel is verplicht."); return; }
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const { error } = await supabase
        .from("werkgroepen")
        .update({
          titel: titel.trim(),
          opdracht: opdracht.trim() || null,
          trekker: trekker.trim() || null,
          meer_info_url: meerInfoUrl.trim() || null,
          uitgebreide_info: uitgebreideInfo || null,
        })
        .eq("id", id);
      if (error) throw error;
      setMsg("Opgeslagen.");
      setSavedSuccessfully(true);
      setBusy(false);
    } catch (e: any) {
      setErr(e?.message ?? "Fout bij opslaan.");
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
    <main className="p-5 sm:p-6 max-w-2xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Werkgroep bewerken</h1>
        <a href="/admin/werkgroepen/beheer" className="border rounded-xl px-4 py-2 text-sm">
          Terug
        </a>
      </div>

      {err && <div className="wa-alert-error">{err}</div>}
      {msg && <div className="wa-alert-success">{msg}</div>}

      {loading ? (
        <div className="text-gray-600">Laden…</div>
      ) : (
        <div className="wa-card p-5 space-y-4">
          <div>
            <label className="block font-medium mb-1">
              Titel <span className="text-red-600">*</span>
            </label>
            <input
              className="w-full border rounded-xl p-3 bg-white"
              value={titel}
              onChange={(e) => setTitel(e.target.value)}
              placeholder="bv. Communicatie"
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
              className="w-full border rounded-xl p-3 bg-white min-h-[200px]"
              value={opdracht}
              onChange={(e) => setOpdracht(e.target.value)}
              placeholder="Omschrijving van de werkgroep…"
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

          <div className="flex gap-2 pt-1">
            <button
              className="wa-btn wa-btn-brand px-5 py-2.5 font-medium"
              onClick={save}
              disabled={busy}
            >
              {busy ? "Bezig…" : "Opslaan"}
            </button>
            <a
              href="/admin/werkgroepen/beheer"
              className="wa-btn wa-btn-ghost px-5 py-2.5"
            >
              Annuleren
            </a>
          </div>

          {savedSuccessfully && uitgebreideInfo && (
            <a
              href={`/activiteiten/werkgroepen/${id}?terug=/admin/werkgroepen/beheer/${id}`}
              className="inline-block text-sm text-sky-700 hover:underline mt-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              Voorbeeld bekijken →
            </a>
          )}
        </div>
      )}
    </main>
  );
}
