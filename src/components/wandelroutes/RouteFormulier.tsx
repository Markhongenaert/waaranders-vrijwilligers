"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  BUCKET,
  afstandKm,
  parseGpx,
  publiekeUrl,
  verkleinFoto,
  type Moeilijkheid,
  type Wandelroute,
  type WandelrouteFoto,
} from "@/lib/wandelroutes";

type Props = {
  mode: "nieuw" | "bewerken";
  route: Wandelroute | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

type FotoItem =
  | { soort: "bestaand"; id: string; pad: string; bijschrift: string }
  | { soort: "legacy"; pad: string; bijschrift: string }
  | { soort: "nieuw"; tempId: string; file: File; preview: string; bijschrift: string };

function fotoKey(f: FotoItem): string {
  if (f.soort === "bestaand") return f.id;
  if (f.soort === "legacy") return `legacy:${f.pad}`;
  return f.tempId;
}

function sanitizeBestandsnaam(naam: string): string {
  return naam.replace(/[^a-z0-9.\-_]/gi, "-").toLowerCase();
}

function naarJpgNaam(naam: string): string {
  const basis = naam.replace(/\.[a-z0-9]+$/i, "");
  return `${sanitizeBestandsnaam(basis)}.jpg`;
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

async function uploadFotoOnderweg(routeId: string, file: File): Promise<string> {
  const klein = await verkleinFoto(file);
  const naam = naarJpgNaam(file.name);
  const pad = `${routeId}/fotos/${Date.now()}-${naam}`;
  const { error } = await supabase.storage.from(BUCKET).upload(pad, klein, {
    contentType: "image/jpeg",
  });
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
  const [routebeschrijving, setRoutebeschrijving] = useState(route?.routebeschrijving ?? "");
  const [mapyLink, setMapyLink] = useState(route?.mapy_link ?? "");
  const [volgorde, setVolgorde] = useState<number>(route?.volgorde ?? 0);
  const [zichtbaar, setZichtbaar] = useState(route?.zichtbaar ?? false);

  const [gpxFile, setGpxFile] = useState<File | null>(null);
  const [gpxFout, setGpxFout] = useState<string | null>(null);

  const [fotos, setFotos] = useState<FotoItem[]>([]);
  const [fotosLaden, setFotosLaden] = useState(mode === "bewerken");
  const [origFotoIds, setOrigFotoIds] = useState<Set<string>>(new Set());
  const [sterKey, setSterKey] = useState<string | null>(null);
  const origLegacyPadRef = useRef<string | null>(null);
  const previewUrlsRef = useRef<string[]>([]);

  const [busy, setBusy] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "bewerken" || !route) return;

    (async () => {
      const { data } = await supabase
        .from("wandelroute_fotos")
        .select("id,route_id,pad,bijschrift,volgorde,aangemaakt_op")
        .eq("route_id", route.id)
        .order("volgorde", { ascending: true });

      const rows = (data ?? []) as WandelrouteFoto[];
      const bestaande = rows.map((r) => ({
        soort: "bestaand" as const,
        id: r.id,
        pad: r.pad,
        bijschrift: r.bijschrift ?? "",
      }));

      let initieel: FotoItem[] = bestaande;
      let initieleSter: string | null = null;

      if (route.foto_pad) {
        const matchend = bestaande.find((f) => f.pad === route.foto_pad);
        if (matchend) {
          initieleSter = fotoKey(matchend);
        } else {
          // Oude, apart opgeladen hoofdfoto die niet (meer) in wandelroute_fotos staat.
          const legacyItem: FotoItem = { soort: "legacy", pad: route.foto_pad, bijschrift: "" };
          initieel = [legacyItem, ...bestaande];
          initieleSter = fotoKey(legacyItem);
          origLegacyPadRef.current = route.foto_pad;
        }
      }

      if (!initieleSter && initieel.length > 0) {
        initieleSter = fotoKey(initieel[0]);
      }

      setFotos(initieel);
      setOrigFotoIds(new Set(rows.map((r) => r.id)));
      setSterKey(initieleSter);
      setFotosLaden(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Veiligheidsnet: als er nog geen ster gekozen is (of de gekozen foto bestaat niet
  // meer), valt de ster automatisch op de eerste foto in de lijst.
  useEffect(() => {
    if (fotos.length === 0) {
      if (sterKey !== null) setSterKey(null);
      return;
    }
    if (sterKey === null || !fotos.some((f) => fotoKey(f) === sterKey)) {
      setSterKey(fotoKey(fotos[0]));
    }
  }, [fotos, sterKey]);

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

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

  function fotosToevoegen(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    const nieuw: FotoItem[] = files.map((file) => {
      const preview = URL.createObjectURL(file);
      previewUrlsRef.current.push(preview);
      return { soort: "nieuw", tempId: crypto.randomUUID(), file, preview, bijschrift: "" };
    });

    setFotos((prev) => [...prev, ...nieuw]);
  }

  function fotoBijschriftWijzigen(key: string, tekst: string) {
    setFotos((prev) => prev.map((f) => (fotoKey(f) === key ? { ...f, bijschrift: tekst } : f)));
  }

  function fotoVerwijderen(key: string) {
    setFotos((prev) => prev.filter((f) => fotoKey(f) !== key));
  }

  function fotoVerplaatsen(key: string, richting: -1 | 1) {
    setFotos((prev) => {
      const idx = prev.findIndex((f) => fotoKey(f) === key);
      const nieuwIdx = idx + richting;
      if (idx === -1 || nieuwIdx < 0 || nieuwIdx >= prev.length) return prev;
      const kopie = [...prev];
      [kopie[idx], kopie[nieuwIdx]] = [kopie[nieuwIdx], kopie[idx]];
      return kopie;
    });
  }

  /** Verwerkt alle foto's (nieuw/bestaand/legacy) en geeft het pad van de gekozen hoofdfoto terug. */
  async function slaFotosOp(routeId: string): Promise<string | null> {
    const huidigeBestaandeIds = new Set(
      fotos.filter((f): f is FotoItem & { soort: "bestaand" } => f.soort === "bestaand").map((f) => f.id)
    );
    const verwijderdeIds = [...origFotoIds].filter((id) => !huidigeBestaandeIds.has(id));

    if (verwijderdeIds.length > 0) {
      const { data: teVerwijderenRows } = await supabase
        .from("wandelroute_fotos")
        .select("id,pad")
        .in("id", verwijderdeIds);

      const paden = (teVerwijderenRows ?? []).map((r) => r.pad).filter(Boolean) as string[];
      if (paden.length > 0) await supabase.storage.from(BUCKET).remove(paden);

      const { error } = await supabase.from("wandelroute_fotos").delete().in("id", verwijderdeIds);
      if (error) throw error;
    }

    // Oude, apart opgeladen hoofdfoto die de gebruiker nu verwijderd heeft: bestand opruimen.
    const legacyPad = origLegacyPadRef.current;
    const legacyNogAanwezig =
      legacyPad != null && fotos.some((f) => f.soort === "legacy" && f.pad === legacyPad);
    if (legacyPad && !legacyNogAanwezig) {
      await supabase.storage.from(BUCKET).remove([legacyPad]);
    }

    const opgeslagen: { key: string; pad: string }[] = [];

    for (let i = 0; i < fotos.length; i++) {
      const f = fotos[i];
      const bijschrift = f.bijschrift.trim() || null;

      if (f.soort === "bestaand") {
        const { error } = await supabase
          .from("wandelroute_fotos")
          .update({ bijschrift, volgorde: i })
          .eq("id", f.id);
        if (error) throw error;
        opgeslagen.push({ key: fotoKey(f), pad: f.pad });
      } else if (f.soort === "legacy") {
        // Wordt nu een "echte" foto onderweg (met eigen rij), het bestand blijft ongewijzigd.
        const { error } = await supabase
          .from("wandelroute_fotos")
          .insert({ route_id: routeId, pad: f.pad, bijschrift, volgorde: i });
        if (error) throw error;
        opgeslagen.push({ key: fotoKey(f), pad: f.pad });
      } else {
        const pad = await uploadFotoOnderweg(routeId, f.file);
        const { error } = await supabase
          .from("wandelroute_fotos")
          .insert({ route_id: routeId, pad, bijschrift, volgorde: i });
        if (error) throw error;
        opgeslagen.push({ key: fotoKey(f), pad });
      }
    }

    if (opgeslagen.length === 0) return null;
    const gekozen = opgeslagen.find((p) => p.key === sterKey);
    return (gekozen ?? opgeslagen[0]).pad;
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
      if (gpxFile) gpxPad = await uploadBestand(id, gpxFile);

      const basisPayload = {
        titel: t,
        korte_omschrijving: korteOmschrijving.trim() || null,
        afstand_km: afstand.trim() ? Number(afstand) : null,
        duur_minuten: duur.trim() ? Number(duur) : null,
        moeilijkheid,
        goed_om_te_weten: goedOmTeWeten.trim() || null,
        seizoensinfo: seizoensinfo.trim() || null,
        routebeschrijving: routebeschrijving.trim() || null,
        gpx_pad: gpxPad,
        mapy_link: mapyLink.trim() || null,
        volgorde: Number.isFinite(volgorde) ? volgorde : 0,
        zichtbaar,
      };

      if (mode === "nieuw") {
        // Eerst de route aanmaken (zonder foto_pad): wandelroute_fotos verwijst via
        // een foreign key naar deze rij en kan dus pas daarna ingevoegd worden.
        const { error } = await supabase
          .from("wandelroutes")
          .insert({ id, ...basisPayload, foto_pad: null, aangemaakt_door: userId });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("wandelroutes").update(basisPayload).eq("id", id);
        if (error) throw error;

        if (gpxFile && oudeGpxPad && oudeGpxPad !== gpxPad) {
          await supabase.storage.from(BUCKET).remove([oudeGpxPad]);
        }
      }

      const fotoPad = await slaFotosOp(id);

      if (fotoPad !== oudeFotoPad) {
        const { error } = await supabase.from("wandelroutes").update({ foto_pad: fotoPad }).eq("id", id);
        if (error) throw error;
      }

      await onSaved();
    } catch (e) {
      setFout(e instanceof Error ? e.message : "Opslaan mislukt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center overflow-y-auto bg-black/50 p-4">
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
          <label className="text-sm font-medium block mb-1">Routebeschrijving</label>
          <p className="text-xs text-gray-500 mb-1">
            Beschrijf de weg stap voor stap. Dit helpt wandelaars als er geen gsm-bereik is.
          </p>
          <textarea
            className="w-full border rounded-xl p-3 bg-white text-sm"
            rows={6}
            value={routebeschrijving}
            onChange={(e) => setRoutebeschrijving(e.target.value)}
            placeholder={
              "1. Vanaf de weide rechtsaf de kasseiweg op.\n2. Aan de kapel links het bospad in.\n3. Volg de rode rechthoek tot aan de vijver."
            }
            disabled={busy}
          />
        </div>

        {/* Foto's — bewust direct na Routebeschrijving, met een duidelijke tussentitel */}
        <div className="border-t border-gray-200 pt-4">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-semibold">Foto&apos;s</h3>
            <label className="wa-btn wa-btn-ghost px-3 py-1.5 text-xs cursor-pointer">
              ＋ Foto toevoegen
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={fotosToevoegen}
                disabled={busy}
                className="hidden"
              />
            </label>
          </div>
          <p className="text-xs text-gray-500 mb-2">
            Voeg foto&apos;s toe van belangrijke punten onderweg, elk met een korte uitleg. Tik op ☆
            om de foto te kiezen die bovenaan het routekaartje komt.
          </p>

          {fotosLaden ? (
            <p className="text-sm text-gray-500">Foto&apos;s laden…</p>
          ) : fotos.length === 0 ? (
            <p className="text-sm text-gray-500">Nog geen foto&apos;s toegevoegd.</p>
          ) : (
            <ul className="space-y-2">
              {fotos.map((f, i) => {
                const key = fotoKey(f);
                const src = f.soort === "nieuw" ? f.preview : publiekeUrl(f.pad);
                const isSter = sterKey === key;
                return (
                  <li key={key} className="border rounded-xl p-2 bg-white space-y-2">
                    <div className="flex gap-3">
                      {src && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={src} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />
                      )}
                      <div className="flex-1 space-y-1">
                        <label className="text-xs text-gray-500 block">Uitleg bij deze foto</label>
                        <input
                          type="text"
                          className="w-full border rounded-lg p-2 text-sm"
                          placeholder="bv. Aan deze kapel ga je links"
                          value={f.bijschrift}
                          onChange={(e) => fotoBijschriftWijzigen(key, e.target.value)}
                          disabled={busy}
                        />
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => fotoVerplaatsen(key, -1)}
                          disabled={busy || i === 0}
                          className="wa-btn wa-btn-ghost px-2 py-0.5 text-xs"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => fotoVerplaatsen(key, 1)}
                          disabled={busy || i === fotos.length - 1}
                          className="wa-btn wa-btn-ghost px-2 py-0.5 text-xs"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => fotoVerwijderen(key)}
                          disabled={busy}
                          className="wa-btn-danger px-2 py-0.5 text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSterKey(key)}
                        disabled={busy}
                        className={[
                          "text-lg leading-none",
                          isSter ? "text-amber-500" : "text-gray-300 hover:text-gray-400",
                        ].join(" ")}
                        aria-label={isSter ? "Foto op routekaartje" : "Kies als foto op routekaartje"}
                        title={isSter ? "Foto op routekaartje" : "Kies als foto op routekaartje"}
                      >
                        {isSter ? "★" : "☆"}
                      </button>
                      {isSter && (
                        <span className="text-xs font-medium text-amber-700">
                          {f.soort === "legacy" ? "Huidige foto op routekaartje" : "Foto op routekaartje"}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-gray-200 pt-4">
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

        <div className="flex gap-2 pt-3 pb-1 sticky bottom-0 bg-white border-t">
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
