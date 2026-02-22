"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin } from "@/lib/auth";

type KlantMini = {
  id: string;
  naam: string;
};

type DoelgroepMini = {
  id: string;
  titel: string;
  omschrijving: string | null;
};

function safeReturnTo(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//")) return null;
  return raw;
}

function buildReturnTo(): string {
  // nieuwe klant pagina krijgt een veilige returnTo
  // /admin/klanten/nieuw?returnTo=/admin/toevoegen
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

  const [doelgroepen, setDoelgroepen] = useState<DoelgroepMini[]>([]);
  const [doelgroepenLoaded, setDoelgroepenLoaded] = useState(false);

  const [titel, setTitel] = useState("");
  const [toelichting, setToelichting] = useState("");
  const [wanneer, setWanneer] = useState("");
  const [aantal, setAantal] = useState<number>(1);

  // FK's
  const [klantId, setKlantId] = useState<string>("");
  const [doelgroepId, setDoelgroepId] = useState<string>("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const nieuweKlantHref = useMemo(() => `/admin/klanten/nieuw?returnTo=${buildReturnTo()}`, []);
  const klantenBeheerHref = "/admin/klanten";

  const loadKlanten = async (): Promise<KlantMini[]> => {
    setKlantenLoaded(false);

    const { data, error: e } = await supabase
      .from("klanten")
      .select("id,naam")
      .eq("actief", true)
      .is("gearchiveerd_op", null) // <-- juiste kolom
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

  const loadDoelgroepen = async (): Promise<DoelgroepMini[]> => {
    setDoelgroepenLoaded(false);

    const { data, error: e } = await supabase
      .from("doelgroepen")
      .select("id,titel,omschrijving")
      .order("titel", { ascending: true });

    if (e) {
      setError(e.message);
      setDoelgroepen([]);
      setDoelgroepenLoaded(true);
      return [];
    }

    const list = (data ?? []) as DoelgroepMini[];
    setDoelgroepen(list);
    setDoelgroepenLoaded(true);
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

      // parallel laden
      const [kList, dgList] = await Promise.all([loadKlanten(), loadDoelgroepen()]);

      // klant selecteren: URL > bestaande selectie > eerste klant
      if (kList.length > 0) {
        const preferred = klantIdFromUrl && kList.some((k) => k.id === klantIdFromUrl) ? klantIdFromUrl : "";
        setKlantId(preferred || klantId || kList[0].id);
      } else {
        setKlantId("");
      }

      // doelgroep: behoud als mogelijk, anders eerste uit lijst, of leeg
      if (dgList.length > 0) {
        const keep = doelgroepId && dgList.some((d) => d.id === doelgroepId);
        setDoelgroepId(keep ? doelgroepId : dgList[0].id);
      } else {
        setDoelgroepId("");
      }

      setLoading(false);
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (!doelgroepId) {
      setError("Doelgroep is verplicht. Voeg eerst doelgroepen toe in Supabase of kies er één.");
      return;
    }

    setBusy(true);

    const payload = {
      titel: titel.trim(),
      toelichting: toelichting ? toelichting : null,
      wanneer, // YYYY-MM-DD
      aantal_vrijwilligers: Number.isFinite(aantal) ? aantal : null,
      klant_id: klantId,
      doelgroep_id: doelgroepId, // <-- FK naar doelgroepen tabel
    };

    const { error } = await supabase.from("activiteiten").insert(payload);

    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }

    setMsg("Activiteit toegevoegd.");

    // reset (klant/doelgroep houden we staan)
    setTitel("");
    setToelichting("");
    setWanneer("");
    setAantal(1);

    setBusy(false);

    // terug naar beheer
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

  const noKlanten = klantenLoaded && klanten.length === 0;
  const noDoelgroepen = doelgroepenLoaded && doelgroepen.length === 0;

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-6 md:p-10">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight mb-1">Activiteit toevoegen</h1>
          <p className="text-sm text-gray-600">Maak een nieuwe activiteit aan en koppel meteen klant + doelgroep.</p>
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
        <p className="text-emerald-800 bg-white border border-emerald-100 rounded-xl p-3 mb-4">{msg}</p>
      )}

      {(noKlanten || noDoelgroepen) && (
        <div className="mb-6 border rounded-2xl p-4 bg-white shadow-sm">
          {noKlanten && (
            <>
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
            </>
          )}

          {noDoelgroepen && (
            <>
              <div className="font-semibold mt-4">Er zijn nog geen doelgroepen</div>
              <p className="text-sm text-gray-700 mt-1">
                “Doelgroep” is verplicht. Voeg eerst doelgroepen toe in Supabase (tabel <span className="font-mono">doelgroepen</span>).
              </p>
            </>
          )}
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
              disabled={!klantenLoaded || klanten.length === 0 || busy}
            >
              {klantenLoaded && klanten.length > 0 ? (
                klanten.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.naam}
                  </option>
                ))
              ) : (
                <option value="">(geen klanten)</option>
              )}
            </select>

            <a className="border bg-white rounded-xl px-3 py-2 text-sm whitespace-nowrap" href={nieuweKlantHref}>
              + Nieuwe klant
            </a>
          </div>
        </div>

        {/* DOELGROEP */}
        <div>
          <label className="text-sm font-medium block mb-1">Doelgroep (verplicht)</label>
          <select
            className="w-full border rounded-xl p-3 bg-white"
            value={doelgroepId}
            onChange={(e) => setDoelgroepId(e.target.value)}
            disabled={!doelgroepenLoaded || doelgroepen.length === 0 || busy}
          >
            {doelgroepenLoaded && doelgroepen.length > 0 ? (
              doelgroepen.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.titel}
                </option>
              ))
            ) : (
              <option value="">(geen doelgroepen)</option>
            )}
          </select>
          {doelgroepId && (
            <div className="text-xs text-gray-600 mt-1">
              {doelgroepen.find((d) => d.id === doelgroepId)?.omschrijving ?? ""}
            </div>
          )}
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
            placeholder="Extra info voor vrijwilligers (mag meerdere regels bevatten)"
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
            disabled={busy || noKlanten || noDoelgroepen || !klantId || !doelgroepId}
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