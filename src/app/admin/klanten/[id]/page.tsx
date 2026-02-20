"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin } from "@/lib/auth";

type Klant = {
  id: string;
  naam: string;
  contactpersoon_naam: string | null;
  contactpersoon_telefoon: string | null;
  adres: string | null;
  doelgroep_id: string | null;
  aanspreekpunt_vrijwilliger_id: string | null;
  actief: boolean;
  gearchiveerd_op: string | null;
};

type Doelgroep = {
  id: string;
  titel: string;
};

type Vrijwilliger = {
  id: string;
  naam: string | null;
};

function normalizeNaam(s: string) {
  return s.trim().replace(/\s+/g, " ");
}

function safeReturnTo(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//")) return null;
  return raw;
}

export default function KlantDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const sp = useSearchParams();
  const returnTo = safeReturnTo(sp.get("returnTo"));
  const backHref = returnTo || "/admin/klanten";

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const [orig, setOrig] = useState<Klant | null>(null);

  const [naam, setNaam] = useState("");
  const [contactpersoonNaam, setContactpersoonNaam] = useState("");
  const [contactpersoonTelefoon, setContactpersoonTelefoon] = useState("");
  const [adres, setAdres] = useState("");
  const [doelgroepId, setDoelgroepId] = useState<string>("");
  const [aanspreekpuntId, setAanspreekpuntId] = useState<string>("");

  const [doelgroepen, setDoelgroepen] = useState<Doelgroep[]>([]);
  const [vrijwilligers, setVrijwilligers] = useState<Vrijwilliger[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

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

    // Klant laden
    const { data: row, error: e } = await supabase.from("klanten").select("*").eq("id", id).single();

    if (e) {
      setError(e.message);
      setLoading(false);
      return;
    }

    const k = row as Klant;
    setOrig(k);

    setNaam(k.naam ?? "");
    setContactpersoonNaam(k.contactpersoon_naam ?? "");
    setContactpersoonTelefoon(k.contactpersoon_telefoon ?? "");
    setAdres(k.adres ?? "");
    setDoelgroepId(k.doelgroep_id ?? "");
    setAanspreekpuntId(k.aanspreekpunt_vrijwilliger_id ?? "");

    // Doelgroepen laden
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

    // Vrijwilligers laden
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

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Best-effort client check (echte garantie: unique in Supabase)
  const checkUniqNaam = async (naamNorm: string): Promise<boolean> => {
    const target = naamNorm.toLowerCase();

    const { data, error } = await supabase.from("klanten").select("id,naam");
    if (error) return true; // niet blokkeren als check faalt

    const rows = (data ?? []) as { id: string; naam: string }[];

    const hit = rows.find(
      (r) => r.id !== id && normalizeNaam(r.naam).toLowerCase() === target
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

  if (loading) return <main className="p-10">Laden…</main>;
  if (!allowed) return <main className="p-10">Geen rechten.</main>;
  if (!orig) return <main className="p-10">Klant niet gevonden.</main>;

  return (
    <main className="mx-auto max-w-3xl p-6 md:p-10">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-3xl font-semibold mb-1">Klant bewerken</h1>
          <p className="text-sm text-gray-600">
            Archiveren zit bewust niet in deze pagina (te riskant als “dagelijkse knop”).
          </p>
        </div>

        <Link className="border rounded-xl px-3 py-2 text-sm" href={backHref}>
          Terug
        </Link>
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}
      {msg && <p className="text-green-700 mb-4">{msg}</p>}

      <div className="space-y-4 border rounded-2xl p-4 bg-white/80 shadow-sm">
        <div>
          <label className="text-sm font-medium block mb-1">Naam</label>
          <input className="w-full border rounded-xl p-3" value={naam} onChange={(e) => setNaam(e.target.value)} disabled={busy} />
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
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Aanspreekpunt</label>
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
        </div>

        <div className="flex gap-2">
          <button className="border rounded-xl px-4 py-2" onClick={save} disabled={busy}>
            {busy ? "Bezig…" : "Opslaan"}
          </button>

          <Link className="border rounded-xl px-4 py-2" href={backHref}>
            Terug
          </Link>
        </div>
      </div>
    </main>
  );
}