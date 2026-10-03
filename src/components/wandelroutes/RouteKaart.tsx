"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, CircleMarker } from "leaflet";
import { parseGpx } from "@/lib/wandelroutes";

type Props = {
  gpxUrl: string;
  onStartpunt?: (lat: number, lon: number) => void;
};

const MELDING_VINGERS = "Gebruik twee vingers om de kaart te verplaatsen";

function scrollMelding(): string {
  const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform ?? "");
  return isMac
    ? "Gebruik ⌘ + scrollen om in en uit te zoomen"
    : "Gebruik Ctrl + scrollen om in en uit te zoomen";
}

export default function RouteKaart({ gpxUrl, onStartpunt }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const ikBenHierRef = useRef<{ stip: CircleMarker; cirkel: CircleMarker } | null>(null);
  const gebaarCleanupRef = useRef<(() => void) | null>(null);
  const meldingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [volgBezig, setVolgBezig] = useState(false);
  const [locatieFout, setLocatieFout] = useState<string | null>(null);
  const [laadFout, setLaadFout] = useState<string | null>(null);
  const [melding, setMelding] = useState<string | null>(null);

  function toonMelding(tekst: string) {
    setMelding(tekst);
    if (meldingTimeoutRef.current) clearTimeout(meldingTimeoutRef.current);
    meldingTimeoutRef.current = setTimeout(() => setMelding(null), 1600);
  }

  /**
   * Op een aanraakscherm scrolt één vinger de pagina; enkel twee vingers
   * bewegen de kaart (anders "kaapt" de kaart elke scrollbeweging op gsm).
   * Op pc zoomt de kaart enkel met Ctrl/⌘ ingedrukt; gewoon scrollen blijft
   * de pagina scrollen. Pinch-zoom met twee vingers blijft altijd werken
   * (Leaflets eigen touchZoom-handler luistert daar los van dragging naar).
   */
  function setupGebaarbediening(map: LeafletMap, container: HTMLDivElement): () => void {
    const isTouch =
      typeof window !== "undefined" &&
      ("ontouchstart" in window || navigator.maxTouchPoints > 0);

    const isControl = (target: EventTarget | null) =>
      target instanceof Element && !!target.closest(".leaflet-control");

    if (isTouch) {
      map.dragging.disable();

      const onTouchStart = (e: TouchEvent) => {
        if (e.touches.length >= 2) map.dragging.enable();
        else map.dragging.disable();
      };
      const onTouchMove = (e: TouchEvent) => {
        if (e.touches.length === 1 && !isControl(e.target)) {
          toonMelding(MELDING_VINGERS);
        }
      };
      const onTouchEnd = (e: TouchEvent) => {
        if (e.touches.length < 2) map.dragging.disable();
      };

      container.addEventListener("touchstart", onTouchStart, { passive: true });
      container.addEventListener("touchmove", onTouchMove, { passive: true });
      container.addEventListener("touchend", onTouchEnd, { passive: true });
      container.addEventListener("touchcancel", onTouchEnd, { passive: true });

      return () => {
        container.removeEventListener("touchstart", onTouchStart);
        container.removeEventListener("touchmove", onTouchMove);
        container.removeEventListener("touchend", onTouchEnd);
        container.removeEventListener("touchcancel", onTouchEnd);
      };
    }

    // Desktop (muis): scrollwiel zoomt de kaart enkel samen met Ctrl/⌘.
    map.scrollWheelZoom.disable();
    let accumulatedDelta = 0;
    let zoomTimer: ReturnType<typeof setTimeout> | null = null;

    const onWheel = (e: WheelEvent) => {
      if (isControl(e.target)) return;

      if (!(e.ctrlKey || e.metaKey)) {
        toonMelding(scrollMelding());
        return; // laat de pagina gewoon scrollen
      }

      e.preventDefault();
      accumulatedDelta += e.deltaY;
      if (zoomTimer) return;

      zoomTimer = setTimeout(() => {
        const stap = accumulatedDelta > 0 ? -1 : 1;
        const punt = map.mouseEventToContainerPoint(e as unknown as MouseEvent);
        map.setZoomAround(punt, map.getZoom() + stap);
        accumulatedDelta = 0;
        zoomTimer = null;
      }, 40);
    };

    container.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      container.removeEventListener("wheel", onWheel);
      if (zoomTimer) clearTimeout(zoomTimer);
    };
  }

  useEffect(() => {
    let actief = true;

    (async () => {
      if (!containerRef.current) return;

      const L = (await import("leaflet")).default;

      try {
        const res = await fetch(gpxUrl);
        if (!res.ok) throw new Error("GPX-bestand kon niet geladen worden.");
        const tekst = await res.text();
        const punten = parseGpx(tekst);

        if (!actief || !containerRef.current) return;

        if (punten.length === 0) {
          setLaadFout("Geen route gevonden in dit GPX-bestand.");
          return;
        }

        const map = L.map(containerRef.current);
        mapRef.current = map;

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap-bijdragers",
          maxZoom: 19,
        }).addTo(map);

        const lijn = L.polyline(punten, { color: "#1e3a8a", weight: 5 }).addTo(map);
        map.fitBounds(lijn.getBounds(), { padding: [20, 20] });

        const [startLat, startLon] = punten[0];
        L.circleMarker([startLat, startLon], {
          radius: 8,
          color: "#15803d",
          fillColor: "#22c55e",
          fillOpacity: 1,
          weight: 2,
        }).addTo(map);

        gebaarCleanupRef.current = setupGebaarbediening(map, containerRef.current);

        onStartpunt?.(startLat, startLon);
      } catch (e) {
        if (actief) {
          setLaadFout(e instanceof Error ? e.message : "Route kon niet geladen worden.");
        }
      }
    })();

    return () => {
      actief = false;
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (meldingTimeoutRef.current) {
        clearTimeout(meldingTimeoutRef.current);
        meldingTimeoutRef.current = null;
      }
      gebaarCleanupRef.current?.();
      gebaarCleanupRef.current = null;
      ikBenHierRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpxUrl]);

  async function toggleVolgen() {
    setLocatieFout(null);

    if (volgBezig) {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setVolgBezig(false);
      return;
    }

    if (!("geolocation" in navigator)) {
      setLocatieFout("Locatie wordt niet ondersteund op dit toestel.");
      return;
    }

    const map = mapRef.current;
    if (!map) return;

    const L = (await import("leaflet")).default;
    setVolgBezig(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const straal = Math.max(accuracy / 2, 10);

        if (!ikBenHierRef.current) {
          const cirkel = L.circleMarker([latitude, longitude], {
            radius: straal,
            color: "#1d4ed8",
            fillColor: "#60a5fa",
            fillOpacity: 0.25,
            weight: 1,
          }).addTo(map);
          const stip = L.circleMarker([latitude, longitude], {
            radius: 7,
            color: "#1d4ed8",
            fillColor: "#3b82f6",
            fillOpacity: 1,
            weight: 2,
          }).addTo(map);
          ikBenHierRef.current = { stip, cirkel };
        } else {
          ikBenHierRef.current.stip.setLatLng([latitude, longitude]);
          ikBenHierRef.current.cirkel.setLatLng([latitude, longitude]);
          ikBenHierRef.current.cirkel.setRadius(straal);
        }

        map.setView([latitude, longitude]);
      },
      () => {
        setLocatieFout("Je locatie kon niet bepaald worden. Controleer of locatietoegang is toegestaan.");
        setVolgBezig(false);
        if (watchIdRef.current != null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
      },
      { enableHighAccuracy: true }
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <div
          ref={containerRef}
          className="relative z-0 isolate h-[350px] sm:h-[450px] w-full rounded-2xl overflow-hidden border border-gray-200"
        />

        {melding && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
            <div className="bg-black/70 text-white text-sm rounded-xl px-4 py-2 text-center">
              {melding}
            </div>
          </div>
        )}
      </div>

      {laadFout && <div className="wa-alert-error">{laadFout}</div>}

      <button
        type="button"
        onClick={toggleVolgen}
        className="wa-btn wa-btn-ghost w-full py-2 text-sm"
      >
        {volgBezig ? "📍 Stop met tonen waar ik ben" : "📍 Toon waar ik ben"}
      </button>

      {locatieFout && <div className="wa-alert-error">{locatieFout}</div>}
    </div>
  );
}
