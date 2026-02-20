"use client";

import { useMemo, useState } from "react";

type Doelgroep = { id: string; naam: string };

type Props = {
  mode: "create" | "edit";
  initial: {
    naam: string;
    contactpersoon_naam: string;
    contactpersoon_telefoon: string;
    adres: string;
    doelgroep_id: string | null;
    actief: boolean;
  };
  doelgroepen: Doelgroep[];
  onSubmit: (payload: any) => Promise<void>;
  onArchive?: (() => Promise<void>) | null;
  returnTo?: string | null;
};

export default function KlantForm({ mode, initial, doelgroepen, onSubmit, onArchive, returnTo }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [naam, setNaam] = useState(initial.naam);
  const [contactpersoon_naam, setCpNaam] = useState(initial.contactpersoon_naam);
  const [contactpersoon_telefoon, setCpTel] = useState(initial.contactpersoon_telefoon);
  const [adres, setAdres] = useState(initial.adres);
  const [doelgroep_id, setDoelgroepId] = useState<string | "">(initial.doelgroep_id ?? "");
  const [actief, setActief] = useState(initial.actief);

  const doelgroepLabel = useMemo(
    () => doelgroepen.find((d) => d.id === doelgroep_id)?.naam ?? "",
    [doelgroepen, doelgroep_id]
  );

  const submit = async () => {
    setErr(null);
    const trimmed = naam.trim();
    if (!trimmed) {
      setErr("Naam is verplicht.");
      return;
    }

    setBusy(true);
    try {
      await onSubmit({
        naam: trimmed,
        contactpersoon_naam: contactpersoon_naam.trim() || null,
        contactpersoon_telefoon: contactpersoon_telefoon.trim() || null,
        adres: adres.trim() || null,
        doelgroep_id: doelgroep_id || null,
        actief,
        returnTo: returnTo ?? null,
      });
    } catch (e: any) {
      setErr(e?.message ?? "Onbekende fout.");
      setBusy(false);
    }
  };

  const archive = async () => {
    if (!onArchive) return;
    const ok = confirm("Klant archiveren? (activiteiten blijven bestaan en blijven naar deze klant verwijzen)");
    if (!ok) return;

    setBusy(true);
    try {
      await onArchive();
    } catch (e: any) {
      setErr(e?.message ?? "Onbekende fout.");
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {err && <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-red-700">{err}</div>}

      <div>
        <label className="block font-medium mb-1">Naam (verplicht)</label>
        <input className="w-full border rounded-xl p-3" value={naam} onChange={(e) => setNaam(e.target.value)} />
      </div>

      <div>
        <label className="block font-medium mb-1">Doelgroep</label>
        <select
          className="w-full border rounded-xl p-3"
          value={doelgroep_id}
          onChange={(e) => setDoelgroepId(e.target.value)}
        >
          <option value="">— Geen —</option>
          {doelgroepen.map((d) => (
            <option key={d.id} value={d.id}>
              {d.naam}
            </option>
          ))}
        </select>
        {doelgroepLabel && <p className="text-sm text-gray-600 mt-1">Geselecteerd: {doelgroepLabel}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block font-medium mb-1">Contactpersoon</label>
          <input className="w-full border rounded-xl p-3" value={contactpersoon_naam} onChange={(e) => setCpNaam(e.target.value)} />
        </div>
        <div>
          <label className="block font-medium mb-1">Telefoon</label>
          <input className="w-full border rounded-xl p-3" value={contactpersoon_telefoon} onChange={(e) => setCpTel(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="block font-medium mb-1">Adres</label>
        <input className="w-full border rounded-xl p-3" value={adres} onChange={(e) => setAdres(e.target.value)} />
      </div>

      <label className="flex items-center gap-3">
        <input type="checkbox" checked={actief} onChange={(e) => setActief(e.target.checked)} />
        <span>Actief (toonbaar in dropdown bij nieuwe activiteiten)</span>
      </label>

      <div className="flex gap-3">
        <button className="border rounded-xl px-5 py-3 font-medium" onClick={submit} disabled={busy}>
          {busy ? "Bezig…" : "Opslaan"}
        </button>

        <a className="border rounded-xl px-5 py-3 font-medium" href={returnTo ?? "/admin/klanten"}>
          Annuleren
        </a>

        {mode === "edit" && (
          <button className="border rounded-xl px-5 py-3 font-medium" onClick={archive} disabled={busy}>
            Archiveren
          </button>
        )}
      </div>
    </div>
  );
}