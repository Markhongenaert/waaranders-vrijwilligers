"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin } from "@/lib/auth";

type Doelgroep = {
  id: string;
  titel: string;
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

export default function NieuweKlantPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const returnTo = safeReturnTo(sp.get("returnTo"));
  const backHref = returnTo || "/admin/klanten";

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const [doelgroepen, setDoelgroepen] = useState<Doelgroep[]>([]);

  const [naam, setNaam] = useState("");
  const [contactpersoonNaam, setContactpersoonNaam] = useState("");
  const [contactpersoonTelefoon, setContactpersoonTelefoon] = useState("");
  const [contactpersoonEmail, setContactpersoonEmail] = useState("");
  const [adres, setAdres] = useState("");
  const [doelgroepId, setDoelgroepId] = useState("");
  const [actief, setActief] = useState(true);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.user) {
        window.location.href = "/login";
        return;
      }

      const ok = await isDoenkerOrAdmin();
      setAllowed(ok);
      if (!ok) { setLoading(false); return; }

      const { data: dg } = await supabase
        .from("doelgroepen")
        .select("id,titel")
        .order("titel", { ascending: true });

      setDoelgroepen((dg ?? []) as Doelgroep[]);
      setLoading(false);
    };

    init();
  }, []);

  const save = async () => {
    setError(null);
    const naamNorm = normalizeNaam(naam);
    if (!naamNorm) { setError("Naam is verplicht."); return; }

    setBusy(true);

    const { data: klant, error: err } = await supabase
      .from("klanten")
      .insert({
        naam: naamNorm,
        contactpersoon_naam: contactpersoonNaam.trim() || null,
        contactpersoon_telefoon: contactpersoonTelefoon.trim() || null,
        contactpersoon_email: contactpersoonEmail.trim() || null,
        adres: adres.trim() || null,
        actief,
        gearchiveerd_op: null,
      })
      .select("id")
      .single();

    if (err) { setError(err.message); setBusy(false); return; }

    if (doelgroepId) {
      await supabase.from("klant_doelgroepen").upsert(
        { klant_id: klant.id, doelgroep_id: doelgroepId },
        { onConflict: "klant_id" }
      );
    }

    if (returnTo) {
      const u = new URL(returnTo, "http://dummy.local");
      u.searchParams.set("klant_id", klant.id);
      router.push(u.pathname + "?" + u.searchParams.toString());
    } else {
      router.push(`/admin/klanten/${klant.id}`);
    }
  };

  if (loading) return <main className="p-10">Laden…</main>;
  if (!allowed) return <main className="p-10">Geen rechten.</main>;

  return (
    <main className="mx-auto max-w-3xl p-6 md:p-10">
      <div className="flex items-start justify-between gap-4 mb-4">
        <h1 className="text-3xl font-semibold mb-1">Nieuwe klant</h1>
        <Link className="wa-btn wa-btn-ghost px-3 py-2 text-sm" href={backHref}>
          Terug
        </Link>
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      <div className="wa-card space-y-4 p-4">
        <div>
          <label className="text-sm font-medium block mb-1">Naam</label>
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
          <label className="text-sm font-medium block mb-1">E-mail contactpersoon</label>
          <input
            type="email"
            className="w-full border rounded-xl p-3"
            value={contactpersoonEmail}
            onChange={(e) => setContactpersoonEmail(e.target.value)}
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
              <option key={dg.id} value={dg.id}>{dg.titel}</option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={actief}
            onChange={(e) => setActief(e.target.checked)}
            disabled={busy}
          />
          <span>Actief (toonbaar in dropdown bij nieuwe activiteiten)</span>
        </label>

        <div className="flex gap-2">
          <button className="wa-btn wa-btn-ghost px-4 py-2" onClick={save} disabled={busy}>
            {busy ? "Bezig…" : "Opslaan"}
          </button>
          <Link className="wa-btn wa-btn-ghost px-4 py-2" href={backHref}>
            Annuleren
          </Link>
        </div>
      </div>
    </main>
  );
}
