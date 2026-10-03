"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  BUCKET,
  MOEILIJKHEID_KLEUR,
  MOEILIJKHEID_LABEL,
  formatDuur,
  navigatieLink,
  publiekeUrl,
  type Wandelroute,
  type WandelrouteFoto,
} from "@/lib/wandelroutes";
import RouteKaart from "./RouteKaart";
import RouteFormulier from "./RouteFormulier";

type Props = {
  beheer: boolean;
  openRouteId?: string | null;
  onOpenRouteGesloten?: () => void;
};

export default function RoutesSectie({ beheer, openRouteId, onOpenRouteGesloten }: Props) {
  const [loading, setLoading] = useState(true);
  const [routes, setRoutes] = useState<Wandelroute[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [startpunt, setStartpunt] = useState<{ lat: number; lon: number } | null>(null);
  const [fotos, setFotos] = useState<WandelrouteFoto[]>([]);
  const [fotoPreview, setFotoPreview] = useState<WandelrouteFoto | null>(null);

  const [verwijderBezig, setVerwijderBezig] = useState<string | null>(null);

  type FormulierState = { mode: "nieuw" | "bewerken"; route?: Wandelroute };
  const [formulierOpen, setFormulierOpen] = useState<FormulierState | null>(null);

  const load = async () => {
    setLoading(true);
    setErr(null);

    const { data, error } = await supabase
      .from("wandelroutes")
      .select("*")
      .order("volgorde", { ascending: true })
      .order("titel", { ascending: true });

    if (error) {
      setErr(error.message);
      setLoading(false);
      return;
    }

    setRoutes((data ?? []) as Wandelroute[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (openRouteId) setSelectedId(openRouteId);
  }, [openRouteId]);

  useEffect(() => {
    setStartpunt(null);
    setFotoPreview(null);

    if (!selectedId) {
      setFotos([]);
      return;
    }

    (async () => {
      const { data } = await supabase
        .from("wandelroute_fotos")
        .select("id,route_id,pad,bijschrift,volgorde,aangemaakt_op")
        .eq("route_id", selectedId)
        .order("volgorde", { ascending: true });
      setFotos((data ?? []) as WandelrouteFoto[]);
    })();
  }, [selectedId]);

  function sluitDetail() {
    setSelectedId(null);
    if (openRouteId) onOpenRouteGesloten?.();
  }

  function openNieuw() {
    setFormulierOpen({ mode: "nieuw" });
  }

  function openBewerken(r: Wandelroute) {
    setFormulierOpen({ mode: "bewerken", route: r });
  }

  async function naFormulierOpslaan() {
    setFormulierOpen(null);
    await load();
  }

  async function verwijderRoute(r: Wandelroute) {
    const ok = window.confirm(`Route "${r.titel}" verwijderen? Dit kan niet ongedaan gemaakt worden.`);
    if (!ok) return;

    setVerwijderBezig(r.id);
    setErr(null);

    try {
      const { data: fotoRows } = await supabase
        .from("wandelroute_fotos")
        .select("pad")
        .eq("route_id", r.id);

      const paden = [r.gpx_pad, r.foto_pad, ...(fotoRows ?? []).map((f) => f.pad)].filter(
        (p): p is string => !!p
      );
      if (paden.length > 0) {
        await supabase.storage.from(BUCKET).remove(paden);
      }

      const { error } = await supabase.from("wandelroutes").delete().eq("id", r.id);
      if (error) throw error;

      setSelectedId(null);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Verwijderen mislukt.");
    } finally {
      setVerwijderBezig(null);
    }
  }

  const selectedRoute = selectedId ? routes.find((r) => r.id === selectedId) ?? null : null;

  return (
    <div className="space-y-4">
      {fotoPreview && (() => {
        const src = publiekeUrl(fotoPreview.pad);
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 print:hidden"
            onClick={() => setFotoPreview(null)}
          >
            <div className="max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
              {src && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt={fotoPreview.bijschrift ?? ""} className="w-full rounded-2xl" />
              )}
              {fotoPreview.bijschrift && (
                <p className="text-white text-center mt-3">{fotoPreview.bijschrift}</p>
              )}
              <button
                type="button"
                onClick={() => setFotoPreview(null)}
                className="wa-btn wa-btn-ghost w-full mt-3 py-2 text-sm"
              >
                Sluiten
              </button>
            </div>
          </div>
        );
      })()}

      {formulierOpen && (
        <RouteFormulier
          mode={formulierOpen.mode}
          route={formulierOpen.route ?? null}
          onClose={() => setFormulierOpen(null)}
          onSaved={naFormulierOpslaan}
        />
      )}

      {err && <div className="wa-alert-error print:hidden">{err}</div>}

      {loading ? (
        <p className="text-gray-600">Laden…</p>
      ) : selectedRoute ? (
        <div className="space-y-5">
          <button
            type="button"
            onClick={sluitDetail}
            className="wa-btn wa-btn-ghost px-4 py-2 text-sm print:hidden"
          >
            ← Alle routes
          </button>

          <div>
            <h1 className="text-2xl font-bold">{selectedRoute.titel}</h1>
            <div className="flex flex-wrap gap-2 text-sm text-gray-700 mt-2">
              {selectedRoute.afstand_km != null && <span>{selectedRoute.afstand_km} km</span>}
              {selectedRoute.duur_minuten != null && <span>{formatDuur(selectedRoute.duur_minuten)}</span>}
              {selectedRoute.moeilijkheid && (
                <span
                  className={`rounded-full px-2 py-0.5 font-medium text-xs ${MOEILIJKHEID_KLEUR[selectedRoute.moeilijkheid]}`}
                >
                  {MOEILIJKHEID_LABEL[selectedRoute.moeilijkheid]}
                </span>
              )}
            </div>
            {selectedRoute.korte_omschrijving && (
              <p className="text-gray-700 mt-2">{selectedRoute.korte_omschrijving}</p>
            )}
          </div>

          <div className="wa-info-box p-4 text-sm print:hidden">
            Tip: open deze pagina op Waaranders, vóór je vertrekt. In het bos is er weinig gsm-bereik.
            Je locatie blijft wel werken zonder bereik.
          </div>

          {(() => {
            const gpxUrl = publiekeUrl(selectedRoute.gpx_pad);
            return gpxUrl ? (
              <RouteKaart gpxUrl={gpxUrl} onStartpunt={(lat, lon) => setStartpunt({ lat, lon })} />
            ) : (
              <p className="text-sm text-gray-600">Nog geen kaart beschikbaar voor deze route.</p>
            );
          })()}

          {selectedRoute.routebeschrijving && (
            <div className="wa-card p-4">
              <div className="font-semibold mb-2">Routebeschrijving</div>
              <p className="text-base leading-relaxed whitespace-pre-line">
                {selectedRoute.routebeschrijving}
              </p>
            </div>
          )}

          {fotos.length > 0 && (
            <div>
              <div className="font-semibold mb-2">Foto&apos;s onderweg</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-3 gap-3">
                {fotos.map((f) => {
                  const src = publiekeUrl(f.pad);
                  if (!src) return null;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFotoPreview(f)}
                      className="text-left print:break-inside-avoid"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt={f.bijschrift ?? ""}
                        loading="lazy"
                        className="w-full h-40 object-cover rounded-xl print:h-24"
                      />
                      {f.bijschrift && (
                        <p className="text-sm text-gray-700 mt-1">{f.bijschrift}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {(selectedRoute.goed_om_te_weten || selectedRoute.seizoensinfo) && (
            <div className="space-y-4">
              {selectedRoute.goed_om_te_weten && (
                <div className="wa-card p-4">
                  <div className="font-semibold mb-1">Goed om te weten</div>
                  <p className="text-sm text-gray-700 whitespace-pre-line">
                    {selectedRoute.goed_om_te_weten}
                  </p>
                </div>
              )}
              {selectedRoute.seizoensinfo && (
                <div className="wa-card p-4">
                  <div className="font-semibold mb-1">Seizoen</div>
                  <p className="text-sm text-gray-700 whitespace-pre-line">{selectedRoute.seizoensinfo}</p>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2 print:hidden">
            {startpunt && (
              <a
                href={navigatieLink(startpunt.lat, startpunt.lon)}
                target="_blank"
                rel="noopener noreferrer"
                className="wa-btn wa-btn-brand w-full py-2.5 text-center text-sm"
              >
                Breng me naar het startpunt
              </a>
            )}
            {selectedRoute.gpx_pad && (
              <a
                href={publiekeUrl(selectedRoute.gpx_pad) ?? "#"}
                download
                className="wa-btn wa-btn-ghost w-full py-2.5 text-center text-sm"
              >
                Download GPX
              </a>
            )}
            {selectedRoute.mapy_link && (
              <a
                href={selectedRoute.mapy_link}
                target="_blank"
                rel="noopener noreferrer"
                className="wa-btn wa-btn-ghost w-full py-2.5 text-center text-sm"
              >
                Open in Mapy
              </a>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="wa-btn wa-btn-ghost w-full py-2.5 text-sm"
            >
              🖨 Afdrukken
            </button>
          </div>

          <details className="wa-card p-4 text-sm print:hidden">
            <summary className="font-medium cursor-pointer">Hoe open ik dit in mijn wandelapp?</summary>
            <p className="text-gray-700 mt-2">
              Download het bestand en open het daarna in je wandelapp (bv. Komoot, Mapy of AllTrails)
              via de functie om een route of GPX-bestand te importeren — die heet in elke app een
              beetje anders. Sommige apps vragen daarvoor een account. Geen app? Dan volstaat de kaart
              op deze pagina.
            </p>
          </details>

          {beheer && (
            <div className="flex gap-2 print:hidden">
              <button
                type="button"
                onClick={() => openBewerken(selectedRoute)}
                className="wa-btn wa-btn-ghost flex-1 px-4 py-2 text-sm"
              >
                Bewerken
              </button>
              <button
                type="button"
                onClick={() => verwijderRoute(selectedRoute)}
                disabled={verwijderBezig === selectedRoute.id}
                className="wa-btn-danger flex-1 px-4 py-2 text-sm"
              >
                {verwijderBezig === selectedRoute.id ? "Verwijderen…" : "Verwijderen"}
              </button>
            </div>
          )}

          <div className="hidden print:block text-center text-sm text-gray-600 mt-4">
            Waaranders – vertrek aan de weide
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {beheer && (
            <div className="flex justify-end">
              <button type="button" onClick={openNieuw} className="wa-btn-action px-4 py-2 text-sm">
                ＋ Route toevoegen
              </button>
            </div>
          )}

          {routes.length === 0 ? (
            <p className="text-gray-600">Er zijn nog geen routes. Binnenkort meer!</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {routes.map((r) => {
                const foto = publiekeUrl(r.foto_pad);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedId(r.id)}
                    className="wa-card overflow-hidden text-left hover:shadow-md transition"
                  >
                    {foto && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={foto} alt="" className="w-full h-36 object-cover" />
                    )}
                    <div className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-semibold text-gray-900">{r.titel}</div>
                        {beheer && !r.zichtbaar && (
                          <span className="shrink-0 text-xs bg-gray-200 text-gray-600 rounded-full px-2 py-0.5">
                            Verborgen
                          </span>
                        )}
                      </div>
                      {r.korte_omschrijving && (
                        <p className="text-sm text-gray-600">{r.korte_omschrijving}</p>
                      )}
                      <div className="flex flex-wrap gap-2 text-xs text-gray-600 pt-1">
                        {r.afstand_km != null && <span>{r.afstand_km} km</span>}
                        {r.duur_minuten != null && <span>{formatDuur(r.duur_minuten)}</span>}
                        {r.moeilijkheid && (
                          <span
                            className={`rounded-full px-2 py-0.5 font-medium ${MOEILIJKHEID_KLEUR[r.moeilijkheid]}`}
                          >
                            {MOEILIJKHEID_LABEL[r.moeilijkheid]}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
