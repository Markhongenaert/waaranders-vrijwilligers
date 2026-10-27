"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin } from "@/lib/auth";
import { setActiviteitenScrollTarget } from "@/lib/scrollTarget";
import HerhalingVelden from "@/components/HerhalingVelden";
import {
  datumsVoorWaarden,
  herhalingKolommen,
  herhalingRegelGelijk,
  standaardHerhalingWaarden,
  valideerHerhaling,
  type HerhalingWaarden,
} from "@/lib/herhaling";

type KlantMini = { id: string; naam: string };

type ActiviteitRij = {
  titel: string | null;
  toelichting: string | null;
  wanneer: string | null;
  startuur: string | null;
  einduur: string | null;
  aantal_vrijwilligers: number | null;
  aantal_deelnemers: number | null;
  aantal_externe_begeleiders: number | null;
  klant_id: string | null;
  herhaling_reeks_id: string | null;
  herhaling_type: "wekelijks" | "maandelijks" | null;
  herhaling_interval: number | null;
  herhaling_einde_datum: string | null;
  herhaling_einde_aantal: number | null;
};

function hhmm(t: string | null): string {
  if (!t) return "";
  return t.length >= 5 ? t.slice(0, 5) : t;
}

function todayISODate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDDMM(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function waardenVanRij(a: ActiviteitRij): HerhalingWaarden {
  if (!a.herhaling_type) return standaardHerhalingWaarden();
  return {
    herhaling: true,
    type: a.herhaling_type,
    interval: String(a.herhaling_interval ?? 1),
    stopType: a.herhaling_einde_datum ? "datum" : "aantal",
    stopAantal: String(a.herhaling_einde_aantal ?? 4),
    stopDatum: a.herhaling_einde_datum ?? "",
  };
}

type HerhalingBevestiging = {
  titel: string;
  berichten: string[];
  bevestigLabel: string;
  gevaarlijk: boolean;
  actie: () => Promise<void>;
};

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
  const [origWanneer, setOrigWanneer] = useState("");
  const [startuur, setStartuur] = useState("");
  const [einduur, setEinduur] = useState("");
  const [aantal, setAantal] = useState<number>(1);
  const [aantalDeelnemers, setAantalDeelnemers] = useState<number>(0);
  const [aantalExterneBegeleiders, setAantalExterneBegeleiders] = useState<number>(0);
  const [klantId, setKlantId] = useState("");

  const [herhalingWaarden, setHerhalingWaarden] = useState<HerhalingWaarden>(standaardHerhalingWaarden());
  const [origHerhalingWaarden, setOrigHerhalingWaarden] = useState<HerhalingWaarden>(standaardHerhalingWaarden());

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [reeksModal, setReeksModal] = useState(false);
  const [herhalingBevestiging, setHerhalingBevestiging] = useState<HerhalingBevestiging | null>(null);

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
          .select(
            "id,titel,toelichting,wanneer,startuur,einduur,aantal_vrijwilligers,aantal_deelnemers,aantal_externe_begeleiders,klant_id,herhaling_reeks_id,herhaling_type,herhaling_interval,herhaling_einde_datum,herhaling_einde_aantal"
          )
          .eq("id", id)
          .maybeSingle(),
      ]);

      setKlanten((kData ?? []) as KlantMini[]);

      if (actErr || !act) { setNotFound(true); setLoading(false); return; }

      const a = act as unknown as ActiviteitRij;
      setTitel(a.titel ?? "");
      setToelichting(a.toelichting ?? "");
      setWanneer(a.wanneer ?? "");
      setOrigWanneer(a.wanneer ?? "");
      setStartuur(hhmm(a.startuur));
      setEinduur(hhmm(a.einduur));
      setAantal(a.aantal_vrijwilligers ?? 1);
      setAantalDeelnemers(a.aantal_deelnemers ?? 0);
      setAantalExterneBegeleiders(a.aantal_externe_begeleiders ?? 0);
      setKlantId(a.klant_id ?? "");
      setReeksId(a.herhaling_reeks_id ?? null);

      const waarden = waardenVanRij(a);
      setHerhalingWaarden(waarden);
      setOrigHerhalingWaarden(waarden);

      setLoading(false);
    };
    init();
  }, [id]);

  const buildContentPayload = () => ({
    titel: titel.trim(),
    toelichting: toelichting.trim() || null,
    startuur,
    einduur,
    aantal_vrijwilligers: Number.isFinite(aantal) ? aantal : null,
    aantal_deelnemers: Number.isFinite(aantalDeelnemers) ? aantalDeelnemers : 0,
    aantal_externe_begeleiders: Number.isFinite(aantalExterneBegeleiders) ? aantalExterneBegeleiders : 0,
    klant_id: klantId || null,
  });

  const telInschrijvingen = async (ids: string[]): Promise<number> => {
    if (ids.length === 0) return 0;
    const { count } = await supabase
      .from("meedoen")
      .select("id", { count: "exact", head: true })
      .in("activiteit_id", ids);
    return count ?? 0;
  };

  const executeEdit = async (scope: "enkel" | "reeks") => {
    if (!id) return;
    setBusy(true);
    setReeksModal(false);
    setError(null);

    const contentPayload = buildContentPayload();

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

    setActiviteitenScrollTarget(id);
    router.push("/admin/activiteiten");
  };

  /** Bereidt een wijziging van de herhalingsregel voor: berekent impact, toont bevestiging/waarschuwing. */
  const voorbereidenHerhalingswijziging = async () => {
    if (!id) return;
    setBusy(true);
    setError(null);

    const vandaag = todayISODate();
    const content = buildContentPayload();

    if (!herhalingWaarden.herhaling) {
      // Herhaling uitzetten: alle volgende activiteiten in de reeks (vanaf vandaag) verwijderen.
      let toDelete: { id: string; wanneer: string }[] = [];

      if (reeksId) {
        const { data, error: e } = await supabase
          .from("activiteiten")
          .select("id,wanneer")
          .eq("herhaling_reeks_id", reeksId)
          .neq("id", id)
          .gte("wanneer", vandaag)
          .gt("wanneer", wanneer);

        if (e) { setError(e.message); setBusy(false); return; }
        toDelete = (data ?? []) as { id: string; wanneer: string }[];
      }

      const deleteIds = toDelete.map((r) => r.id);
      const aantalInschrijvingen = await telInschrijvingen(deleteIds);

      const berichten = [
        "Je zet de herhaling uit. Alle volgende activiteiten in de reeks worden verwijderd; deze activiteit blijft bestaan als losse activiteit.",
      ];
      if (deleteIds.length > 0 && aantalInschrijvingen > 0) {
        const datums = toDelete.map((r) => formatDDMM(r.wanneer)).join(", ");
        berichten.push(
          `Door deze wijziging vervallen ${deleteIds.length} activiteit${deleteIds.length !== 1 ? "en" : ""} waarop al ${aantalInschrijvingen} vrijwilliger${aantalInschrijvingen !== 1 ? "s" : ""} ingeschreven ${aantalInschrijvingen !== 1 ? "zijn" : "is"} (${datums}). Toch doorgaan?`
        );
      }

      setHerhalingBevestiging({
        titel: "Herhaling uitzetten",
        berichten,
        bevestigLabel: deleteIds.length > 0 && aantalInschrijvingen > 0 ? "Toch doorgaan" : "Bevestigen",
        gevaarlijk: deleteIds.length > 0 && aantalInschrijvingen > 0,
        actie: async () => {
          setBusy(true);
          setHerhalingBevestiging(null);

          const { error: e1 } = await supabase
            .from("activiteiten")
            .update({
              ...content,
              wanneer,
              herhaling_type: null,
              herhaling_interval: null,
              herhaling_einde_datum: null,
              herhaling_einde_aantal: null,
              herhaling_reeks_id: null,
            })
            .eq("id", id);
          if (e1) { setError(e1.message); setBusy(false); return; }

          if (deleteIds.length > 0) {
            const { error: e2 } = await supabase.from("activiteiten").delete().in("id", deleteIds);
            if (e2) { setError(e2.message); setBusy(false); return; }
          }

          setActiviteitenScrollTarget(id);
          router.push("/admin/activiteiten");
        },
      });

      setBusy(false);
      return;
    }

    // Herhaling aan (bestaande reeks herrekenen, of losse activiteit omzetten naar reeks).
    const reeksIdToUse = reeksId ?? crypto.randomUUID();

    let oldFutureRows: { id: string; wanneer: string }[] = [];
    if (reeksId) {
      const { data, error: e } = await supabase
        .from("activiteiten")
        .select("id,wanneer")
        .eq("herhaling_reeks_id", reeksId)
        .neq("id", id)
        .gte("wanneer", vandaag)
        .gte("wanneer", origWanneer);

      if (e) { setError(e.message); setBusy(false); return; }
      oldFutureRows = (data ?? []) as { id: string; wanneer: string }[];
    }

    const newDates = datumsVoorWaarden(herhalingWaarden, wanneer);
    if (newDates.length === 0) {
      setError("Geen geldige herhalingsdata gevonden op basis van de ingevoerde criteria.");
      setBusy(false);
      return;
    }
    const remainingNewDates = newDates.slice(1);

    const dateToId = new Map(oldFutureRows.map((r) => [r.wanneer, r.id]));
    const matchedIds = new Set<string>();
    const insertDates: string[] = [];

    for (const d of remainingNewDates) {
      const existingId = dateToId.get(d);
      if (existingId) matchedIds.add(existingId);
      else insertDates.push(d);
    }

    const updatesExisting = oldFutureRows.filter((r) => matchedIds.has(r.id)).map((r) => r.id);
    const toDelete = oldFutureRows.filter((r) => !matchedIds.has(r.id));
    const deleteIds = toDelete.map((r) => r.id);

    const aantalInschrijvingen = await telInschrijvingen(deleteIds);

    const berichten = [
      reeksId
        ? "Je past de herhaling aan. Dit geldt voor deze activiteit en alle volgende in de reeks."
        : "Je zet herhaling aan voor deze activiteit. Er worden nieuwe activiteiten aangemaakt volgens de ingestelde regel.",
    ];
    if (deleteIds.length > 0 && aantalInschrijvingen > 0) {
      const datums = toDelete.map((r) => formatDDMM(r.wanneer)).join(", ");
      berichten.push(
        `Door deze wijziging vervallen ${deleteIds.length} activiteit${deleteIds.length !== 1 ? "en" : ""} waarop al ${aantalInschrijvingen} vrijwilliger${aantalInschrijvingen !== 1 ? "s" : ""} ingeschreven ${aantalInschrijvingen !== 1 ? "zijn" : "is"} (${datums}). Toch doorgaan?`
      );
    }

    const herhalingCols = herhalingKolommen(herhalingWaarden);

    setHerhalingBevestiging({
      titel: "Herhaling aanpassen",
      berichten,
      bevestigLabel: deleteIds.length > 0 && aantalInschrijvingen > 0 ? "Toch doorgaan" : "Bevestigen",
      gevaarlijk: deleteIds.length > 0 && aantalInschrijvingen > 0,
      actie: async () => {
        setBusy(true);
        setHerhalingBevestiging(null);

        const { error: e1 } = await supabase
          .from("activiteiten")
          .update({ ...content, wanneer, herhaling_reeks_id: reeksIdToUse, ...herhalingCols })
          .eq("id", id);
        if (e1) { setError(e1.message); setBusy(false); return; }

        if (updatesExisting.length > 0) {
          const { error: e2 } = await supabase
            .from("activiteiten")
            .update({ ...content, ...herhalingCols })
            .in("id", updatesExisting);
          if (e2) { setError(e2.message); setBusy(false); return; }
        }

        if (deleteIds.length > 0) {
          const { error: e3 } = await supabase.from("activiteiten").delete().in("id", deleteIds);
          if (e3) { setError(e3.message); setBusy(false); return; }
        }

        if (insertDates.length > 0) {
          const rows = insertDates.map((d) => ({
            ...content,
            wanneer: d,
            herhaling_reeks_id: reeksIdToUse,
            ...herhalingCols,
            status: "gepland",
          }));
          const { error: e4 } = await supabase.from("activiteiten").insert(rows);
          if (e4) { setError(e4.message); setBusy(false); return; }
        }

        setActiviteitenScrollTarget(id);
        router.push("/admin/activiteiten");
      },
    });

    setBusy(false);
  };

  const save = async () => {
    setError(null);
    if (!titel.trim()) return setError("Titel is verplicht.");
    if (!wanneer) return setError("Datum is verplicht.");
    if (!klantId) return setError("Klant is verplicht.");
    if (!startuur) return setError("Startuur is verplicht.");
    if (!einduur) return setError("Einduur is verplicht.");
    if (einduur <= startuur) return setError("Einduur moet later zijn dan startuur.");

    const herhalingFout = valideerHerhaling(herhalingWaarden, wanneer);
    if (herhalingFout) return setError(herhalingFout);

    const herhalingRegelGewijzigd = !herhalingRegelGelijk(herhalingWaarden, origHerhalingWaarden);

    if (herhalingRegelGewijzigd) {
      await voorbereidenHerhalingswijziging();
      return;
    }

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

      {herhalingBevestiging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full space-y-4">
            <h2 className="font-semibold text-lg">{herhalingBevestiging.titel}</h2>
            {herhalingBevestiging.berichten.map((b, i) => (
              <p key={i} className="text-sm text-gray-700">{b}</p>
            ))}
            <div className="flex flex-col gap-2">
              <button
                className={herhalingBevestiging.gevaarlijk ? "wa-btn-danger px-4 py-2 text-sm" : "wa-btn wa-btn-brand px-4 py-2 text-sm"}
                onClick={herhalingBevestiging.actie}
                disabled={busy}
              >
                {busy ? "Bezig…" : herhalingBevestiging.bevestigLabel}
              </button>
              <button
                className="wa-btn wa-btn-ghost px-4 py-2 text-sm"
                onClick={() => setHerhalingBevestiging(null)}
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
            Dit is een herhalende activiteit. Wijzig je enkel titel, uren of andere inhoud, dan kies je bij
            opslaan of dit voor &quot;enkel deze&quot; of &quot;de hele reeks&quot; geldt. Wijzig je de
            herhalingsregel zelf, dan geldt dat automatisch voor deze activiteit en alle volgende.
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1">Aantal deelnemers</label>
              <input
                type="number"
                min={0}
                className="w-full border rounded-xl p-3 bg-white"
                value={aantalDeelnemers}
                onChange={(e) => setAantalDeelnemers(Number(e.target.value))}
                onFocus={(e) => e.target.select()}
                disabled={busy}
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Aantal externe begeleiders</label>
              <input
                type="number"
                min={0}
                className="w-full border rounded-xl p-3 bg-white"
                value={aantalExterneBegeleiders}
                onChange={(e) => setAantalExterneBegeleiders(Number(e.target.value))}
                onFocus={(e) => e.target.select()}
                disabled={busy}
              />
            </div>
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

          <HerhalingVelden waarden={herhalingWaarden} onChange={setHerhalingWaarden} disabled={busy} />

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
