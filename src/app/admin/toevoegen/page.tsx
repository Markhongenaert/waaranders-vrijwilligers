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

export default function ToevoegenActiviteitPage() {
  const sp = useSearchParams();

  // na "nieuwe klant" komen we terug met ?klant_id=...
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

  // FK
  const [klantId, setKlantId] = useState<string>("");

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

      // Preselect klant enkel als URL klant_id geldig is
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

    if (!titel.trim()) {
      setError("Titel is verplicht.");
      return;
    }
    if (!wanneer) {
      setError("Datum (wanneer) is verplicht.");
      return;
    }
    if (!klantId) {
      setError("Klant is verplicht. Maak eerst een klant aan of selecteer er één.");
      return;
    }
    if (!startuur) {
      setError("Startuur is verplicht.");
      return;
    }
    if (!einduur) {
      setError("Einduur is verplicht.");
      return;
    }

    // simpele check: einduur moet na startuur liggen (zelfde dag)
    if (einduur <= startuur) {
      setError("Einduur moet later zijn dan startuur.");
      return;
    }

    setBusy(true);

    const payload = {
      titel: titel.trim(),
      toelichting: toelichting?.trim() ? toelichting.trim() : null,
      wanneer, // YYYY-MM-DD
      startuur, // "HH:MM"
      einduur,  // "HH:MM"
      aantal_vrijwilligers: Number.isFinite(aantal) ? Number(aantal) : 0,
      klant_id: klantId,
      status: "gepland",
    };

    const { error: e } = await supabase.from("activiteiten").insert(payload);

    if (e) {
      setError(e.message);
      setBusy(false);
      return;
    }

    setMsg("Activiteit toegevoegd.");

    // reset (klant laten staan is handig)
    setTitel("");
    setToelichting("");
    setWanneer("");
    setStartuur("");
    setEinduur("");
    setAantal(1);

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
            “Klant” is verplicht bij een activiteit. Maak eerst minstens één klant aan.
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
        {/* KLANT */}
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

        {/* TITEL */}
        <div>
          <label className="text-sm font-medium block mb-1">Titel</label>
          <input
            className="w-full border rounded-xl p-3 bg-white"
            value={titel}
            onChange={(e) => setTitel(e.target.value)}
            disabled={busy}
          />
        </div>

        {/* TOELICHTING */}
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

        {/* DATUM */}
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

        {/* START/EIND */}
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

        {/* AANTAL */}
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

        <div className="flex gap-2 flex-wrap">
          <button
            className="border bg-white rounded-xl px-4 py-2"
            onClick={save}
            disabled={busy || noKlanten || !klantId || !startuur || !einduur}
          >
            {busy ? "Bezig…" : "Opslaan"}
          </button>
          <a className="border bg-white rounded-xl px-4 py-2" href="/admin/activiteiten">
            Annuleren
          </a>
        </div>
      </div>
    </main>
  );
}