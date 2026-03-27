"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin } from "@/lib/auth";

type KlantMini = { id: string; naam: string };

function hhmm(t: string | null): string {
  if (!t) return "";
  return t.length >= 5 ? t.slice(0, 5) : t;
}

export default function BewerkActiviteitPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const [klanten, setKlanten] = useState<KlantMini[]>([]);
  const [reeksId, setReeksId] = useState<string | null>(null);

  const [titel, setTitel] = useState("");
  const [toelichting, setToelichting] = useState("");
  const [wanneer, setWanneer] = useState("");
  const [startuur, setStartuur] = useState("");
  const [einduur, setEinduur] = useState("");
  const [aantal, setAantal] = useState<number>(1);
  const [klantId, setKlantId] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [reeksModal, setReeksModal] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.user) { window.location.href = "/login"; return; }

      const ok = await isDoenkerOrAdmin();
      setAllowed(ok);
      if (!ok) { setLoading(false); return; }

      const [{ data: kData }, { data: act, error: actErr }] = await Promise.all([
        supabase
          .from("klanten")
          .select("id,naam")
          .eq("actief", true)
          .is("gearchiveerd_op", null)
          .order("naam", { ascending: true }),
        supabase
          .from("activiteiten")
          .select("id,titel,toelichting,wanneer,startuur,einduur,aantal_vrijwilligers,klant_id,herhaling_reeks_id")
          .eq("id", id)
          .maybeSingle(),
      ]);

      setKlanten((kData ?? []) as KlantMini[]);

      if (actErr || !act) { setNotFound(true); setLoading(false); return; }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const a = act as any;
      setTitel(a.titel ?? "");
      setToelichting(a.toelichting ?? "");
      setWanneer(a.wanneer ?? "");
      setStartuur(hhmm(a.startuur));
      setEinduur(hhmm(a.einduur));
      setAantal(a.aantal_vrijwilligers ?? 1);
      setKlantId(a.klant_id ?? "");
      setReeksId(a.herhaling_reeks_id ?? null);

      setLoading(false);
    };
    init();
  }, [id]);

  const executeEdit = async (scope: "enkel" | "reeks") => {
    if (!id) return;
    setBusy(true);
    setReeksModal(false);
    setError(null);

    const contentPayload = {
      titel: titel.trim(),
      toelichting: toelichting.trim() || null,
      startuur,
      einduur,
      aantal_vrijwilligers: Number.isFinite(aantal) ? aantal : null,
      klant_id: klantId || null,
    };

    let dbError = null;

    if (scope === "enkel" || !reeksId) {
      const { error } = await supabase
        .from("activiteiten")
        .update({ ...contentPayload, wanneer })
        .eq("id", id);
      dbError = error;
    } else {
      const { error } = await supabase
        .from("activiteiten")
        .update(contentPayload)
        .eq("herhaling_reeks_id", reeksId);
      dbError = error;
    }

    if (dbError) { setError(dbError.message); setBusy(false); return; }

    router.push("/admin/activiteiten");
  };

  const save = async () => {
    setError(null);
    if (!titel.trim()) return setError("Titel is verplicht.");
    if (!wanneer) return setError("Datum is verplicht.");
    if (!klantId) return setError("Klant is verplicht.");
    if (!startuur) return setError("Startuur is verplicht.");
    if (!einduur) return setError("Einduur is verplicht.");
    if (einduur <= startuur) return setError("Einduur moet later zijn dan startuur.");

    if (reeksId) {
      setReeksModal(true);
      return;
    }

    await executeEdit("enkel");
  };

  if (loading) return <main className="p-10">Laden…</main>;
  if (!allowed) return <main className="p-10">Geen rechten.</main>;
  if (notFound) return <main className="p-10">Activiteit niet gevonden.</main>;

  return (
    <>
      {reeksModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full space-y-4">
            <h2 className="font-semibold text-lg">Herhalende activiteit aanpassen</h2>
            <p className="text-sm text-gray-700">
              Wil je deze wijziging toepassen op enkel deze activiteit, of op alle activiteiten in deze reeks?
            </p>
            <div className="flex flex-col gap-2">
              <button
                className="border rounded-xl px-4 py-3 text-sm bg-white hover:bg-gray-50 transition text-left"
                onClick={() => executeEdit("enkel")}
                disabled={busy}
              >
                <span className="font-medium">Enkel deze</span>
                <span className="block text-xs text-gray-500 mt-0.5">Alleen deze activiteit wordt aangepast.</span>
              </button>
              <button
                className="border rounded-xl px-4 py-3 text-sm bg-white hover:bg-gray-50 transition text-left"
                onClick={() => executeEdit("reeks")}
                disabled={busy}
              >
                <span className="font-medium">Hele reeks</span>
                <span className="block text-xs text-gray-500 mt-0.5">Alle activiteiten in deze reeks worden aangepast.</span>
              </button>
              <button
                className="border rounded-xl px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 transition"
                onClick={() => setReeksModal(false)}
                disabled={busy}
              >
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-2xl p-4 sm:p-6 md:p-10">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h1 className="text-2xl font-semibold">Activiteit bewerken</h1>
          <button
            className="wa-btn wa-btn-ghost px-3 py-2 text-sm"
            onClick={() => router.push("/admin/activiteiten")}
          >
            Annuleren
          </button>
        </div>

        {reeksId && (
          <div className="wa-alert-info mb-4 text-sm">
            Dit is een herhalende activiteit. Bij opslaan wordt gevraagd of je enkel deze activiteit of de hele reeks wil aanpassen.
          </div>
        )}

        {error && <div className="wa-alert-error mb-4">{error}</div>}

        <div className="wa-card p-5 space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1">Titel</label>
            <input
              className="w-full border rounded-xl p-3 bg-white"
              value={titel}
              onChange={(e) => setTitel(e.target.value)}
              disabled={busy}
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">Toelichting</label>
            <textarea
              className="w-full border rounded-xl p-3 bg-white"
              rows={4}
              value={toelichting}
              onChange={(e) => setToelichting(e.target.value)}
              disabled={busy}
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">
              Datum{reeksId ? " (enkel voor deze activiteit bij 'Enkel deze')" : ""}
            </label>
            <input
              type="date"
              className="w-full border rounded-xl p-3 bg-white"
              value={wanneer}
              onChange={(e) => setWanneer(e.target.value)}
              disabled={busy}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1">Startuur</label>
              <input
                type="time"
                className="w-full border rounded-xl p-3 bg-white"
                value={startuur}
                onChange={(e) => setStartuur(e.target.value)}
                disabled={busy}
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Einduur</label>
              <input
                type="time"
                className="w-full border rounded-xl p-3 bg-white"
                value={einduur}
                onChange={(e) => setEinduur(e.target.value)}
                disabled={busy}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">Aantal vrijwilligers (nodig)</label>
            <input
              type="number"
              min={0}
              className="w-full border rounded-xl p-3 bg-white"
              value={aantal}
              onChange={(e) => setAantal(Number(e.target.value))}
              disabled={busy}
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">Klant (verplicht)</label>
            <select
              className="w-full border rounded-xl p-3 bg-white"
              value={klantId}
              onChange={(e) => setKlantId(e.target.value)}
              disabled={busy}
            >
              <option value="">— Kies een klant —</option>
              {klanten.map((k) => (
                <option key={k.id} value={k.id}>{k.naam}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              className="wa-btn wa-btn-brand flex-1 px-4 py-2 text-sm"
              onClick={save}
              disabled={busy}
            >
              {busy ? "Bezig…" : "Opslaan"}
            </button>
            <button
              className="wa-btn wa-btn-ghost flex-1 px-4 py-2 text-sm"
              onClick={() => router.push("/admin/activiteiten")}
              disabled={busy}
            >
              Annuleren
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
