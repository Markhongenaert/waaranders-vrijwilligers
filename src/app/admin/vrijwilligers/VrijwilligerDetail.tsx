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
    actief?: boolean | null;

    werkgroep_deelnemers:
      | { werkgroepen: { titel: string | null } | { titel: string | null }[] | null }
      | { werkgroepen: { titel: string | null } | { titel: string | null }[] | null }[]
      | null;

    vrijwilliger_roles:
      | { roles: { titel: string | null } | { titel: string | null }[] | null }
      | { roles: { titel: string | null } | { titel: string | null }[] | null }[]
      | null;
  };
  isAdmin?: boolean;
  onSaved: (patch: { telefoon: string | null; adres: string | null }) => void;
  onActiefChanged?: (actief: boolean) => void;
  returnHref?: string;
};

function toList<T>(x: T | T[] | null | undefined): T[] {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

function uniqSorted(list: string[]) {
  return Array.from(new Set(list)).sort((a, b) => a.localeCompare(b));
}

export default function VrijwilligerDetail({ vrijwilliger, isAdmin = false, onSaved, onActiefChanged, returnHref }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // local editable fields
  const [telefoon, setTelefoon] = useState(vrijwilliger.telefoon ?? "");
  const [adres, setAdres] = useState(vrijwilliger.adres ?? "");

  const naam = useMemo(() => {
    return [vrijwilliger.voornaam ?? "", vrijwilliger.achternaam ?? ""].join(" ").trim() || "—";
  }, [vrijwilliger.voornaam, vrijwilliger.achternaam]);

  const werkgroepen = useMemo(() => {
    const wd = toList(vrijwilliger.werkgroep_deelnemers as any);
    const titles = wd
      .map((row: any) => (row?.werkgroepen?.titel ?? "").trim())
      .filter(Boolean);
    return uniqSorted(titles);
  }, [vrijwilliger.werkgroep_deelnemers]);

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

      onActiefChanged?.(false);
      window.location.href = returnHref ?? "/admin/vrijwilligers";
    } catch (e: any) {
      setErr(e?.message ?? "Fout bij archiveren.");
    } finally {
      setBusy(false);
    }
  };

  const activate = async () => {
    const ok = confirm("Vrijwilliger opnieuw activeren?");
    if (!ok) return;

    setErr(null);
    setBusy(true);

    try {
      const { error } = await supabase
        .from("vrijwilligers")
        .update({ actief: true, gearchiveerd_op: null })
        .eq("id", vrijwilliger.id);

      if (error) throw error;

      onActiefChanged?.(true);
    } catch (e: any) {
      setErr(e?.message ?? "Fout bij activeren.");
    } finally {
      setBusy(false);
    }
  };

  return (
    // key zorgt dat local state (telefoon/adres) reset bij wisselen van record
    <div key={vrijwilliger.id} className="space-y-4">
      <div className="wa-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-gray-900">{naam}</div>
          </div>
        </div>

        {err && (
          <div className="wa-alert-error mt-4">
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
        <div className="wa-card p-4">
          <div className="font-semibold mb-2">Werkgroepen</div>
          {werkgroepen.length ? (
            <ul className="list-disc pl-5 space-y-1 text-sm text-gray-800">
              {werkgroepen.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-gray-600">Geen werkgroepen.</div>
          )}
        </div>

        <div className="wa-card p-4">
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
          className="wa-btn wa-btn-ghost px-5 py-3"
          onClick={save}
          disabled={busy}
        >
          {busy ? "Bezig…" : "Opslaan"}
        </button>

        {isAdmin && vrijwilliger.actief !== false && (
          <button
            className="wa-btn-danger px-5 py-3"
            onClick={archive}
            disabled={busy}
          >
            Archiveren
          </button>
        )}

        {isAdmin && vrijwilliger.actief === false && (
          <button
            className="wa-btn-success px-5 py-3"
            onClick={activate}
            disabled={busy}
          >
            Activeren
          </button>
        )}

        <a
          className="wa-btn wa-btn-ghost px-5 py-3"
          href={returnHref ?? "/admin/vrijwilligers"}
        >
          Terug
        </a>
      </div>
    </div>
  );
}
