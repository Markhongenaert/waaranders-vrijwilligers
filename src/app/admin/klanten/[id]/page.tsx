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

  const backHref = returnTo || "/admin/klanten";

  const load = async () => {
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

    // Klant laden
    const { data: row, error: e } = await supabase
      .from("klanten")
      .select("*")
      .eq("id", id)
      .single();

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
    const { data: dg } = await supabase
      .from("doelgroepen")
      .select("id,titel")
      .order("titel", { ascending: true });

    setDoelgroepen((dg ?? []) as Doelgroep[]);

    // Vrijwilligers laden
    const { data: vw } = await supabase
      .from("vrijwilligers")
      .select("id,naam")
      .order("naam", { ascending: true });

    setVrijwilligers((vw ?? []) as Vrijwilliger[]);

    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const checkUniqNaam = async (naamNorm: string): Promise<boolean> => {
    const { data } = await supabase.from("klanten").select("id,naam");
    const rows = (data ?? []) as { id: string; naam: string }[];

    const hit = rows.find(
      (r) =>
        r.id !== id &&
        normalizeNaam(r.naam).toLowerCase() === naamNorm.toLowerCase()
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

    const { error } = await supabase
      .from("klanten")
      .update(payload)
      .eq("id", id);

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
      "Klant archiveren? Hij blijft gekoppeld aan bestaande activiteiten."
    );
    if (!ok) return;

    setBusy(true);

    const { error } = await supabase
      .from("klanten")
      .update({
        actief: false,
        gearchiveerd_op: new Date().toISOString(),
      })
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

  if (loading) return <main className="p-10">Laden…</main>;
  if (!allowed) return <main className="p-10">Geen rechten.</main>;
  if (!orig) return <main className="p-10">Klant niet gevonden.</main>;

  const archived = !orig.actief || !!orig.gearchiveerd_op;

  return (
    <main className="mx-auto max-w-3xl p-6 md:p-10">
      <h1 className="text-3xl font-semibold mb-4">Klant bewerken</h1>

      {error && <p className="text-red-600 mb-4">{error}</p>}
      {msg && <p className="text-green-700 mb-4">{msg}</p>}

      <div className="space-y-4 border rounded-2xl p-4 bg-white/80 shadow-sm">

        <input className="w-full border rounded-xl p-3"
          value={naam}
          onChange={(e) => setNaam(e.target.value)}
          disabled={busy} />

        <input className="w-full border rounded-xl p-3"
          placeholder="Contactpersoon naam"
          value={contactpersoonNaam}
          onChange={(e) => setContactpersoonNaam(e.target.value)}
          disabled={busy} />

        <input className="w-full border rounded-xl p-3"
          placeholder="Contactpersoon telefoon"
          value={contactpersoonTelefoon}
          onChange={(e) => setContactpersoonTelefoon(e.target.value)}
          disabled={busy} />

        <textarea className="w-full border rounded-xl p-3"
          placeholder="Adres"
          value={adres}
          onChange={(e) => setAdres(e.target.value)}
          disabled={busy} />

        <div>
          <label className="text-sm font-medium block mb-1">Doelgroep</label>
          <select className="w-full border rounded-xl p-3"
            value={doelgroepId}
            onChange={(e) => setDoelgroepId(e.target.value)}
            disabled={busy}>
            <option value="">— Geen —</option>
            {doelgroepen.map(dg => (
              <option key={dg.id} value={dg.id}>{dg.titel}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Aanspreekpunt</label>
          <select className="w-full border rounded-xl p-3"
            value={aanspreekpuntId}
            onChange={(e) => setAanspreekpuntId(e.target.value)}
            disabled={busy}>
            <option value="">— Geen —</option>
            {vrijwilligers.map(v => (
              <option key={v.id} value={v.id}>{v.naam ?? "(zonder naam)"}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <button className="border rounded-xl px-4 py-2"
            onClick={save}
            disabled={busy || archived}>
            {busy ? "Bezig…" : "Opslaan"}
          </button>

          {!archived && (
            <button className="border rounded-xl px-4 py-2"
              onClick={archive}
              disabled={busy}>
              Archiveren
            </button>
          )}

          <Link className="border rounded-xl px-4 py-2" href={backHref}>
            Terug
          </Link>
        </div>
      </div>
    </main>
  );
}