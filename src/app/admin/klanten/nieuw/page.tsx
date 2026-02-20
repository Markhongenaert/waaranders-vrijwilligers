"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Doelgroep = {
  id: string;
  titel: string;
  omschrijving: string | null;
};

export default function NieuweKlantPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const returnTo = useMemo(() => {
    const v = searchParams.get("returnTo");
    return v && v.startsWith("/") ? v : "/admin/klanten";
  }, [searchParams]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [doelgroepen, setDoelgroepen] = useState<Doelgroep[]>([]);
  const [naam, setNaam] = useState("");
  const [doelgroepId, setDoelgroepId] = useState<string>("");

  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setError(null);

      const { data: sess } = await supabase.auth.getSession();
      const user = sess.session?.user ?? null;

      if (!user) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("doelgroepen")
        .select("id,titel,omschrijving")
        .order("titel", { ascending: true });

      if (error) {
        // Als doelgroepen nog niet (goed) beschikbaar zijn via RLS,
        // laten we de pagina werken zonder dropdown.
        setDoelgroepen([]);
      } else {
        const dgs = (data ?? []) as Doelgroep[];
        setDoelgroepen(dgs);
        if (dgs.length > 0) setDoelgroepId(dgs[0].id);
      }

      setLoading(false);
    };

    init();
  }, [router]);

  const save = async () => {
    setError(null);
    setMsg(null);

    const cleanNaam = naam.trim();
    if (!cleanNaam) {
      setError("Naam is verplicht.");
      return;
    }

    setBusy(true);

    const payload: any = {
      naam: cleanNaam,
      actief: true,
    };
    if (doelgroepId) payload.doelgroep_id = doelgroepId;

    const { error } = await supabase.from("klanten").insert(payload);

    if (error) {
      if (error.code === "23505") {
        setError("Er bestaat al een klant met deze naam.");
      } else if (error.code === "23514") {
        setError("Controleer de klantnaam (geen lege naam, geen spaties voor/achter).");
      } else {
        setError(error.message);
      }
      setBusy(false);
      return;
    }

    setMsg("Klant opgeslagen.");
    setBusy(false);
    router.push(returnTo);
  };

  if (loading) {
    return <main className="mx-auto max-w-xl p-6 md:p-10">Laden…</main>;
  }

  return (
    <main className="mx-auto max-w-xl p-6 md:p-10">
      <div className="flex items-start justify-between gap-3 mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Nieuwe klant</h1>
        <button
          className="border rounded-xl px-3 py-2 text-sm"
          onClick={() => router.push(returnTo)}
          disabled={busy}
        >
          Terug
        </button>
      </div>

      {error && <p className="text-red-600 mb-4">Fout: {error}</p>}
      {msg && <p className="text-green-700 mb-4">{msg}</p>}

      <div className="space-y-4 border rounded-2xl p-4 bg-white/80 shadow-sm">
        <div>
          <label className="text-sm font-medium block mb-1">Naam (uniek)</label>
          <input
            className="w-full border rounded-xl p-3"
            value={naam}
            onChange={(e) => setNaam(e.target.value)}
            placeholder="bv. De Rode Draad"
            autoComplete="off"
          />
          <p className="text-xs text-gray-600 mt-1">
            Hoofdletters en spaties tellen niet mee (Acme = ACME = &quot; Acme &quot;).
          </p>
        </div>

        {doelgroepen.length > 0 ? (
          <div>
            <label className="text-sm font-medium block mb-1">Doelgroep</label>
            <select
              className="w-full border rounded-xl p-3"
              value={doelgroepId}
              onChange={(e) => setDoelgroepId(e.target.value)}
            >
              {doelgroepen.map((dg) => (
                <option key={dg.id} value={dg.id}>
                  {dg.titel}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-600 mt-1">
              {doelgroepen.find((d) => d.id === doelgroepId)?.omschrijving ?? ""}
            </p>
          </div>
        ) : (
          <div className="text-sm text-gray-600">
            (Geen doelgroepen geladen. Dit kan door RLS/permissions komen. De klant kan wel aangemaakt worden zonder
            doelgroep.)
          </div>
        )}

        <div className="flex gap-2 flex-wrap pt-2">
          <button className="border rounded-xl px-4 py-2" onClick={save} disabled={busy}>
            {busy ? "Bezig…" : "Opslaan"}
          </button>
          <button
            className="border rounded-xl px-4 py-2"
            onClick={() => router.push(returnTo)}
            disabled={busy}
          >
            Annuleren
          </button>
        </div>
      </div>
    </main>
  );
}