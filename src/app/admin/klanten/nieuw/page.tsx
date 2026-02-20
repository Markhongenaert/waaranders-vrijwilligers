"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin } from "@/lib/auth";

type Doelgroep = {
  id: string;
  titel: string;
};

type Vrijwilliger = {
  id: string;
  naam: string | null;
};

function safeReturnTo(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//")) return null;
  return raw;
}

function normalizeNaam(s: string) {
  return s.trim().replace(/\s+/g, " ");
}

// Voeg 1 queryparameter toe (of vervang hem) op een pad zoals "/admin/toevoegen?x=1"
function setQueryParam(urlPath: string, key: string, value: string) {
  const base = new URL(urlPath, "http://dummy.local");
  base.searchParams.set(key, value);
  return base.pathname + "?" + base.searchParams.toString();
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

  const [doelgroepen, setDoelgroepen] = useState<Doelgroep[]>([]);
  const [vrijwilligers, setVrijwilligers] = useState<Vrijwilliger[]>([]);

  const [doelgroepId, setDoelgroepId] = useState<string>(""); // optioneel
  const [aanspreekpuntId, setAanspreekpuntId] = useState<string>(""); // optioneel

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const backHref = useMemo(() => {
    // Als je van “Toevoegen activiteit” komt, is returnTo handig als terugknop.
    // Anders gewoon terug naar klantenlijst.
    return returnTo || "/admin/klanten";
  }, [returnTo]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
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

      const { data: dg, error: eDg } = await supabase
        .from("doelgroepen")
        .select("id,titel")
        .order("titel", { ascending: true });

      if (eDg) {
        setError(eDg.message);
        setLoading(false);
        return;
      }
      setDoelgroepen((dg ?? []) as Doelgroep[]);

      const { data: vw, error: eVw } = await supabase
        .from("vrijwilligers")
        .select("id,naam")
        .order("naam", { ascending: true });

      if (eVw) {
        setError(eVw.message);
        setLoading(false);
        return;
      }
      setVrijwilligers((vw ?? []) as Vrijwilliger[]);

      setLoading(false);
    };

    init();
  }, []);

  // Best-effort client check (echte garantie blijft: unique index/constraint in Supabase)
  const checkUniqNaam = async (naamNorm: string): Promise<boolean> => {
    const target = naamNorm.toLowerCase();

    const { data, error } = await supabase.from("klanten").select("id,naam");
    if (error) return true; // niet blokkeren als check faalt

    const rows = (data ?? []) as { id: string; naam: string }[];
    const hit = rows.find((r) => normalizeNaam(r.naam).toLowerCase() === target);

    return !hit;
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

    const okUniq = await checkUniqNaam(naamNorm);
    if (!okUniq) {
      setError("Deze klantnaam bestaat al (hoofdletters/spaties tellen niet).");
      setBusy(false);
      return;
    }

    const payload: any = {
      naam: naamNorm,
      contactpersoon_naam: contactpersoonNaam || null,
      contactpersoon_telefoon: contactpersoonTelefoon || null,
      adres: adres || null,
      doelgroep_id: doelgroepId || null,
      aanspreekpunt_vrijwilliger_id: aanspreekpuntId || null,
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

    // returnTo flow: terug naar vorige pagina + klant_id doorgeven
    if (returnTo && newId) {
      // we zetten beide keys: klant_id (nieuw) en klantId (oude compat)
      let target = setQueryParam(returnTo, "klant_id", newId);
      target = setQueryParam(target, "klantId", newId);
      window.location.href = target;
      return;
    }

    window.location.href = "/admin/klanten";
  };

  if (loading) return <main className="mx-auto max-w-3xl p-6 md:p-10">Laden…</main>;
  if (!allowed) return <main className="mx-auto max-w-3xl p-6 md:p-10">Geen rechten.</main>;

  return (
    <main className="mx-auto max-w-3xl p-6 md:p-10">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight mb-1">Nieuwe klant</h1>
          <p className="text-sm text-gray-600">Maak een klant aan (met doelgroep en aanspreekpunt indien gewenst).</p>
        </div>

        <Link className="border rounded-xl px-3 py-2 text-sm" href={backHref}>
          Terug
        </Link>
      </div>

      {error && <p className="text-red-600 mb-4">Fout: {error}</p>}
      {msg && <p className="text-green-700 mb-4">{msg}</p>}

      <div className="space-y-4 border rounded-2xl p-4 bg-white/80 shadow-sm">
        <div>
          <label className="text-sm font-medium block mb-1">Naam (verplicht)</label>
          <input
            className="w-full border rounded-xl p-3"
            value={naam}
            onChange={(e) => setNaam(e.target.value)}
            disabled={busy}
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Contactpersoon naam</label>
          <input
            className="w-full border rounded-xl p-3"
            value={contactpersoonNaam}
            onChange={(e) => setContactpersoonNaam(e.target.value)}
            disabled={busy}
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Contactpersoon telefoon</label>
          <input
            className="w-full border rounded-xl p-3"
            value={contactpersoonTelefoon}
            onChange={(e) => setContactpersoonTelefoon(e.target.value)}
            disabled={busy}
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Adres</label>
          <textarea
            className="w-full border rounded-xl p-3"
            rows={3}
            value={adres}
            onChange={(e) => setAdres(e.target.value)}
            disabled={busy}
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Doelgroep</label>
          <select
            className="w-full border rounded-xl p-3"
            value={doelgroepId}
            onChange={(e) => setDoelgroepId(e.target.value)}
            disabled={busy}
          >
            <option value="">— Geen —</option>
            {doelgroepen.map((dg) => (
              <option key={dg.id} value={dg.id}>
                {dg.titel}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">Optioneel.</p>
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Aanspreekpunt (vrijwilliger)</label>
          <select
            className="w-full border rounded-xl p-3"
            value={aanspreekpuntId}
            onChange={(e) => setAanspreekpuntId(e.target.value)}
            disabled={busy}
          >
            <option value="">— Geen —</option>
            {vrijwilligers.map((v) => (
              <option key={v.id} value={v.id}>
                {v.naam ?? "(zonder naam)"}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">Optioneel.</p>
        </div>

        <div className="flex gap-2">
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