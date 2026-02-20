"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Doelgroep = {
  id: string;
  titel: string;
  omschrijving: string | null;
};

type Klant = {
  id: string;
  naam: string;
  doelgroep_id: string | null;
  actief: boolean;
  gearchiveerd_op: string | null;
};

export default function KlantBewerkenPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  const klantId = params.id;

  const returnTo = useMemo(() => {
    const v = searchParams.get("returnTo");
    return v && v.startsWith("/") ? v : "/admin/klanten";
  }, [searchParams]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [doelgroepen, setDoelgroepen] = useState<Doelgroep[]>([]);
  const [klant, setKlant] = useState<Klant | null>(null);

  const [naam, setNaam] = useState("");
  const [doelgroepId, setDoelgroepId] = useState<string>("");

  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setError(null);
      setMsg(null);

      const { data: sess } = await supabase.auth.getSession();
      const user = sess.session?.user ?? null;

      if (!user) {
        router.push("/login");
        return;
      }

      // Klant ophalen
      const { data: k, error: e1 } = await supabase
        .from("klanten")
        .select("id,naam,doelgroep_id,actief,gearchiveerd_op")
        .eq("id", klantId)
        .maybeSingle();

      if (e1) {
        setError(e1.message);
        setLoading(false);
        return;
      }
      if (!k) {
        setError("Klant niet gevonden.");
        setLoading(false);
        return;
      }

      const klantRow = k as Klant;
      setKlant(klantRow);
      setNaam(klantRow.naam ?? "");
      setDoelgroepId(klantRow.doelgroep_id ?? "");

      // Doelgroepen ophalen (optioneel)
      const { data: dgs, error: e2 } = await supabase
        .from("doelgroepen")
        .select("id,titel,omschrijving")
        .order("titel", { ascending: true });

      if (!e2) {
        const list = (dgs ?? []) as Doelgroep[];
        setDoelgroepen(list);

        // als klant nog geen doelgroep heeft, zet default op 1e
        if (!klantRow.doelgroep_id && list.length > 0) {
          setDoelgroepId(list[0].id);
        }
      } else {
        setDoelgroepen([]);
      }

      setLoading(false);
    };

    init();
  }, [klantId, router]);

  const save = async () => {
    if (!klant) return;

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
      doelgroep_id: doelgroepId || null,
    };

    const { error } = await supabase.from("klanten").update(payload).eq("id", klant.id);

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

    setMsg("Klant bijgewerkt.");
    setBusy(false);

    // herlaad (simpel)
    const { data: k2 } = await supabase
      .from("klanten")
      .select("id,naam,doelgroep_id,actief,gearchiveerd_op")
      .eq("id", klant.id)
      .maybeSingle();

    if (k2) {
      const klantRow = k2 as Klant;
      setKlant(klantRow);
      setNaam(klantRow.naam ?? "");
      setDoelgroepId(klantRow.doelgroep_id ?? "");
    }
  };

  const archive = async () => {
    if (!klant) return;

    const ok = window.confirm(
      "Klant archiveren?\n\nDe klant blijft gekoppeld aan bestaande activiteiten, maar kan niet meer gekozen worden voor nieuwe activiteiten."
    );
    if (!ok) return;

    setBusy(true);
    setError(null);
    setMsg(null);

    const { error } = await supabase
      .from("klanten")
      .update({
        actief: false,
        gearchiveerd_op: new Date().toISOString(),
      })
      .eq("id", klant.id);

    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }

    setMsg("Klant gearchiveerd.");
    setBusy(false);
    router.push(returnTo);
  };

  if (loading) {
    return <main className="mx-auto max-w-xl p-6 md:p-10">Laden…</main>;
  }

  if (!klant) {
    return (
      <main className="mx-auto max-w-xl p-6 md:p-10">
        {error ? <p className="text-red-600">Fout: {error}</p> : <p>Klant niet gevonden.</p>}
        <button className="border rounded-xl px-3 py-2 text-sm mt-4" onClick={() => router.push(returnTo)}>
          Terug
        </button>
      </main>
    );
  }

  const isArchived = !!klant.gearchiveerd_op || klant.actief === false;

  const selectedOmschrijving =
    doelgroepen.find((d) => d.id === doelgroepId)?.omschrijving ?? "";

  return (
    <main className="mx-auto max-w-xl p-6 md:p-10">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Klant beheren</h1>
          {isArchived && (
            <p className="text-sm text-gray-600 mt-1">
              Status: <span className="font-medium">gearchiveerd</span>
            </p>
          )}
        </div>

        <button className="border rounded-xl px-3 py-2 text-sm" onClick={() => router.push(returnTo)} disabled={busy}>
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
            disabled={busy}
          />
        </div>

        {doelgroepen.length > 0 ? (
          <div>
            <label className="text-sm font-medium block mb-1">Doelgroep</label>
            <select
              className="w-full border rounded-xl p-3"
              value={doelgroepId}
              onChange={(e) => setDoelgroepId(e.target.value)}
              disabled={busy}
            >
              <option value="">(geen)</option>
              {doelgroepen.map((dg) => (
                <option key={dg.id} value={dg.id}>
                  {dg.titel}
                </option>
              ))}
            </select>

            {selectedOmschrijving ? (
              <p className="text-xs text-gray-600 mt-1">{selectedOmschrijving}</p>
            ) : null}
          </div>
        ) : (
          <div className="text-sm text-gray-600">
            (Geen doelgroepen geladen. Dit is ok als je dat later toevoegt.)
          </div>
        )}

        <div className="flex gap-2 flex-wrap pt-2">
          <button className="border rounded-xl px-4 py-2" onClick={save} disabled={busy}>
            {busy ? "Bezig…" : "Opslaan"}
          </button>

          <button className="border rounded-xl px-4 py-2" onClick={() => router.push(returnTo)} disabled={busy}>
            Annuleren
          </button>

          {!isArchived && (
            <button className="border rounded-xl px-4 py-2" onClick={archive} disabled={busy}>
              Archiveren
            </button>
          )}
        </div>
      </div>
    </main>
  );
}