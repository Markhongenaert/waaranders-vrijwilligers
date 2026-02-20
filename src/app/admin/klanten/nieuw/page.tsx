"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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

  const [doelgroepen, setDoelgroepen] = useState<Doelgroep[]>([]);
  const [vrijwilligers, setVrijwilligers] = useState<Vrijwilliger[]>([]);

  const [doelgroepId, setDoelgroepId] = useState<string>("");
  const [aanspreekpuntId, setAanspreekpuntId] = useState<string>("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      // Doelgroepen laden
      const { data: dg } = await supabase
        .from("doelgroepen")
        .select("id,titel")
        .order("titel", { ascending: true });

      setDoelgroepen((dg ?? []) as Doelgroep[]);
      if (dg && dg.length > 0) setDoelgroepId(dg[0].id);

      // Vrijwilligers laden
      const { data: vw } = await supabase
        .from("vrijwilligers")
        .select("id,naam")
        .order("naam", { ascending: true });

      setVrijwilligers((vw ?? []) as Vrijwilliger[]);

      setLoading(false);
    };

    init();
  }, []);

  const save = async () => {
    setError(null);

    const naamNorm = normalizeNaam(naam);
    if (!naamNorm) {
      setError("Naam is verplicht.");
      return;
    }

    setBusy(true);

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

    const newId = inserted?.id;

    if (returnTo && newId) {
      const target = appendQuery(returnTo, "klantId", newId);
      window.location.href = target;
      return;
    }

    window.location.href = "/admin/klanten";
  };

  if (loading) return <main className="p-10">Laden…</main>;
  if (!allowed) return <main className="p-10">Geen rechten.</main>;

  return (
    <main className="mx-auto max-w-3xl p-6 md:p-10">
      <h1 className="text-3xl font-semibold mb-4">Nieuwe klant</h1>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      <div className="space-y-4 border rounded-2xl p-4 bg-white/80 shadow-sm">

        <input className="w-full border rounded-xl p-3"
          placeholder="Naam (verplicht)"
          value={naam}
          onChange={(e) => setNaam(e.target.value)} />

        <input className="w-full border rounded-xl p-3"
          placeholder="Contactpersoon naam"
          value={contactpersoonNaam}
          onChange={(e) => setContactpersoonNaam(e.target.value)} />

        <input className="w-full border rounded-xl p-3"
          placeholder="Contactpersoon telefoon"
          value={contactpersoonTelefoon}
          onChange={(e) => setContactpersoonTelefoon(e.target.value)} />

        <textarea className="w-full border rounded-xl p-3"
          placeholder="Adres"
          value={adres}
          onChange={(e) => setAdres(e.target.value)} />

        <div>
          <label className="text-sm font-medium block mb-1">Doelgroep</label>
          <select className="w-full border rounded-xl p-3"
            value={doelgroepId}
            onChange={(e) => setDoelgroepId(e.target.value)}>
            {doelgroepen.map(dg => (
              <option key={dg.id} value={dg.id}>{dg.titel}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Aanspreekpunt (vrijwilliger)</label>
          <select className="w-full border rounded-xl p-3"
            value={aanspreekpuntId}
            onChange={(e) => setAanspreekpuntId(e.target.value)}>
            <option value="">— Geen —</option>
            {vrijwilligers.map(v => (
              <option key={v.id} value={v.id}>{v.naam ?? "(zonder naam)"}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <button className="border rounded-xl px-4 py-2" onClick={save} disabled={busy}>
            {busy ? "Bezig…" : "Opslaan"}
          </button>
          <Link className="border rounded-xl px-4 py-2" href="/admin/klanten">
            Annuleren
          </Link>
        </div>
      </div>
    </main>
  );
}