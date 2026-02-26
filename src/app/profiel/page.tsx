"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Vrijwilliger = {
  id: string; // = auth user id (jullie keuze)
  user_id: string | null;
  naam: string | null; // afgeleid in DB via trigger (bv. "Voornaam A.")
  voornaam: string | null;
  achternaam: string | null;
  telefoon: string | null;
  adres: string | null;
};

type Interesse = {
  id: string;
  titel: string;
  omschrijving: string | null;
};

function trimOrNull(s: string | null | undefined): string | null {
  const t = (s ?? "").trim();
  return t.length ? t : null;
}

export default function ProfielPage() {
  const [loading, setLoading] = useState(true);
  const [vrijwilliger, setVrijwilliger] = useState<Vrijwilliger | null>(null);

  const [interesses, setInteresses] = useState<Interesse[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selectedCount = useMemo(() => selectedIds.size, [selectedIds]);

  const isValid = useMemo(() => {
    const vn = (vrijwilliger?.voornaam ?? "").trim();
    const an = (vrijwilliger?.achternaam ?? "").trim();
    return vn.length >= 2 && an.length >= 2;
  }, [vrijwilliger?.voornaam, vrijwilliger?.achternaam]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErr(null);
      setMsg(null);

      const { data: sessionRes, error: sessErr } = await supabase.auth.getSession();
      if (sessErr) {
        setErr(sessErr.message);
        setLoading(false);
        return;
      }

      const user = sessionRes.session?.user;
      if (!user) {
        window.location.href = "/login";
        return;
      }

      // 1) Vrijwilliger ophalen via id = auth uid
      const { data: vExisting, error: vErr } = await supabase
        .from("vrijwilligers")
        .select("id, user_id, naam, voornaam, achternaam, telefoon, adres")
        .eq("id", user.id)
        .maybeSingle();

      if (vErr) {
        setErr(vErr.message);
        setLoading(false);
        return;
      }

      let v = vExisting as Vrijwilliger | null;

      // 1b) Indien nog geen rij: maak er één aan met id=user.id
      if (!v) {
        const guessed =
          (user.user_metadata as any)?.full_name ??
          (user.email ? user.email.split("@")[0] : null);

        const { data: created, error: cErr } = await supabase
          .from("vrijwilligers")
          .insert({
            id: user.id,
            user_id: user.id,
            voornaam: guessed,
            achternaam: "Onbekend",
            telefoon: null,
            adres: null,
            toestemming_privacy: false,
          })
          .select("id, user_id, naam, voornaam, achternaam, telefoon, adres")
          .single();

        if (cErr) {
          setErr(cErr.message);
          setLoading(false);
          return;
        }
        v = created as Vrijwilliger;
      }

      setVrijwilliger(v);

      // 2) Interesses lijst
      const { data: ints, error: iErr } = await supabase
        .from("interesses")
        .select("id, titel, omschrijving")
        .order("titel", { ascending: true });

      if (iErr) {
        setErr(iErr.message);
        setLoading(false);
        return;
      }
      setInteresses((ints ?? []) as Interesse[]);

      // 3) Mijn geselecteerde interesses
      const { data: mine, error: mErr } = await supabase
        .from("vrijwilliger_interesses")
        .select("interesse_id")
        .eq("vrijwilliger_id", user.id);

      if (mErr) {
        setErr(mErr.message);
        setLoading(false);
        return;
      }

      setSelectedIds(new Set((mine ?? []).map((r: any) => String(r.interesse_id))));
      setLoading(false);
    };

    load();
  }, []);

  function toggleInteresse(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const save = async () => {
    setErr(null);
    setMsg(null);

    if (!vrijwilliger) {
      setErr("Geen profiel geladen.");
      return;
    }

    const { data: sessionRes } = await supabase.auth.getSession();
    const user = sessionRes.session?.user;
    if (!user) {
      window.location.href = "/login";
      return;
    }

    const vn = (vrijwilliger.voornaam ?? "").trim();
    const an = (vrijwilliger.achternaam ?? "").trim();

    if (vn.length < 2) {
      setErr("Voornaam is verplicht (minstens 2 tekens).");
      return;
    }
    if (an.length < 2) {
      setErr("Achternaam is verplicht (minstens 2 tekens).");
      return;
    }

    setBusy(true);

    // A) Update profiel (naam wordt door trigger afgeleid)
    const { error: uErr } = await supabase
      .from("vrijwilligers")
      .update({
        voornaam: vn,
        achternaam: an,
        telefoon: trimOrNull(vrijwilliger.telefoon),
        adres: trimOrNull(vrijwilliger.adres),
      })
      .eq("id", user.id);

    if (uErr) {
      setErr(uErr.message);
      setBusy(false);
      return;
    }

    /**
     * B) Interesses opslaan: diff i.p.v. delete-all
     * - werkt beter met RLS (insert/delete own)
     * - minder kans op “halfweg mislukt → alles weg”
     */
    const current = new Set(selectedIds);

    // haal huidige selectie opnieuw op (bron van waarheid)
    const { data: mine2, error: m2Err } = await supabase
      .from("vrijwilliger_interesses")
      .select("interesse_id")
      .eq("vrijwilliger_id", user.id);

    if (m2Err) {
      setErr(m2Err.message);
      setBusy(false);
      return;
    }

    const existing = new Set((mine2 ?? []).map((r: any) => String(r.interesse_id)));

    const toInsert = Array.from(current).filter((id) => !existing.has(id));
    const toDelete = Array.from(existing).filter((id) => !current.has(id));

    if (toDelete.length > 0) {
      // delete per id (RLS-friendly)
      for (const interesse_id of toDelete) {
        const { error: dErr } = await supabase
          .from("vrijwilliger_interesses")
          .delete()
          .eq("vrijwilliger_id", user.id)
          .eq("interesse_id", interesse_id);

        if (dErr) {
          setErr(dErr.message);
          setBusy(false);
          return;
        }
      }
    }

    if (toInsert.length > 0) {
      const rows = toInsert.map((interesse_id) => ({
        vrijwilliger_id: user.id,
        interesse_id,
      }));

      const { error: insErr } = await supabase.from("vrijwilliger_interesses").insert(rows);
      if (insErr) {
        setErr(insErr.message);
        setBusy(false);
        return;
      }
    }

    setMsg("Opgeslagen.");
    setBusy(false);
    window.location.href = "/activiteiten";
  };

  if (loading) return <main className="p-8">Laden…</main>;

  const previewNaam = (() => {
    const vn = (vrijwilliger?.voornaam ?? "").trim();
    const an = (vrijwilliger?.achternaam ?? "").trim();
    if (!vn) return "…";
    if (!an) return vn;
    return `${vn} ${an.slice(0, 1).toUpperCase()}.`;
  })();

  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-6 md:p-10">
      <div className="rounded-2xl p-5 mb-6 bg-blue-600 text-white shadow-sm">
        <div className="text-xl font-semibold">Jouw profiel</div>
        <div className="text-sm opacity-95 mt-1">
          Vul minstens je voornaam en achternaam in. Daarna kan je naar de activiteiten.
        </div>
      </div>

      <div className="border rounded-2xl p-5 bg-white shadow-sm space-y-5">
        {err && (
          <p className="text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">
            Fout: {err}
          </p>
        )}
        {msg && (
          <p className="text-blue-800 bg-blue-50 border border-blue-100 rounded-xl p-3">
            {msg}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-medium mb-1">
              Voornaam <span className="text-red-600">*</span>
            </label>
            <input
              className="w-full border rounded-xl p-3 bg-white"
              value={vrijwilliger?.voornaam ?? ""}
              onChange={(e) =>
                setVrijwilliger((v) => (v ? { ...v, voornaam: e.target.value } : v))
              }
              placeholder="bv. Mark"
              autoComplete="given-name"
            />
          </div>

          <div>
            <label className="block font-medium mb-1">
              Achternaam <span className="text-red-600">*</span>
            </label>
            <input
              className="w-full border rounded-xl p-3 bg-white"
              value={vrijwilliger?.achternaam ?? ""}
              onChange={(e) =>
                setVrijwilliger((v) => (v ? { ...v, achternaam: e.target.value } : v))
              }
              placeholder="bv. Hongenaert"
              autoComplete="family-name"
            />
          </div>
        </div>

        <p className="text-sm text-gray-600">
          We tonen je in de app als:{" "}
          <span className="font-medium text-gray-900">{previewNaam}</span>
        </p>

        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="block font-medium mb-1">Telefoon</label>
            <input
              className="w-full border rounded-xl p-3 bg-white"
              value={vrijwilliger?.telefoon ?? ""}
              onChange={(e) =>
                setVrijwilliger((v) => (v ? { ...v, telefoon: e.target.value } : v))
              }
              placeholder="+32 …"
              autoComplete="tel"
              inputMode="tel"
            />
          </div>

          <div>
            <label className="block font-medium mb-1">Adres</label>
            <textarea
              className="w-full border rounded-xl p-3 bg-white min-h-[96px]"
              value={vrijwilliger?.adres ?? ""}
              onChange={(e) =>
                setVrijwilliger((v) => (v ? { ...v, adres: e.target.value } : v))
              }
              placeholder="Straat + nr, postcode, gemeente"
              autoComplete="street-address"
            />
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-2">
            <label className="block font-medium">Interesses</label>
            <span className="text-sm text-gray-600">{selectedCount} geselecteerd</span>
          </div>

          <div className="border rounded-xl p-4 space-y-3">
            {interesses.map((i) => {
              const id = String(i.id);
              return (
                <label key={id} className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selectedIds.has(id)}
                    onChange={() => toggleInteresse(id)}
                    disabled={busy}
                  />
                  <div>
                    <div className="font-medium">{i.titel}</div>
                    {i.omschrijving && <div className="text-sm text-gray-600">{i.omschrijving}</div>}
                  </div>
                </label>
              );
            })}

            {interesses.length === 0 && (
              <p className="text-sm text-gray-600">Geen interesses gevonden.</p>
            )}
          </div>
        </div>

        <button
          className="rounded-xl px-5 py-3 font-medium w-full bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-60"
          onClick={save}
          disabled={busy || !isValid}
          title={!isValid ? "Vul voornaam en achternaam in" : ""}
        >
          {busy ? "Bezig…" : "Opslaan en verder"}
        </button>

        {!isValid && (
          <p className="text-sm text-gray-600">
            <span className="text-red-600">*</span> Voornaam en achternaam zijn verplicht (min. 2 tekens).
          </p>
        )}
      </div>
    </main>
  );
}