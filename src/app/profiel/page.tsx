"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Vrijwilliger = {
  id: string;
  user_id: string | null;
  naam: string | null;
  telefoon: string | null;
  adres: string | null;
};

type Interesse = {
  id: string; // uuid of bigint -> behandelen als string
  naam: string;
};

export default function ProfielPage() {
  const [loading, setLoading] = useState(true);

  const [vrijwilliger, setVrijwilliger] = useState<Vrijwilliger | null>(null);

  const [interesses, setInteresses] = useState<Interesse[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selectedCount = useMemo(() => selectedIds.size, [selectedIds]);

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

      // 1) Vrijwilliger ophalen via user_id (niet via id!)
      const { data: vExisting, error: vErr } = await supabase
        .from("vrijwilligers")
        .select("id, user_id, naam, telefoon, adres")
        .eq("user_id", user.id)
        .maybeSingle();

      if (vErr) {
        setErr(vErr.message);
        setLoading(false);
        return;
      }

      let v = vExisting as Vrijwilliger | null;

      // 1b) Indien nog geen rij: maak er één aan (policy: vrijwilligers_insert_own)
      if (!v) {
        const { data: created, error: cErr } = await supabase
          .from("vrijwilligers")
          .insert({
            user_id: user.id,
            naam: (user.user_metadata as any)?.full_name ?? user.email ?? null,
            toestemming_privacy: false,
          })
          .select("id, user_id, naam, telefoon, adres")
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
        .select("id, naam")
        .order("naam", { ascending: true });

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
        .eq("vrijwilliger_id", v.id);

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

    const n = (vrijwilliger.naam ?? "").trim();
    if (n.length < 2) {
      setErr("Kies een naam van minstens 2 tekens.");
      return;
    }

    setBusy(true);

    // A) Update profiel (naam, telefoon, adres)
    const { error: uErr } = await supabase
      .from("vrijwilligers")
      .update({
        naam: n,
        telefoon: vrijwilliger.telefoon,
        adres: vrijwilliger.adres,
      })
      .eq("id", vrijwilliger.id);

    if (uErr) {
      setErr(uErr.message);
      setBusy(false);
      return;
    }

    // B) Interesses opslaan: replace-all (delete + insert)
    const { error: dErr } = await supabase
      .from("vrijwilliger_interesses")
      .delete()
      .eq("vrijwilliger_id", vrijwilliger.id);

    if (dErr) {
      setErr(dErr.message);
      setBusy(false);
      return;
    }

    const rows = Array.from(selectedIds).map((interesse_id) => ({
      vrijwilliger_id: vrijwilliger.id,
      interesse_id, // werkt voor uuid; voor bigint meestal ook (Supabase cast). Zoniet: Number(interesse_id)
    }));

    if (rows.length > 0) {
      const { error: insErr } = await supabase
        .from("vrijwilliger_interesses")
        .insert(rows);

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

  return (
    <main className="p-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">Jouw profiel</h1>

      <div className="mb-6">
        <label className="block font-medium mb-2">Hoe mogen we je noemen?</label>
        <input
          className="w-full border rounded-xl p-3"
          value={vrijwilliger?.naam ?? ""}
          onChange={(e) =>
            setVrijwilliger((v) => (v ? { ...v, naam: e.target.value } : v))
          }
          placeholder="bv. Mark"
        />
      </div>

      <div className="mb-6">
        <label className="block font-medium mb-2">Telefoon</label>
        <input
          className="w-full border rounded-xl p-3"
          value={vrijwilliger?.telefoon ?? ""}
          onChange={(e) =>
            setVrijwilliger((v) => (v ? { ...v, telefoon: e.target.value } : v))
          }
          placeholder="+32 …"
        />
      </div>

      <div className="mb-6">
        <label className="block font-medium mb-2">Adres</label>
        <textarea
          className="w-full border rounded-xl p-3"
          rows={3}
          value={vrijwilliger?.adres ?? ""}
          onChange={(e) =>
            setVrijwilliger((v) => (v ? { ...v, adres: e.target.value } : v))
          }
          placeholder="Straat + nr, postcode, gemeente"
        />
      </div>

      <div className="mb-6">
        <div className="flex items-baseline justify-between mb-2">
          <label className="block font-medium">Interesses</label>
          <span className="text-sm opacity-70">{selectedCount} geselecteerd</span>
        </div>

        <div className="border rounded-xl p-4 space-y-2">
          {interesses.map((i) => {
            const id = String(i.id);
            return (
              <label key={id} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedIds.has(id)}
                  onChange={() => toggleInteresse(id)}
                />
                <span>{i.naam}</span>
              </label>
            );
          })}

          {interesses.length === 0 && (
            <p className="text-sm opacity-70">Geen interesses gevonden.</p>
          )}
        </div>
      </div>

      <button
        className="border rounded-xl px-5 py-3 font-medium"
        onClick={save}
        disabled={busy}
      >
        {busy ? "Bezig…" : "Opslaan"}
      </button>

      {msg && <p className="mt-4 text-green-700">{msg}</p>}
      {err && <p className="mt-4 text-red-600">Fout: {err}</p>}
    </main>
  );
}