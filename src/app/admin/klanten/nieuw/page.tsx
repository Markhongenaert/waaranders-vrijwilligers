"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin } from "@/lib/auth";

function safeReturnTo(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//")) return null;
  return raw;
}

function normalizeNaam(s: string) {
  return s.trim().replace(/\s+/g, " ");
}

function appendQuery(urlPath: string, key: string, value: string) {
  const sep = urlPath.includes("?") ? "&" : "?";
  return `${urlPath}${sep}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

export default function NieuweKlantPage() {
  const sp = useSearchParams();
  const returnTo = safeReturnTo(sp.get("returnTo"));

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const [naam, setNaam] = useState("");
  const [contactpersoonNaam, setContactpersoonNaam] = useState("");
  const [contactpersoonTelefoon, setContactpersoonTelefoon] = useState("");
  const [adres, setAdres] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user ?? null;
      if (!user) {
        window.location.href = "/login";
        return;
      }

      const ok = await isDoenkerOrAdmin();
      setAllowed(ok);
      setLoading(false);
    };

    init();
  }, []);

  const backHref = useMemo(() => {
    if (returnTo) return returnTo;
    return "/admin/klanten";
  }, [returnTo]);

  const checkUniqNaam = async (naamNorm: string): Promise<boolean> => {
    // case-insensitive check op ALLE klanten (ook gearchiveerde), om “ooit dubbel” te vermijden
    const { data, error } = await supabase
      .from("klanten")
      .select("id")
      .ilike("naam", naamNorm) // ilike is case-insensitive, maar matcht exact enkel als string gelijk is
      .limit(1);

    if (error) {
      // als check faalt: liever niet blokkeren met stille error; we tonen error
      setError(error.message);
      return false;
    }

    return (data ?? []).length === 0;
  };

  const save = async () => {
    setError(null);
    setMsg(null);

    const naamNorm = normalizeNaam(naam);
    if (!naamNorm) {
      setError("Naam is verplicht.");
      return;
    }

    setBusy(true);

    // Pre-check om de "foutmelding maar" te leveren vóór insert
    const okUniq = await checkUniqNaam(naamNorm);
    if (!okUniq) {
      setError("Deze klantnaam bestaat al (hoofdletters/spaties tellen niet). Kies een andere naam.");
      setBusy(false);
      return;
    }

    const payload: any = {
      naam: naamNorm,
      contactpersoon_naam: contactpersoonNaam.trim() ? contactpersoonNaam.trim() : null,
      contactpersoon_telefoon: contactpersoonTelefoon.trim() ? contactpersoonTelefoon.trim() : null,
      adres: adres.trim() ? adres.trim() : null,
      actief: true,
      gearchiveerd_op: null,
    };

    const { data: inserted, error } = await supabase
      .from("klanten")
      .insert(payload)
      .select("id")
      .single();

    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }

    setMsg("Klant toegevoegd.");

    const newId = inserted?.id as string | undefined;

    // returnTo flow: ga terug naar waar je vandaan kwam; geef klantId mee voor later auto-select
    if (returnTo && newId) {
      const target = appendQuery(returnTo, "klantId", newId);
      window.location.href = target;
      return;
    }

    // anders: terug naar klantenlijst
    window.location.href = "/admin/klanten";
  };

  if (loading) return <main className="mx-auto max-w-3xl p-6 md:p-10">Laden…</main>;

  if (!allowed) {
    return (
      <main className="mx-auto max-w-3xl p-6 md:p-10">
        <h1 className="text-3xl font-semibold tracking-tight mb-2">Nieuwe klant</h1>
        <p>Je hebt geen rechten om deze pagina te bekijken.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-6 md:p-10">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight mb-1">Nieuwe klant</h1>
          {returnTo && (
            <p className="text-sm text-gray-600">
              Na opslaan ga je terug naar: <span className="font-mono">{returnTo}</span>
            </p>
          )}
        </div>

        <Link className="border rounded-xl px-3 py-2 text-sm" href={backHref}>
          Annuleren
        </Link>
      </div>

      {error && <p className="text-red-600 mb-4">Fout: {error}</p>}
      {msg && <p className="text-green-700 mb-4">{msg}</p>}

      <div className="border rounded-2xl p-4 bg-white/80 shadow-sm space-y-4">
        <div>
          <label className="text-sm font-medium block mb-1">Naam (uniek, verplicht)</label>
          <input
            className="w-full border rounded-xl p-3"
            value={naam}
            onChange={(e) => setNaam(e.target.value)}
            placeholder="bv. De Doenkers vzw"
          />
          <p className="text-xs text-gray-600 mt-1">
            Hoofdletters en extra spaties worden genegeerd om dubbels te vermijden.
          </p>
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Contactpersoon (naam)</label>
          <input
            className="w-full border rounded-xl p-3"
            value={contactpersoonNaam}
            onChange={(e) => setContactpersoonNaam(e.target.value)}
            placeholder="bv. Els Peeters"
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Contactpersoon (telefoon)</label>
          <input
            className="w-full border rounded-xl p-3"
            value={contactpersoonTelefoon}
            onChange={(e) => setContactpersoonTelefoon(e.target.value)}
            placeholder="bv. 0470 12 34 56"
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Adres</label>
          <textarea
            className="w-full border rounded-xl p-3"
            rows={3}
            value={adres}
            onChange={(e) => setAdres(e.target.value)}
            placeholder="straat + nr, postcode, gemeente"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <button className="border rounded-xl px-4 py-2" onClick={save} disabled={busy}>
            {busy ? "Bezig…" : "Opslaan"}
          </button>
          <Link className="border rounded-xl px-4 py-2" href={backHref}>
            Annuleren
          </Link>
        </div>
      </div>
    </main>
  );
}