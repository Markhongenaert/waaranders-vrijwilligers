"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Vrijwilliger = {
  id: string;
  user_id: string | null;
  naam: string | null;
  voornaam: string | null;
  achternaam: string | null;
  telefoon: string | null;
  adres: string | null;
  profiel_afgewerkt?: boolean | null;
};

type Werkgroep = {
  id: string;
  titel: string;
  opdracht: string | null;
};

function trimOrNull(s: string | null | undefined): string | null {
  const t = (s ?? "").trim();
  return t.length ? t : null;
}

export default function ProfielPage() {
  const [loading, setLoading] = useState(true);
  const [vrijwilliger, setVrijwilliger] = useState<Vrijwilliger | null>(null);

  const [werkgroepen, setWerkgroepen] = useState<Werkgroep[]>([]);
  const [selectedWerkgroepIds, setSelectedWerkgroepIds] = useState<Set<string>>(new Set());

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [opdrachtPopup, setOpdrachtPopup] = useState<string | null>(null);

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
        .select("id, user_id, naam, voornaam, achternaam, telefoon, adres, profiel_afgewerkt")
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
            profiel_afgewerkt: false,
          })
          .select("id, user_id, naam, voornaam, achternaam, telefoon, adres, profiel_afgewerkt")
          .single();

        if (cErr) {
          setErr(cErr.message);
          setLoading(false);
          return;
        }
        v = created as Vrijwilliger;
      }

      setVrijwilliger(v);

      // 2) Werkgroepen lijst
      const { data: wgs, error: wErr } = await supabase
        .from("werkgroepen")
        .select("id, titel, opdracht")
        .order("titel", { ascending: true });

      if (wErr) {
        setErr(wErr.message);
        setLoading(false);
        return;
      }
      setWerkgroepen((wgs ?? []) as Werkgroep[]);

      // 3) Mijn werkgroepen
      const { data: mine, error: mErr } = await supabase
        .from("werkgroep_deelnemers")
        .select("werkgroep_id")
        .eq("vrijwilliger_id", user.id);

      if (mErr) {
        setErr(mErr.message);
        setLoading(false);
        return;
      }

      setSelectedWerkgroepIds(new Set((mine ?? []).map((r: any) => String(r.werkgroep_id))));
      setLoading(false);
    };

    load();
  }, []);

  async function toggleWerkgroep(id: string) {
    const { data: sessionRes } = await supabase.auth.getSession();
    const user = sessionRes.session?.user;
    if (!user) return;

    if (selectedWerkgroepIds.has(id)) {
      const { error } = await supabase
        .from("werkgroep_deelnemers")
        .delete()
        .eq("vrijwilliger_id", user.id)
        .eq("werkgroep_id", id);
      if (error) { setErr(error.message); return; }
      setSelectedWerkgroepIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } else {
      const { error } = await supabase
        .from("werkgroep_deelnemers")
        .insert({ vrijwilliger_id: user.id, werkgroep_id: id });
      if (error) { setErr(error.message); return; }
      setSelectedWerkgroepIds((prev) => new Set([...prev, id]));
    }
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

    const { error: uErr } = await supabase
      .from("vrijwilligers")
      .update({
        voornaam: vn,
        achternaam: an,
        telefoon: trimOrNull(vrijwilliger.telefoon),
        adres: trimOrNull(vrijwilliger.adres),
        profiel_afgewerkt: true,
      })
      .eq("id", user.id);

    if (uErr) {
      setErr(uErr.message);
      setBusy(false);
      return;
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
      <div className="rounded-2xl p-3 mb-4 bg-Sky-600 text-white shadow-sm">
        <div className="text-xl font-semibold">Jouw profiel</div>
      </div>

      <div className="wa-card p-5 space-y-5">
        {err && (
          <div className="wa-alert-error">
            <span className="font-semibold">Fout:</span> {err}
          </div>
        )}

        {msg && <div className="wa-alert-success">{msg}</div>}

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
          <label className="block font-medium mb-2">Werkgroepen</label>

          <div className="space-y-3">
            {werkgroepen.map((w) => {
              const id = String(w.id);
              const lid = selectedWerkgroepIds.has(id);
              return (
                <div
                  key={id}
                  className={lid ? "wa-werkgroep-lid" : "wa-werkgroep-geen-lid"}
                >
                  {lid ? (
                    <>
                      <div className="text-sm font-bold text-green-700 mb-1">Ik ben lid van</div>
                      <div className="font-semibold text-gray-900 w-full mb-3">{w.titel}</div>
                      <button
                        type="button"
                        onClick={() => toggleWerkgroep(id)}
                        disabled={busy}
                        className="border border-gray-300 rounded-xl px-4 py-1.5 text-sm bg-white hover:shadow-sm transition disabled:opacity-60"
                      >
                        Uitschrijven
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="font-semibold text-gray-900 w-full mb-2">{w.titel}</div>
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          {w.opdracht && (
                            <button
                              type="button"
                              onClick={() => setOpdrachtPopup(w.opdracht)}
                              className="border border-gray-300 rounded-xl px-3 py-1.5 text-sm bg-white hover:shadow-sm transition"
                            >
                              Toelichting
                            </button>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleWerkgroep(id)}
                          disabled={busy}
                          className="wa-btn-enroll px-4 py-1.5 text-sm"
                        >
                          Inschrijven
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}

            {werkgroepen.length === 0 && (
              <p className="text-sm text-gray-600">Geen werkgroepen gevonden.</p>
            )}
          </div>
        </div>

        {/* Opdracht popup */}
        {opdrachtPopup && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setOpdrachtPopup(null)}
          >
            <div
              className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-gray-800 leading-relaxed">{opdrachtPopup}</p>
              <button
                type="button"
                onClick={() => setOpdrachtPopup(null)}
                className="wa-btn wa-btn-brand w-full py-2 font-medium"
              >
                Sluiten
              </button>
            </div>
          </div>
        )}

        <button
          className="wa-btn wa-btn-brand w-full px-5 py-3 font-medium"
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
