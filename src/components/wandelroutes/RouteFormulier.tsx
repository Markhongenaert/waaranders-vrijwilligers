"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  BUCKET,
  afstandKm,
  parseGpx,
  type Moeilijkheid,
  type Wandelroute,
} from "@/lib/wandelroutes";

type Props = {
  mode: "nieuw" | "bewerken";
  route: Wandelroute | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

function sanitizeBestandsnaam(naam: string): string {
  return naam.replace(/[^a-z0-9.\-_]/gi, "-").toLowerCase();
}

function basisNaam(pad: string | null): string | null {
  if (!pad) return null;
  const stuk = pad.split("/").pop() ?? pad;
  // verwijder de tijdstempel-prefix "1700000000000-" voor een leesbaardere naam
  return stuk.replace(/^\d+-/, "");
}

async function uploadBestand(id: string, file: File): Promise<string> {
  const pad = `${id}/${Date.now()}-${sanitizeBestandsnaam(file.name)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(pad, file);
  if (error) throw error;
  return pad;
}

export default function RouteFormulier({ mode, route, onClose, onSaved }: Props) {
  const [titel, setTitel] = useState(route?.titel ?? "");
  const [korteOmschrijving, setKorteOmschrijving] = useState(route?.korte_omschrijving ?? "");
  const [afstand, setAfstand] = useState(route?.afstand_km != null ? String(route.afstand_km) : "");
  const [duur, setDuur] = useState(route?.duur_minuten != null ? String(route.duur_minuten) : "");
  const [moeilijkheid, setMoeilijkheid] = useState<Moeilijkheid>(route?.moeilijkheid ?? "makkelijk");
  const [goedOmTeWeten, setGoedOmTeWeten] = useState(route?.goed_om_te_weten ?? "");
  const [seizoensinfo, setSeizoensinfo] = useState(route?.seizoensinfo ?? "");
  const [mapyLink, setMapyLink] = useState(route?.mapy_link ?? "");
  const [volgorde, setVolgorde] = useState<number>(route?.volgorde ?? 0);
  const [zichtbaar, setZichtbaar] = useState(route?.zichtbaar ?? false);

  const [gpxFile, setGpxFile] = useState<File | null>(null);
  const [gpxFout, setGpxFout] = useState<string | null>(null);
  const [fotoFile, setFotoFile] = useState<File | null>(null);

  const [busy, setBusy] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  async function onGpxChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setGpxFout(null);

    if (!file) {
      setGpxFile(null);
      return;
    }

    try {
      const tekst = await file.text();
      const punten = parseGpx(tekst);

      if (punten.length === 0) {
        setGpxFout("Dit bestand bevat geen bruikbare routepunten.");
        e.target.value = "";
        setGpxFile(null);
        return;
      }

      setGpxFile(file);
      setAfstand(String(afstandKm(punten)));
    } catch {
      setGpxFout("Dit GPX-bestand kon niet gelezen worden.");
      e.target.value = "";
      setGpxFile(null);
    }
  }

  function onFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFotoFile(e.target.files?.[0] ?? null);
  }

  async function save() {
    setFout(null);

    const t = titel.trim();
    if (!t) return setFout("Titel is verplicht.");
    if (mode === "nieuw" && !gpxFile) return setFout("GPX-bestand is verplicht.");

    setBusy(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user?.id ?? null;

      const id = mode === "nieuw" ? crypto.randomUUID() : (route as Wandelroute).id;

      const oudeGpxPad = mode === "bewerken" ? route?.gpx_pad ?? null : null;
      const oudeFotoPad = mode === "bewerken" ? route?.foto_pad ?? null : null;

      let gpxPad = oudeGpxPad;
      let fotoPad = oudeFotoPad;

      if (gpxFile) gpxPad = await uploadBestand(id, gpxFile);
      if (fotoFile) fotoPad = await uploadBestand(id, fotoFile);

      const payload = {
        titel: t,
        korte_omschrijving: korteOmschrijving.trim() || null,
        afstand_km: afstand.trim() ? Number(afstand) : null,
        duur_minuten: duur.trim() ? Number(duur) : null,
        moeilijkheid,
        goed_om_te_weten: goedOmTeWeten.trim() || null,
        seizoensinfo: seizoensinfo.trim() || null,
        gpx_pad: gpxPad,
        foto_pad: fotoPad,
        mapy_link: mapyLink.trim() || null,
        volgorde: Number.isFinite(volgorde) ? volgorde : 0,
        zichtbaar,
      };

      if (mode === "nieuw") {
        const { error } = await supabase
          .from("wandelroutes")
          .insert({ id, ...payload, aangemaakt_door: userId });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("wandelroutes").update(payload).eq("id", id);
        if (error) throw error;

        const teVerwijderen: string[] = [];
        if (gpxFile && oudeGpxPad && oudeGpxPad !== gpxPad) teVerwijderen.push(oudeGpxPad);
        if (fotoFile && oudeFotoPad && oudeFotoPad !== fotoPad) teVerwijderen.push(oudeFotoPad);
        if (teVerwijderen.length > 0) {
          await supabase.storage.from(BUCKET).remove(teVerwijderen);
        }
      }

      await onSaved();
    } catch (e) {
      setFout(e instanceof Error ? e.message : "Opslaan mislukt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl p-6 shadow-xl max-w-md w-full space-y-4 overflow-y-auto max-h-[90vh]">
        <h2 className="font-semibold text-lg">
          {mode === "nieuw" ? "Route toevoegen" : "Route bewerken"}
        </h2>

        {fout && <div className="wa-alert-error">{fout}</div>}

        <div>
          <label className="text-sm font-medium block mb-1">Titel</label>
          <input
            className="w-full border rounded-xl p-3 bg-white text-sm"
            value={titel}
            onChange={(e) => setTitel(e.target.value)}
            disabled={busy}
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Korte omschrijving</label>
          <textarea
            className="w-full border rounded-xl p-3 bg-white text-sm"
            rows={2}
            value={korteOmschrijving}
            onChange={(e) => setKorteOmschrijving(e.target.value)}
            placeholder="In 1 à 2 zinnen…"
            disabled={busy}
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">
            GPX-bestand{mode === "nieuw" ? " (verplicht)" : ""}
          </label>
          {mode === "bewerken" && route?.gpx_pad && !gpxFile && (
            <p className="text-xs text-gray-500 mb-1">Huidig bestand: {basisNaam(route.gpx_pad)}</p>
          )}
          <input
            type="file"
            accept=".gpx"
            onChange={onGpxChange}
            disabled={busy}
            className="w-full text-sm"
          />
          {gpxFout && <p className="text-xs text-red-600 mt-1">{gpxFout}</p>}
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Afstand (km)</label>
          <input
            type="number"
            min={0}
            step="0.1"
            className="w-full border rounded-xl p-3 bg-white text-sm"
            value={afstand}
            onChange={(e) => setAfstand(e.target.value)}
            onFocus={(e) => e.target.select()}
            disabled={busy}
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Duur met ezels (minuten)</label>
          <p className="text-xs text-gray-500 mb-1">
            Ezels stappen trager en stoppen om te grazen. Reken op ongeveer 2 à 3 km per uur.
          </p>
          <input
            type="number"
            min={0}
            className="w-full border rounded-xl p-3 bg-white text-sm"
            value={duur}
            onChange={(e) => setDuur(e.target.value)}
            onFocus={(e) => e.target.select()}
            disabled={busy}
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Moeilijkheid</label>
          <select
            className="w-full border rounded-xl p-3 bg-white text-sm"
            value={moeilijkheid}
            onChange={(e) => setMoeilijkheid(e.target.value as Moeilijkheid)}
            disabled={busy}
          >
            <option value="makkelijk">Makkelijk</option>
            <option value="gemiddeld">Gemiddeld</option>
            <option value="pittig">Pittig</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Goed om te weten</label>
          <p className="text-xs text-gray-500 mb-1">
            bv. modderige stukken, beekjes, drukke fietspaden, waar je kan pauzeren
          </p>
          <textarea
            className="w-full border rounded-xl p-3 bg-white text-sm"
            rows={4}
            value={goedOmTeWeten}
            onChange={(e) => setGoedOmTeWeten(e.target.value)}
            disabled={busy}
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Seizoensinfo</label>
          <textarea
            className="w-full border rounded-xl p-3 bg-white text-sm"
            rows={3}
            value={seizoensinfo}
            onChange={(e) => setSeizoensinfo(e.target.value)}
            disabled={busy}
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Foto (optioneel)</label>
          {mode === "bewerken" && route?.foto_pad && !fotoFile && (
            <p className="text-xs text-gray-500 mb-1">Huidige foto: {basisNaam(route.foto_pad)}</p>
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onFotoChange}
            disabled={busy}
            className="w-full text-sm"
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Link naar Mapy (optioneel)</label>
          <input
            type="text"
            className="w-full border rounded-xl p-3 bg-white text-sm"
            value={mapyLink}
            onChange={(e) => setMapyLink(e.target.value)}
            placeholder="https://mapy.cz/..."
            disabled={busy}
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Volgorde</label>
          <input
            type="number"
            className="w-full border rounded-xl p-3 bg-white text-sm"
            value={volgorde}
            onChange={(e) => setVolgorde(Number(e.target.value) || 0)}
            onFocus={(e) => e.target.select()}
            disabled={busy}
          />
        </div>

        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={zichtbaar}
            onChange={(e) => setZichtbaar(e.target.checked)}
            disabled={busy}
            className="w-4 h-4 rounded mt-0.5"
          />
          <span className="text-sm">
            <span className="font-medium">Zichtbaar voor iedereen</span>
            <br />
            <span className="text-gray-500 text-xs">Laat uit zolang de route nog niet klaar is.</span>
          </span>
        </label>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            className="wa-btn wa-btn-brand flex-1 py-2 text-sm"
            onClick={save}
            disabled={busy}
          >
            {busy ? "Bezig…" : "Opslaan"}
          </button>
          <button
            type="button"
            className="wa-btn wa-btn-ghost flex-1 py-2 text-sm"
            onClick={onClose}
            disabled={busy}
          >
            Annuleren
          </button>
        </div>
      </div>
    </div>
  );
}
