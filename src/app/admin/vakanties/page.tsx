"use client";

import { useEffect, useState } from "react";
import { isDoenkerOrAdmin } from "@/lib/auth";
import { loadVakantieData } from "./actions";
import InvoerenTab from "./_components/InvoerenTab";
import KalenderTab from "./_components/KalenderTab";

export type Doenker = {
  id: string;
  voornaam: string | null;
  achternaam: string | null;
};

export type VakantiePerio = {
  id: string;
  vrijwilliger_id: string;
  begin_datum: string; // "YYYY-MM-DD"
  eind_datum: string;  // "YYYY-MM-DD"
};

export default function VakantiesPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"invoeren" | "kalender">("invoeren");
  const [doenkers, setDoenkers] = useState<Doenker[]>([]);
  const [perioden, setPerioden] = useState<VakantiePerio[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const ok = await isDoenkerOrAdmin();
      if (!mounted) return;
      setAllowed(ok);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    setErr(null);
    const result = await loadVakantieData();
    if (result.error) {
      setErr(result.error);
    } else {
      setDoenkers(result.doenkers);
      setPerioden(result.perioden);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (allowed !== true) return;
    loadData();
  }, [allowed]);

  if (allowed === null) return <main className="p-6">Laden…</main>;

  if (allowed === false) {
    return (
      <main className="p-6">
        <div className="wa-alert-error">Geen toegang.</div>
      </main>
    );
  }

  return (
    <main className="p-5 sm:p-6 space-y-4">
      <h1 className="text-xl font-semibold">Vakanties</h1>

      {err && <div className="wa-alert-error">{err}</div>}

      {/* Tabbladen */}
      <div className="flex border-b border-gray-200">
        {(["invoeren", "kalender"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "invoeren" ? "Vakanties invoeren" : "Kalender"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-gray-600">Laden…</div>
      ) : tab === "invoeren" ? (
        <InvoerenTab doenkers={doenkers} perioden={perioden} onRefresh={loadData} />
      ) : (
        <KalenderTab doenkers={doenkers} perioden={perioden} />
      )}
    </main>
  );
}
