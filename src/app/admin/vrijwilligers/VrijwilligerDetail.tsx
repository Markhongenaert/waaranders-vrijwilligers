"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Props = {
  vrijwilliger: {
    id: string;
    voornaam: string | null;
    achternaam: string | null;
    telefoon: string | null;
    adres: string | null;

    vrijwilliger_interesses:
      | { interesses: { titel: string | null } | { titel: string | null }[] | null }
      | { interesses: { titel: string | null } | { titel: string | null }[] | null }[]
      | null;

    vrijwilliger_roles:
      | {
          roles: { titel: string | null } | { titel: string | null }[] | null;
          rollen?: { titel: string | null } | { titel: string | null }[] | null;
        }
      | {
          roles: { titel: string | null } | { titel: string | null }[] | null;
          rollen?: { titel: string | null } | { titel: string | null }[] | null;
        }[]
      | null;
  };
  onSaved: (patch: { telefoon: string | null; adres: string | null }) => void;
};

function toList<T>(x: T | T[] | null | undefined): T[] {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

export default function VrijwilligerDetail({ vrijwilliger, onSaved }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [telefoon, setTelefoon] = useState(vrijwilliger.telefoon ?? "");
  const [adres, setAdres] = useState(vrijwilliger.adres ?? "");

  // als je van vrijwilliger wisselt, moeten inputs mee wisselen
  // (simpel gehouden zonder useEffect: key op root div)
  const interests = useMemo(() => {
    const vi = toList(vrijwilliger.vrijwilliger_interesses as any);
    const titles = vi
      .flatMap((row: any) => toList(row?.interesses))
      .map((i: any) => (i?.titel ?? "").trim())
      .filter(Boolean);
    return Array.from(new Set(titles)).sort((a, b) => a.localeCompare(b));
  }, [vrijwilliger.vrijwilliger_interesses]);

  const roles = useMemo(() => {
    const vr = toList(vrijwilliger.vrijwilliger_roles as any);
    // ondersteunt zowel roles(titel) als rollen(titel)
    const titles = vr
      .flatMap((row: any) => {
        const a = toList(row?.roles);
        const b = toList(row?.rollen);
        return [...a, ...b];
      })
      .map((r: any) => (r?.titel ?? "").trim())
      .filter(Boolean);
    return Array.from(new Set(titles)).sort((a, b) => a.localeCompare(b));
  }, [vrijwilliger.vrijwilliger_roles]);

  const save = async () => {
    setErr(null);
    setBusy(true);

    try {
      const payload = {
        telefoon: telefoon.trim() || null,
        adres: adres.trim() || null,
      };

      const { error } = await supabase
        .from("vrijwilligers")
        .update(payload)
        .eq("id", vrijwilliger.id);

      if (error) throw error;

      onSaved(payload);
    } catch (e: any) {
      setErr(e?.message ?? "Onbekende fout bij opslaan.");
    } finally {
      setBusy(false);
    }
  };

  const naam = [vrijwilliger.voornaam ?? "", vrijwilliger.achternaam ?? ""]
    .join(" ")
    .trim();

  return (
    <div key={vrijwilliger.id} className="rounded-xl border p-4 space-y-4">
      <div>
        <div className="text-sm text-gray-600">Vrijwilliger</div>
        <div className="text-lg font-semibold">{naam || "—"}</div>
      </div>

      {err && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-red-700">
          {err}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block font-medium mb-1">Telefoon</label>
          <input
            className="w-full border rounded-xl p-3"
            value={telefoon}
            onChange={(e) => setTelefoon(e.target.value)}
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Adres</label>
          <input
            className="w-full border rounded-xl p-3"
            value={adres}
            onChange={(e) => setAdres(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl border p-3">
          <div className="font-medium mb-2">Interesses</div>
          {interests.length ? (
            <ul className="list-disc pl-5 space-y-1">
              {interests.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-gray-600">Geen interesses aangevinkt.</div>
          )}
        </div>

        <div className="rounded-xl border p-3">
          <div className="font-medium mb-2">Rol(len)</div>
          {roles.length ? (
            <ul className="list-disc pl-5 space-y-1">
              {roles.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-gray-600">Geen rol gevonden.</div>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          className="border rounded-xl px-5 py-3 font-medium"
          onClick={save}
          disabled={busy}
        >
          {busy ? "Bezig…" : "Opslaan"}
        </button>
        <a className="border rounded-xl px-5 py-3 font-medium" href="/admin">
          Annuleren
        </a>
      </div>
    </div>
  );
}