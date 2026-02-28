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
      | { roles: { titel: string | null } | { titel: string | null }[] | null }
      | { roles: { titel: string | null } | { titel: string | null }[] | null }[]
      | null;
  };
  onSaved: (patch: { telefoon: string | null; adres: string | null }) => void;
  returnHref?: string;
};

function toList<T>(x: T | T[] | null | undefined): T[] {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

function uniqSorted(list: string[]) {
  return Array.from(new Set(list)).sort((a, b) => a.localeCompare(b));
}

export default function VrijwilligerDetail({ vrijwilliger, onSaved, returnHref }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // local editable fields
  const [telefoon, setTelefoon] = useState(vrijwilliger.telefoon ?? "");
  const [adres, setAdres] = useState(vrijwilliger.adres ?? "");

  const naam = useMemo(() => {
    return [vrijwilliger.voornaam ?? "", vrijwilliger.achternaam ?? ""].join(" ").trim() || "—";
  }, [vrijwilliger.voornaam, vrijwilliger.achternaam]);

  const interests = useMemo(() => {
    const vi = toList(vrijwilliger.vrijwilliger_interesses as any);
    const titles = vi
      .flatMap((row: any) => toList(row?.interesses))
      .map((i: any) => (i?.titel ?? "").trim())
      .filter(Boolean);
    return uniqSorted(titles);
  }, [vrijwilliger.vrijwilliger_interesses]);

  const roles = useMemo(() => {
    const vr = toList(vrijwilliger.vrijwilliger_roles as any);
    const titles = vr
      .flatMap((row: any) => toList(row?.roles))
      .map((r: any) => (r?.titel ?? "").trim())
      .filter(Boolean);
    return uniqSorted(titles);
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
      setErr(e?.message ?? "Fout bij opslaan.");
    } finally {
      setBusy(false);
    }
  };

  const archive = async () => {
    const ok = confirm("Vrijwilliger archiveren?");
    if (!ok) return;

    setErr(null);
    setBusy(true);

    try {
      const { error } = await supabase
        .from("vrijwilligers")
        .update({
          actief: false,
          gearchiveerd_op: new Date().toISOString(),
        })
        .eq("id", vrijwilliger.id);

      if (error) throw error;

      // terug naar overzicht (met eventueel q-param)
      window.location.href = returnHref ?? "/admin/vrijwilligers";
    } catch (e: any) {
      setErr(e?.message ?? "Fout bij archiveren.");
    } finally {
      setBusy(false);
    }
  };

  return (
    // key zorgt dat local state (telefoon/adres) reset bij wisselen van record
    <div key={vrijwilliger.id} className="space-y-4">
      <div className="rounded-2xl border border-blue-100 bg-blue-50 shadow-sm p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm text-gray-600">Vrijwilliger</div>
            <div className="text-lg font-semibold text-gray-900">{naam}</div>
          </div>
        </div>

        {err && (
          <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-red-700">
            {err}
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block font-medium mb-1">Telefoon</label>
            <input
              className="w-full border border-gray-200 rounded-xl p-3 bg-white"
              value={telefoon}
              onChange={(e) => setTelefoon(e.target.value)}
              inputMode="tel"
            />
          </div>

          <div>
            <label className="block font-medium mb-1">Adres</label>
            <input
              className="w-full border border-gray-200 rounded-xl p-3 bg-white"
              value={adres}
              onChange={(e) => setAdres(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4">
          <div className="font-semibold mb-2">Interesses</div>
          {interests.length ? (
            <ul className="list-disc pl-5 space-y-1 text-sm text-gray-800">
              {interests.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-gray-600">Geen interesses.</div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4">
          <div className="font-semibold mb-2">Rol(len)</div>
          {roles.length ? (
            <ul className="list-disc pl-5 space-y-1 text-sm text-gray-800">
              {roles.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-gray-600">Geen rollen.</div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          className="border rounded-xl px-5 py-3 font-semibold bg-white shadow-sm hover:shadow-md transition disabled:opacity-60"
          onClick={save}
          disabled={busy}
        >
          {busy ? "Bezig…" : "Opslaan"}
        </button>

        <button
          className="border rounded-xl px-5 py-3 font-semibold text-red-700 bg-white shadow-sm hover:shadow-md transition disabled:opacity-60"
          onClick={archive}
          disabled={busy}
        >
          Archiveren
        </button>

        <a
          className="border rounded-xl px-5 py-3 font-semibold bg-white shadow-sm hover:shadow-md transition"
          href={returnHref ?? "/admin/vrijwilligers"}
        >
          Terug
        </a>
      </div>
    </div>
  );
}