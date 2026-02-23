"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type Vrijwilliger = {
  id: string;
  user_id: string | null;
  naam: string | null;
  telefoon: string | null;
  adres: string | null;
};

type Interesse = {
  id: string;      // let op: kan uuid of bigint zijn; we behandelen als string
  naam: string;
};

export default function ProfielClient() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [vrijwilliger, setVrijwilliger] = useState<Vrijwilliger | null>(null);
  const [interesses, setInteresses] = useState<Interesse[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      setOk(null);

      const { data: authRes, error: authErr } = await supabase.auth.getUser();
      if (authErr) {
        setError(`Auth error: ${authErr.message}`);
        setLoading(false);
        return;
      }

      const user = authRes?.user;
      if (!user) {
        setError("Je bent niet ingelogd.");
        setLoading(false);
        return;
      }

      // 1) Mijn vrijwilliger-record (kan leeg zijn als nieuw account)
      const { data: vExisting, error: vErr } = await supabase
        .from("vrijwilligers")
        .select("id, user_id, naam, telefoon, adres")
        .eq("user_id", user.id)
        .maybeSingle();

      if (vErr) {
        setError(`Kon jouw profiel niet ophalen: ${vErr.message}`);
        setLoading(false);
        return;
      }

      let v = vExisting as Vrijwilliger | null;

      // 1b) Als geen record: maak er één (policy: vrijwilligers_insert_own)
      if (!v) {
        const { data: created, error: cErr } = await supabase
          .from("vrijwilligers")
          .insert({
            user_id: user.id,
            naam: user.user_metadata?.full_name ?? user.email ?? null,
            toestemming_privacy: false,
          })
          .select("id, user_id, naam, telefoon, adres")
          .single();

        if (cErr) {
          setError(`Kon profiel niet aanmaken: ${cErr.message}`);
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
        setError(`Kon interesses niet ophalen: ${iErr.message}`);
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
        setError(`Kon jouw interesses niet ophalen: ${mErr.message}`);
        setLoading(false);
        return;
      }

      setSelectedIds(new Set((mine ?? []).map((r: any) => String(r.interesse_id))));

      setLoading(false);
    })();
  }, [supabase]);

  function toggle(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    if (!vrijwilliger) return;

    setSaving(true);
    setError(null);
    setOk(null);

    // A) profiel opslaan (telefoon + adres)
    const { error: uErr } = await supabase
      .from("vrijwilligers")
      .update({
        naam: vrijwilliger.naam,
        telefoon: vrijwilliger.telefoon,
        adres: vrijwilliger.adres,
      })
      .eq("id", vrijwilliger.id);

    if (uErr) {
      setError(`Profiel opslaan faalde: ${uErr.message}`);
      setSaving(false);
      return;
    }

    // B) interesses opslaan: replace-all (delete + insert)
    const { error: dErr } = await supabase
      .from("vrijwilliger_interesses")
      .delete()
      .eq("vrijwilliger_id", vrijwilliger.id);

    if (dErr) {
      setError(`Interesses opslaan faalde (delete): ${dErr.message}`);
      setSaving(false);
      return;
    }

    const rows = Array.from(selectedIds).map(interesse_id => ({
      vrijwilliger_id: vrijwilliger.id,
      interesse_id, // als dit bigint is in DB, supabase cast meestal ok; anders: parseInt nodig
    }));

    if (rows.length > 0) {
      const { error: iErr } = await supabase
        .from("vrijwilliger_interesses")
        .insert(rows);

      if (iErr) {
        setError(`Interesses opslaan faalde (insert): ${iErr.message}`);
        setSaving(false);
        return;
      }
    }

    setOk("Opgeslagen.");
    setSaving(false);
  }

  if (loading) return <div className="p-6">Profiel laden…</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!vrijwilliger) return <div className="p-6">Geen profiel gevonden.</div>;

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Mijn profiel</h1>

      {ok && <div className="rounded-lg bg-green-50 p-3">{ok}</div>}

      <div className="space-y-3">
        <label className="block">
          <div className="text-sm font-medium">Naam</div>
          <input
            className="mt-1 w-full rounded border p-2"
            value={vrijwilliger.naam ?? ""}
            onChange={(e) => setVrijwilliger({ ...vrijwilliger, naam: e.target.value })}
          />
        </label>

        <label className="block">
          <div className="text-sm font-medium">Telefoon</div>
          <input
            className="mt-1 w-full rounded border p-2"
            value={vrijwilliger.telefoon ?? ""}
            onChange={(e) => setVrijwilliger({ ...vrijwilliger, telefoon: e.target.value })}
            placeholder="+32 …"
          />
        </label>

        <label className="block">
          <div className="text-sm font-medium">Adres</div>
          <textarea
            className="mt-1 w-full rounded border p-2"
            rows={3}
            value={vrijwilliger.adres ?? ""}
            onChange={(e) => setVrijwilliger({ ...vrijwilliger, adres: e.target.value })}
            placeholder="Straat + nr, postcode, gemeente"
          />
        </label>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Interesses</h2>
        <div className="rounded border p-3 space-y-2">
          {interesses.map((i) => (
            <label key={i.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedIds.has(String(i.id))}
                onChange={() => toggle(String(i.id))}
              />
              <span>{i.naam}</span>
            </label>
          ))}
          {interesses.length === 0 && (
            <div className="text-sm text-gray-500">Geen interesses gevonden.</div>
          )}
        </div>
      </div>

      <button
        className="rounded bg-black text-white px-4 py-2 disabled:opacity-50"
        disabled={saving}
        onClick={save}
      >
        {saving ? "Opslaan…" : "Opslaan"}
      </button>
    </div>
  );
}