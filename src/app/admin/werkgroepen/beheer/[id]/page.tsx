"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin } from "@/lib/auth";
import RijkeTekstEditor from "@/components/RijkeTekstEditor";

type WerkgroepData = {
  titel: string;
  opdracht: string | null;
  coordinator_id: string | null;
  uitgebreide_info: string | null;
};

type Coordinator = {
  id: string;
  naam: string;
};

export default function WerkgroepBewerkPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [titel, setTitel] = useState("");
  const [opdracht, setOpdracht] = useState("");
  const [coordinatorId, setCoordinatorId] = useState("");
  const [coordinators, setCoordinators] = useState<Coordinator[]>([]);
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

  async function loadCoordinators() {
    const { data: rolEntries } = await supabase
      .from("vrijwilliger_roles")
      .select("vrijwilliger_id, roles(code)");

    const coördinatorIds = [...new Set(
      (rolEntries ?? [])
        .filter((r: any) => r.roles?.code === "doenker" || r.roles?.code === "admin")
        .map((r: any) => r.vrijwilliger_id as string)
    )];

    if (coördinatorIds.length === 0) {
      setCoordinators([]);
      return;
    }

    const { data: vvs } = await supabase
      .from("vrijwilligers")
      .select("id, voornaam, achternaam")
      .in("id", coördinatorIds)
      .eq("actief", true)
      .order("voornaam");

    setCoordinators(
      (vvs ?? []).map((v: any) => ({
        id: v.id,
        naam: `${v.voornaam ?? ""} ${v.achternaam ?? ""}`.trim(),
      }))
    );
  }

  useEffect(() => {
    if (allowed !== true || !id) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const [wgResult] = await Promise.all([
          supabase
            .from("werkgroepen")
            .select("id, titel, opdracht, coordinator_id, uitgebreide_info")
            .eq("id", id)
            .maybeSingle(),
          loadCoordinators(),
        ]);

        const { data, error } = wgResult;
        if (error) throw error;
        if (!data) throw new Error("Werkgroep niet gevonden.");
        if (!mounted) return;
        const d = data as unknown as WerkgroepData;
        setTitel(d.titel ?? "");
        setOpdracht(d.opdracht ?? "");
        setCoordinatorId(d.coordinator_id ?? "");
        setUitgebreideInfo(d.uitgebreide_info ?? "");
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

  const isFirstLoad = useRef(true);
  useEffect(() => {
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      return;
    }
    setSavedSuccessfully(false);
  }, [uitgebreideInfo]);

  async function save() {
    if (!titel.trim()) { setErr("Titel is verplicht."); return; }
    if (!coordinatorId) { setErr("Trekker is verplicht."); return; }
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const { error } = await supabase
        .from("werkgroepen")
        .update({
          titel: titel.trim(),
          opdracht: opdracht.trim() || null,
          coordinator_id: coordinatorId,
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
            <label className="block font-medium mb-1">
              Trekker <span className="text-red-600">*</span>
            </label>
            <select
              className="w-full border rounded-xl p-3 bg-white"
              value={coordinatorId}
              onChange={(e) => setCoordinatorId(e.target.value)}
            >
              <option value="">— Kies een trekker —</option>
              {coordinators.map((c) => (
                <option key={c.id} value={c.id}>{c.naam}</option>
              ))}
            </select>
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
