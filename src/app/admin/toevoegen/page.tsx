"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin } from "@/lib/auth";

const DOELGROEPEN = [
  { code: "DG1", label: "DG1 – (naam later)" },
  { code: "DG2", label: "DG2 – (naam later)" },
  { code: "DG3", label: "DG3 – (naam later)" },
  { code: "DG4", label: "DG4 – (naam later)" },
  { code: "DG5", label: "DG5 – (naam later)" },
  { code: "DG6", label: "DG6 – (naam later)" },
  { code: "DG7", label: "DG7 – (naam later)" },
  { code: "DG8", label: "DG8 – (naam later)" },
] as const;

type KlantMini = {
  id: string;
  naam: string;
};

function buildReturnTo() {
  // Werkt lokaal + in productie zonder gedoe
  // /admin/klanten/nieuw?returnTo=/admin/toevoegen
  return encodeURIComponent("/admin/toevoegen");
}

export default function ToevoegenActiviteitPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const [klanten, setKlanten] = useState<KlantMini[]>([]);
  const [klantenLoaded, setKlantenLoaded] = useState(false);

  const [titel, setTitel] = useState("");
  const [toelichting, setToelichting] = useState("");
  const [wanneer, setWanneer] = useState("");
  const [aantal, setAantal] = useState<number>(1);
  const [doelgroep, setDoelgroep] = useState<string>("DG1");

  const [klantId, setKlantId] = useState<string>("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const loadKlanten = async () => {
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
      return;
    }

    const list = (data ?? []) as KlantMini[];
    setKlanten(list);
    setKlantenLoaded(true);

    // als er klanten zijn en er is nog niets gekozen → kies de eerste
    if (list.length > 0 && !klantId) {
      setKlantId(list[0].id);
    }
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

      if (ok) {
        await loadKlanten();
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

    setBusy(true);

    const payload: any = {
      titel: titel.trim(),
      toelichting: toelichting ? toelichting : null,
      wanneer, // YYYY-MM-DD
      aantal_vrijwilligers: Number.isFinite(aantal) ? aantal : null,
      doelgroep: doelgroep || null,
      klant_id: klantId,
    };

    const { error } = await supabase.from("activiteiten").insert(payload);

    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }

    setMsg("Activiteit toegevoegd.");

    // reset form
    setTitel("");
    setToelichting("");
    setWanneer("");
    setAantal(1);
    setDoelgroep("DG1");
    // klantId houden we staan (meestal maak je meerdere activiteiten voor dezelfde klant)

    setBusy(false);

    // terug naar beheer — voorkomt “en nu wat?” 😄
    window.location.href = "/admin/activiteiten";
  };

  if (loading) return <main className="mx-auto max-w-3xl p-6 md:p-10">Laden…</main>;

  if (!allowed) {
    return (
      <main className="mx-auto max-w-3xl p-6 md:p-10">
        <h1 className="text-3xl font-semibold tracking-tight mb-2">Activiteit toevoegen</h1>
        <p>Je hebt geen rechten om deze pagina te bekijken.</p>
      </main>
    );
  }

  const nieuweKlantHref = `/admin/klanten/nieuw?returnTo=${buildReturnTo()}`;

  return (
    <main className="mx-auto max-w-3xl p-6 md:p-10">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight mb-1">Activiteit toevoegen</h1>
        </div>

        <a className="border rounded-xl px-3 py-2 text-sm" href="/admin/activiteiten">
          Naar beheren
        </a>
      </div>

      {error && <p className="text-red-600 mb-4">Fout: {error}</p>}
      {msg && <p className="text-green-700 mb-4">{msg}</p>}

      {/* Klanten-blokkade als er nog geen klanten zijn */}
      {klantenLoaded && klanten.length === 0 && (
        <div className="mb-6 border rounded-2xl p-4 bg-white/80 shadow-sm">
          <div className="font-medium">Er zijn nog geen klanten</div>
          <p className="text-sm text-gray-700 mt-1">
            “Klant” is verplicht bij een activiteit. Maak eerst minstens één klant aan.
          </p>
          <div className="mt-3 flex gap-2 flex-wrap">
            <a className="border rounded-xl px-3 py-2 text-sm" href={nieuweKlantHref}>
              + Nieuwe klant
            </a>
            <a className="border rounded-xl px-3 py-2 text-sm" href="/admin/klanten">
              Klanten beheren
            </a>
          </div>
        </div>
      )}

      <div className="border rounded-2xl p-4 bg-white/80 shadow-sm space-y-4">
        {/* KLANT (verplicht) */}
        <div>
          <label className="text-sm font-medium block mb-1">Klant (verplicht)</label>

          <div className="flex gap-2">
            <select
              className="w-full border rounded-xl p-3"
              value={klantId}
              onChange={(e) => setKlantId(e.target.value)}
              disabled={!klantenLoaded || klanten.length === 0}
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

            <a className="border rounded-xl px-3 py-2 text-sm whitespace-nowrap" href={nieuweKlantHref}>
              + Nieuwe klant
            </a>
          </div>

          <p className="text-xs text-gray-600 mt-2">
            Alleen actieve klanten (niet-gearchiveerd) verschijnen hier.
          </p>
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Titel</label>
          <input className="w-full border rounded-xl p-3" value={titel} onChange={(e) => setTitel(e.target.value)} />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Toelichting</label>
          <textarea
            className="w-full border rounded-xl p-3"
            rows={4}
            value={toelichting}
            onChange={(e) => setToelichting(e.target.value)}
            placeholder="Extra info voor vrijwilligers (mag meerdere regels bevatten)"
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Datum</label>
          <input
            type="date"
            className="w-full border rounded-xl p-3"
            value={wanneer}
            onChange={(e) => setWanneer(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Aantal vrijwilligers (nodig)</label>
          <input
            type="number"
            min={0}
            className="w-full border rounded-xl p-3"
            value={aantal}
            onChange={(e) => setAantal(Number(e.target.value))}
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Doelgroep</label>
          <select
            className="w-full border rounded-xl p-3"
            value={doelgroep}
            onChange={(e) => setDoelgroep(e.target.value)}
          >
            {DOELGROEPEN.map((dg) => (
              <option key={dg.code} value={dg.code}>
                {dg.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            className="border rounded-xl px-4 py-2"
            onClick={save}
            disabled={busy || !klantenLoaded || klanten.length === 0 || !klantId}
          >
            {busy ? "Bezig…" : "Opslaan"}
          </button>
          <a className="border rounded-xl px-4 py-2" href="/admin/activiteiten">
            Annuleren
          </a>
        </div>
      </div>
    </main>
  );
}