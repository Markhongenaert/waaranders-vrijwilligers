"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin } from "@/lib/auth";

type Klant = {
  id: string;
  naam: string;
  contactpersoon_naam: string | null;
  contactpersoon_telefoon: string | null;
  adres: string | null;
  actief: boolean;
  gearchiveerd_op: string | null;
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

export default function KlantDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const sp = useSearchParams();
  const returnTo = safeReturnTo(sp.get("returnTo"));

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const [orig, setOrig] = useState<Klant | null>(null);

  const [naam, setNaam] = useState("");
  const [contactpersoonNaam, setContactpersoonNaam] = useState("");
  const [contactpersoonTelefoon, setContactpersoonTelefoon] = useState("");
  const [adres, setAdres] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const backHref = useMemo(() => {
    if (returnTo) return returnTo;
    return "/admin/klanten";
  }, [returnTo]);

  const load = async () => {
    setLoading(true);
    setError(null);
    setMsg(null);

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

    const { data: row, error: e } = await supabase
      .from("klanten")
      .select("id,naam,contactpersoon_naam,contactpersoon_telefoon,adres,actief,gearchiveerd_op")
      .eq("id", id)
      .single();

    if (e) {
      setError(e.message);
      setOrig(null);
      setLoading(false);
      return;
    }

    const k = row as Klant;
    setOrig(k);

    setNaam(k.naam ?? "");
    setContactpersoonNaam(k.contactpersoon_naam ?? "");
    setContactpersoonTelefoon(k.contactpersoon_telefoon ?? "");
    setAdres(k.adres ?? "");

    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const checkUniqNaam = async (naamNorm: string): Promise<boolean> => {
    // case-insensitive check, maar eigen record uitsluiten
    const { data, error } = await supabase.from("klanten").select("id,naam").limit(2000);
    if (error) {
      setError(error.message);
      return false;
    }

    const rows = (data ?? []) as { id: string; naam: string }[];
    const hit = rows.find(
      (r) => r.id !== id && normalizeNaam(r.naam).toLowerCase() === naamNorm.toLowerCase()
    );

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
      setError("Deze klantnaam bestaat al (hoofdletters/spaties tellen niet). Kies een andere naam.");
      setBusy(false);
      return;
    }

    const payload: any = {
      naam: naamNorm,
      contactpersoon_naam: contactpersoonNaam.trim() ? contactpersoonNaam.trim() : null,
      contactpersoon_telefoon: contactpersoonTelefoon.trim() ? contactpersoonTelefoon.trim() : null,
      adres: adres.trim() ? adres.trim() : null,
    };

    const { error } = await supabase.from("klanten").update(payload).eq("id", id);

    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }

    setMsg("Klant bijgewerkt.");
    await load();
    setBusy(false);
  };

  const archive = async () => {
    const ok = window.confirm(
      "Klant archiveren?\n\n- De klant verdwijnt uit dropdowns bij ‘activiteit toevoegen’\n- Bestaande activiteiten blijven aan deze klant hangen"
    );
    if (!ok) return;

    setBusy(true);
    setError(null);
    setMsg(null);

    const { error } = await supabase
      .from("klanten")
      .update({ actief: false, gearchiveerd_op: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }

    setMsg("Klant gearchiveerd.");
    await load();
    setBusy(false);
  };

  if (loading) return <main className="mx-auto max-w-3xl p-6 md:p-10">Laden…</main>;

  if (!allowed) {
    return (
      <main className="mx-auto max-w-3xl p-6 md:p-10">
        <h1 className="text-3xl font-semibold tracking-tight mb-2">Klant</h1>
        <p>Je hebt geen rechten om deze pagina te bekijken.</p>
      </main>
    );
  }

  if (!orig) {
    return (
      <main className="mx-auto max-w-3xl p-6 md:p-10">
        <h1 className="text-3xl font-semibold tracking-tight mb-2">Klant</h1>
        <p className="text-red-600">Klant niet gevonden.</p>
        <Link className="border rounded-xl px-3 py-2 text-sm inline-block mt-3" href={backHref}>
          Terug
        </Link>
      </main>
    );
  }

  const archived = !orig.actief || !!orig.gearchiveerd_op;

  return (
    <main className="mx-auto max-w-3xl p-6 md:p-10">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight mb-1">Klant</h1>
          <div className="text-sm text-gray-600">
            ID: <span className="font-mono">{orig.id}</span>
            {archived && (
              <span className="ml-3 text-xs px-2 py-0.5 rounded-full border bg-gray-100 text-gray-700">
                gearchiveerd
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Link className="border rounded-xl px-3 py-2 text-sm" href={backHref}>
            Terug
          </Link>
        </div>
      </div>

      {error && <p className="text-red-600 mb-4">Fout: {error}</p>}
      {msg && <p className="text-green-700 mb-4">{msg}</p>}

      {archived && (
        <div className="mb-4 border rounded-2xl p-4 bg-white/80 shadow-sm">
          <div className="font-medium">Deze klant is gearchiveerd</div>
          <p className="text-sm text-gray-700 mt-1">
            Hij blijft bestaan voor oude activiteiten, maar verschijnt niet meer in de klantkeuze bij nieuwe activiteiten.
          </p>
        </div>
      )}

      <div className="border rounded-2xl p-4 bg-white/80 shadow-sm space-y-4">
        <div>
          <label className="text-sm font-medium block mb-1">Naam (uniek, verplicht)</label>
          <input
            className="w-full border rounded-xl p-3"
            value={naam}
            onChange={(e) => setNaam(e.target.value)}
            disabled={busy}
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Contactpersoon (naam)</label>
          <input
            className="w-full border rounded-xl p-3"
            value={contactpersoonNaam}
            onChange={(e) => setContactpersoonNaam(e.target.value)}
            disabled={busy}
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Contactpersoon (telefoon)</label>
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

        <div className="flex gap-2 flex-wrap">
          <button className="border rounded-xl px-4 py-2" onClick={save} disabled={busy || archived}>
            {busy ? "Bezig…" : "Opslaan"}
          </button>

          <Link className="border rounded-xl px-4 py-2" href={backHref}>
            Annuleren
          </Link>

          {!archived && (
            <button className="border rounded-xl px-4 py-2" onClick={archive} disabled={busy}>
              Archiveren
            </button>
          )}
        </div>

        {archived && (
          <p className="text-xs text-gray-600">
            (Opslaan is uitgeschakeld voor gearchiveerde klanten. Als je later “heractiveren” wil, bouwen we dat netjes in.)
          </p>
        )}
      </div>
    </main>
  );
}