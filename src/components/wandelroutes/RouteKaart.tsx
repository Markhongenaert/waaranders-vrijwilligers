"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, CircleMarker } from "leaflet";
import { parseGpx } from "@/lib/wandelroutes";

type Props = {
  gpxUrl: string;
  onStartpunt?: (lat: number, lon: number) => void;
};

export default function RouteKaart({ gpxUrl, onStartpunt }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const ikBenHierRef = useRef<{ stip: CircleMarker; cirkel: CircleMarker } | null>(null);

  const [volgBezig, setVolgBezig] = useState(false);
  const [locatieFout, setLocatieFout] = useState<string | null>(null);
  const [laadFout, setLaadFout] = useState<string | null>(null);

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
      <div
        ref={containerRef}
        className="relative z-0 isolate h-[350px] sm:h-[450px] w-full rounded-2xl overflow-hidden border border-gray-200"
      />

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
