"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Activiteit = {
  id: string;
  titel: string;
  wanneer: string; // YYYY-MM-DD
  aantal_vrijwilligers: number | null;
  toelichting: string | null;

  // nieuw: gekoppelde klant
  klant_id: string | null;
  klanten?: { naam: string | null } | null;
};

type MeedoenRow = {
  activiteit_id: string;
  vrijwilliger_id: string;
  vrijwilligers: { naam: string | null } | { naam: string | null }[] | null;
};

const WEEKDAY_FMT = new Intl.DateTimeFormat("nl-BE", { weekday: "long" });
const DAY_MONTH_FMT = new Intl.DateTimeFormat("nl-BE", { day: "numeric", month: "short" });
const MONTH_HEADER_FMT = new Intl.DateTimeFormat("nl-BE", { month: "long", year: "numeric" });

function capitalize(s: string) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDatumKaart(dateStr: string) {
  const d = new Date(dateStr);
  const wd = capitalize(WEEKDAY_FMT.format(d));
  const dm = DAY_MONTH_FMT.format(d);
  return `${wd} ${dm}`;
}

function formatMaandTussentitel(dateStr: string) {
  const d = new Date(dateStr);
  return capitalize(MONTH_HEADER_FMT.format(d));
}

function monthKey(dateStr: string) {
  return dateStr.slice(0, 7); // YYYY-MM
}

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

function extractNaam(v: MeedoenRow["vrijwilligers"]): string | null {
  if (!v) return null;
  if (Array.isArray(v)) return v[0]?.naam ?? null;
  return v.naam ?? null;
}

export default function Activiteiten
