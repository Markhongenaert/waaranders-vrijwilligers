import { supabase } from "@/lib/supabaseClient";

export const BUCKET = "wandelroutes";

export type Moeilijkheid = "makkelijk" | "gemiddeld" | "pittig";

export type Wandelroute = {
  id: string;
  titel: string;
  korte_omschrijving: string | null;
  afstand_km: number | null;
  duur_minuten: number | null;
  moeilijkheid: Moeilijkheid | null;
  goed_om_te_weten: string | null;
  seizoensinfo: string | null;
  routebeschrijving: string | null;
  gpx_pad: string | null;
  foto_pad: string | null;
  mapy_link: string | null;
  zichtbaar: boolean;
  volgorde: number;
  aangemaakt_door: string | null;
  aangemaakt_op: string;
  bijgewerkt_op: string;
};

export type WandelrouteFoto = {
  id: string;
  route_id: string;
  pad: string;
  bijschrift: string | null;
  volgorde: number;
  aangemaakt_op: string;
};

export const MOEILIJKHEID_LABEL: Record<Moeilijkheid, string> = {
  makkelijk: "Makkelijk",
  gemiddeld: "Gemiddeld",
  pittig: "Pittig",
};

export const MOEILIJKHEID_KLEUR: Record<Moeilijkheid, string> = {
  makkelijk: "bg-green-100 text-green-800 border border-green-200",
  gemiddeld: "bg-orange-100 text-orange-800 border border-orange-200",
  pittig: "bg-red-100 text-red-800 border border-red-200",
};

/** Geeft de publieke URL van een bestand in de wandelroutes-bucket, of null. */
export function publiekeUrl(pad: string | null): string | null {
  if (!pad) return null;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(pad);
  return data?.publicUrl ?? null;
}

/** Leest trkpt-punten (of rtept als fallback) uit een GPX-bestand. */
export function parseGpx(tekst: string): [number, number][] {
  const doc = new DOMParser().parseFromString(tekst, "application/xml");

  if (doc.getElementsByTagName("parsererror").length > 0) return [];

  let punten = Array.from(doc.getElementsByTagName("trkpt"));
  if (punten.length === 0) {
    punten = Array.from(doc.getElementsByTagName("rtept"));
  }

  return punten
    .map((el): [number, number] => [
      parseFloat(el.getAttribute("lat") ?? ""),
      parseFloat(el.getAttribute("lon") ?? ""),
    ])
    .filter(([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon));
}

function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const [lat1, lon1] = a;
  const [lat2, lon2] = b;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const rLat1 = (lat1 * Math.PI) / 180;
  const rLat2 = (lat2 * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Totale afstand van een lijst [lat, lon]-punten, in km, afgerond op 1 decimaal. */
export function afstandKm(punten: [number, number][]): number {
  let totaal = 0;
  for (let i = 1; i < punten.length; i++) {
    totaal += haversineKm(punten[i - 1], punten[i]);
  }
  return Math.round(totaal * 10) / 10;
}

/** bv. 90 -> "ca. 1u30", 45 -> "ca. 45 min", 120 -> "ca. 2u" */
export function formatDuur(minuten: number | null): string {
  if (!minuten || minuten <= 0) return "";
  if (minuten < 60) return `ca. ${minuten} min`;

  const uren = Math.floor(minuten / 60);
  const rest = minuten % 60;
  return rest === 0 ? `ca. ${uren}u` : `ca. ${uren}u${String(rest).padStart(2, "0")}`;
}

/** Opent de gewone Google Maps-navigatie naar een punt. */
export function navigatieLink(lat: number, lon: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
}

/**
 * Verkleint een foto in de browser tot maximaal 1600px aan de langste zijde,
 * en zet ze om naar JPEG (kwaliteit 0,8). Foto's van een gsm zijn vaak groot,
 * en in het bos is er weinig bereik — kleinere foto's laden veel sneller.
 *
 * Gebruikt `createImageBitmap(..., { imageOrientation: "from-image" })` in
 * plaats van een gewoon `Image`-element: dat past de EXIF-draairichting van
 * de foto correct toe vóór het verkleinen. Zonder dit kon een staande
 * gsm-foto (sensor neemt liggend op, EXIF zegt "90° draaien") plat worden
 * getrokken, omdat het canvas dan op de ongedraaide (liggende) afmetingen
 * werd opgezet terwijl de browser de inhoud wél gedraaid tekende.
 */
export async function verkleinFoto(bestand: File): Promise<Blob> {
  const MAX = 1600;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(bestand, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Deze foto kon niet gelezen worden.");
  }

  try {
    let { width, height } = bitmap;
    if (width > height && width > MAX) {
      height = Math.round((height * MAX) / width);
      width = MAX;
    } else if (height >= width && height > MAX) {
      width = Math.round((width * MAX) / height);
      height = MAX;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Kon de foto niet verwerken.");

    ctx.drawImage(bitmap, 0, 0, width, height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Kon de foto niet verkleinen."));
        },
        "image/jpeg",
        0.8
      );
    });
  } finally {
    bitmap.close();
  }
}
