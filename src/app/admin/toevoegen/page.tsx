"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin } from "@/lib/auth";

type KlantMini = {
  id: string;
  naam: string;
};

function buildReturnTo(): string {
  return encodeURIComponent("/admin/toevoegen");
}

/** Genereer alle datums voor een herhalende activiteit. */
function generateHerhalingsDatums(
  start: string,
  type: "wekelijks" | "maandelijks",
  interval: number,
  stop: { type: "aantal"; count: number } | { type: "datum"; until: string }
): string[] {
  const dates: string[] = [];
  let current = new Date(`${start}T00:00:00`);
  const MAX = 500;

  while (dates.length < MAX) {
    const iso = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;

    if (stop.type === "datum" && iso > stop.until) break;
    if (stop.type === "aantal" && dates.length >= stop.count) break;

    dates.push(iso);

    if (type === "wekelijks") {
      current = new Date(current.getTime() + interval * 7 * 24 * 60 * 60 * 1000);
    } else {
      const next = new Date(current);
      next.setMonth(next.getMonth() + interval);
      current = next;
    }
  }

  return dates;
}

export default function ToevoegenActiviteitPage() {
  const sp = useSearchParams();
  const klantIdFromUrl = sp.get("klant_id") || sp.get("klantId") || "";

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const [klanten, setKlanten] = useState<KlantMini[]>([]);
  const [klantenLoaded, setKlantenLoaded] = useState(false);

  const [titel, setTitel] = useState("");
  const [toelichting, setToelichting] = useState("");
  const [wanneer, setWanneer] = useState("");

  const [startuur, setStartuur] = useState(""); // "HH:MM"
  const [einduur, setEinduur] = useState(""); // "HH:MM"

  const [aantal, setAantal] = useState<number>(1);
  const [klantId, setKlantId] = useState<string>("");

  // Herhaling state
  const [herhaling, setHerhaling] = useState(false);
  const [herhalingType, setHerhalingType] = useState<"wekelijks" | "maandelijks">("wekelijks");
  const [herhalingInterval, setHerhalingInterval] = useState(1);
  const [stopType, setStopType] = useState<"aantal" | "datum">("aantal");
  const [stopAantal, setStopAantal] = useState(4);
  const [stopDatum, setStopDatum] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const nieuweKlantHref = useMemo(
    () => `/admin/klanten/nieuw?returnTo=${buildReturnTo()}`,
    []
  );
  const klantenBeheerHref = "/admin/klanten";

  const loadKlanten = async (): Promise<KlantMini[]> => {
    setKlantenLoaded(false);

    const { data, error: e } = await supabase
      .from("klanten")
      .select("id,naam")
      .eq("actief", true)
      .is("gearchiveerd_op", null)
      .order("naam", { ascending: true });

    if (e) {
      setError(e.message);
      setKlanten([]);
      setKlantenLoaded(true);
      return [];
    }

    const list = (data ?? []) as KlantMini[];
    setKlanten(list);
    setKlantenLoaded(true);
    return list;
  };

  useEffect(() => {
    const init = async () => {
      setError(null);

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

      const kList = await loadKlanten();

      if (klantIdFromUrl && kList.some((k) => k.id === klantIdFromUrl)) {
        setKlantId(klantIdFromUrl);
      } else {
        setKlantId("");
      }

      setLoading(false);
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const noKlanten = klantenLoaded && klanten.length === 0;

  const save = async () => {
    setError(null);
    setMsg(null);

    const t = titel.trim();
    if (!t) return setError("Titel is verplicht.");
    if (!wanneer) return setError("Datum (wanneer) is verplicht.");
    if (!klantId) return setError("Klant is verplicht. Maak eerst een klant aan of selecteer er één.");
    if (!startuur) return setError("Startuur is verplicht.");
    if (!einduur) return setError("Einduur is verplicht.");
    if (einduur <= startuur) return setError("Einduur moet later zijn dan startuur.");

    if (herhaling) {
      if (herhalingInterval < 1) return setError("Interval moet minstens 1 zijn.");
      if (stopType === "datum" && !stopDatum) return setError("Einddatum is verplicht bij 'Tot datum'.");
      if (stopType === "datum" && stopDatum <= wanneer) return setError("Einddatum moet na de startdatum liggen.");
      if (stopType === "aantal" && stopAantal < 1) return setError("Aantal herhalingen moet minstens 1 zijn.");
    }

    setBusy(true);

    const basePayload = {
      titel: t,
      toelichting: toelichting?.trim() ? toelichting.trim() : null,
      startuur,
      einduur,
      aantal_vrijwilligers: Number.isFinite(aantal) ? Number(aantal) : 0,
      klant_id: klantId,
      status: "gepland",
    };

    if (herhaling) {
      const datums = generateHerhalingsDatums(
        wanneer,
        herhalingType,
        herhalingInterval,
        stopType === "aantal"
          ? { type: "aantal", count: stopAantal }
          : { type: "datum", until: stopDatum }
      );

      if (datums.length === 0) {
        setError("Geen geldige herhalingsdata gevonden op basis van de ingevoerde criteria.");
        setBusy(false);
        return;
      }

      const reeksId = crypto.randomUUID();
      const rows = datums.map((d) => ({
        ...basePayload,
        wanneer: d,
        herhaling_type: herhalingType,
        herhaling_interval: herhalingInterval,
        herhaling_einde_datum: stopType === "datum" ? stopDatum : null,
        herhaling_einde_aantal: stopType === "aantal" ? stopAantal : null,
        herhaling_reeks_id: reeksId,
      }));

      const { error: e } = await supabase.from("activiteiten").insert(rows);

      if (e) {
        setError(e.message);
        setBusy(false);
        return;
      }

      setMsg(`${datums.length} activiteiten aangemaakt.`);
    } else {
      const { data, error: e } = await supabase
        .from("activiteiten")
        .insert({ ...basePayload, wanneer })
        .select("id")
        .single();

      if (e) {
        setError(e.message);
        setBusy(false);
        return;
      }

      setMsg(`Activiteit toegevoegd (id: ${data?.id}).`);
    }

    setTitel("");
    setToelichting("");
    setWanneer("");
    setStartuur("");
    setEinduur("");
    setAantal(1);
    setHerhaling(false);
    setHerhalingInterval(1);
    setHerhalingType("wekelijks");
    setStopType("aantal");
    setStopAantal(4);
    setStopDatum("");

    setBusy(false);
    window.location.href = "/admin/activiteiten";
  };

  if (loading) return <main className="mx-auto max-w-3xl p-6 md:p-10">Laden…</main>;

  if (!allowed) {
    return (
      <main className="mx-auto max-w-3xl p-6 md:p-10">
        <div className="bg-white border rounded-2xl p-4 shadow-sm">
          <h1 className="text-3xl font-semibold tracking-tight mb-2">Activiteit toevoegen</h1>
          <p>Je hebt geen rechten om deze pagina te bekijken.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-6 md:p-10">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight mb-1">Activiteit toevoegen</h1>
          <p className="text-sm text-gray-600">Maak een nieuwe activiteit aan en koppel een klant.</p>
        </div>

        <a className="border bg-white rounded-xl px-3 py-2 text-sm" href="/admin/activiteiten">
          Naar beheren
        </a>
      </div>

      {error && (
        <p className="text-red-700 bg-white border border-red-100 rounded-xl p-3 mb-4">
          Fout: {error}
        </p>
      )}
      {msg && (
        <p className="text-emerald-800 bg-white border border-emerald-100 rounded-xl p-3 mb-4">
          {msg}
        </p>
      )}

      {noKlanten && (
        <div className="mb-6 border rounded-2xl p-4 bg-white shadow-sm">
          <div className="font-semibold">Er zijn nog geen klanten</div>
          <p className="text-sm text-gray-700 mt-1">
            "Klant" is verplicht bij een activiteit. Maak eerst minstens één klant aan.
          </p>
          <div className="mt-3 flex gap-2 flex-wrap">
            <a className="border bg-white rounded-xl px-3 py-2 text-sm" href={nieuweKlantHref}>
              + Nieuwe klant
            </a>
            <a className="border bg-white rounded-xl px-3 py-2 text-sm" href={klantenBeheerHref}>
              Klanten beheren
            </a>
          </div>
        </div>
      )}

      <div className="border rounded-2xl p-4 bg-white shadow-sm space-y-4">
        <div>
          <label className="text-sm font-medium block mb-1">Klant (verplicht)</label>
          <div className="flex gap-2">
            <select
              className="w-full border rounded-xl p-3 bg-white"
              value={klantId}
              onChange={(e) => setKlantId(e.target.value)}
              disabled={!klantenLoaded || busy}
              required
            >
              <option value="">-- kies klant --</option>
              {klanten.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.naam}
                </option>
              ))}
            </select>

            <a className="border bg-white rounded-xl px-3 py-2 text-sm whitespace-nowrap" href={nieuweKlantHref}>
              + Nieuwe klant
            </a>
          </div>
        </div>

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
            placeholder="Extra info voor vrijwilligers"
            disabled={busy}
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Datum</label>
          <input
            type="date"
            className="w-full border rounded-xl p-3 bg-white"
            value={wanneer}
            onChange={(e) => setWanneer(e.target.value)}
            disabled={busy}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

        {/* ── Herhaling ── */}
        <div className="border-t border-gray-100 pt-4 space-y-4">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={herhaling}
              onChange={(e) => setHerhaling(e.target.checked)}
              disabled={busy}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm font-medium">Deze activiteit herhaalt zich</span>
          </label>

          {herhaling && (
            <div className="space-y-4 pl-7">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium block mb-1">Frequentie</label>
                  <select
                    className="w-full border rounded-xl p-3 bg-white"
                    value={herhalingType}
                    onChange={(e) => setHerhalingType(e.target.value as "wekelijks" | "maandelijks")}
                    disabled={busy}
                  >
                    <option value="wekelijks">Elke week</option>
                    <option value="maandelijks">Elke maand</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium block mb-1">
                    Interval ({herhalingType === "wekelijks" ? "weken" : "maanden"})
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={52}
                    className="w-full border rounded-xl p-3 bg-white"
                    value={herhalingInterval}
                    onChange={(e) => setHerhalingInterval(Math.max(1, Number(e.target.value)))}
                    disabled={busy}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium block mb-2">Stopcriterium</label>
                <div className="flex flex-col sm:flex-row gap-3">
                  {/* Optie: Na X keer */}
                  <label className="flex items-center gap-2 border rounded-xl p-3 cursor-pointer flex-1 bg-white transition-colors has-[:checked]:border-blue-900 has-[:checked]:bg-blue-50">
                    <input
                      type="radio"
                      name="stopType"
                      value="aantal"
                      checked={stopType === "aantal"}
                      onChange={() => setStopType("aantal")}
                      disabled={busy}
                    />
                    <span className="text-sm whitespace-nowrap">Na</span>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      className="w-16 border rounded-lg p-1 text-sm bg-white"
                      value={stopAantal}
                      onClick={() => setStopType("aantal")}
                      onChange={(e) => {
                        setStopType("aantal");
                        setStopAantal(Math.max(1, Number(e.target.value)));
                      }}
                      disabled={busy}
                    />
                    <span className="text-sm">keer</span>
                  </label>

                  {/* Optie: Tot datum */}
                  <label className="flex items-center gap-2 border rounded-xl p-3 cursor-pointer flex-1 bg-white transition-colors has-[:checked]:border-blue-900 has-[:checked]:bg-blue-50">
                    <input
                      type="radio"
                      name="stopType"
                      value="datum"
                      checked={stopType === "datum"}
                      onChange={() => setStopType("datum")}
                      disabled={busy}
                    />
                    <span className="text-sm whitespace-nowrap">Tot</span>
                    <input
                      type="date"
                      className="border rounded-lg p-1 text-sm bg-white flex-1 min-w-0"
                      value={stopDatum}
                      onClick={() => setStopType("datum")}
                      onChange={(e) => {
                        setStopType("datum");
                        setStopDatum(e.target.value);
                      }}
                      disabled={busy}
                    />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 flex-wrap pt-2">
          <button
            className="border bg-white rounded-xl px-4 py-2"
            onClick={save}
            disabled={
              busy ||
              noKlanten ||
              !klantId ||
              !wanneer ||
              !startuur ||
              !einduur ||
              (herhaling && stopType === "datum" && !stopDatum)
            }
          >
            {busy ? "Bezig…" : herhaling ? "Reeks aanmaken" : "Opslaan"}
          </button>
          <a className="border bg-white rounded-xl px-4 py-2" href="/admin/activiteiten">
            Annuleren
          </a>
        </div>
      </div>
    </main>
  );
}
