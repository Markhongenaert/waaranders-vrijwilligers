"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin } from "@/lib/auth";

type Vrijwilliger = {
  id: string;
  voornaam: string | null;
  achternaam: string | null;
  telefoon: string | null;
  adres: string | null;
  actief: boolean | null;
};

function norm(s: string) {
  return (s ?? "").trim().toLowerCase();
}

function fullName(v: Vrijwilliger) {
  return [v.voornaam ?? "", v.achternaam ?? ""].join(" ").trim() || "—";
}

export default function VrijwilligersOverzichtPage() {
  const searchParams = useSearchParams();
  const initialQ = (searchParams.get("q") ?? "").trim();

  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [rows, setRows] = useState<Vrijwilliger[]>([]);
  const [q, setQ] = useState(initialQ);

  // 🔐 rechtencontrole
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

  // 📥 lijst ophalen (enkel actieve)
  useEffect(() => {
    if (allowed !== true) return;

    let mounted = true;
    (async () => {
      setLoading(true);
      setErr(null);

      try {
        const { data, error } = await supabase
          .from("vrijwilligers")
          .select("id, voornaam, achternaam, telefoon, adres, actief")
          .eq("actief", true)
          .order("achternaam", { ascending: true, nullsFirst: false })
          .order("voornaam", { ascending: true, nullsFirst: false });

        if (error) throw error;

        if (!mounted) return;
        setRows((data ?? []) as Vrijwilliger[]);
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message ?? "Fout bij laden.");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [allowed]);

  // 🔎 filter (voornaam, achternaam, full name)
  const filtered = useMemo(() => {
    const needle = norm(q);
    if (!needle) return rows;

    return rows.filter((v) => {
      const fn = norm(v.voornaam ?? "");
      const an = norm(v.achternaam ?? "");
      const full = norm(fullName(v));
      return fn.includes(needle) || an.includes(needle) || full.includes(needle);
    });
  }, [q, rows]);

  // 🔗 in detail-link nemen we de zoekterm mee zodat "Terug" klopt
  const qParam = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";

  if (allowed === null) return <main className="p-6">Laden…</main>;

  if (allowed === false) {
    return (
      <main className="p-6">
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-800">
          Geen toegang.
        </div>
      </main>
    );
  }

  return (
    <main className="p-5 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Vrijwilligers</h1>
        <a className="border rounded-xl px-4 py-2" href="/admin">
          Terug naar Beheer
        </a>
      </div>

      {err && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-red-700">
          {err}
        </div>
      )}

      <input
        className="w-full border rounded-xl p-3"
        placeholder="Zoek op voornaam/achternaam…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {loading ? (
        <div className="text-gray-600">Laden…</div>
      ) : filtered.length === 0 ? (
        <div className="text-gray-600">Geen resultaten.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
          {filtered.map((v) => {
            const name = fullName(v);
            const href = `/admin/vrijwilligers/${v.id}${qParam}`;

            return (
              <a
                key={v.id}
                href={href}
                className="
                  h-28 sm:h-24
                  flex flex-col justify-center
                  rounded-xl
                  bg-blue-50
                  border border-blue-100
                  shadow-sm
                  hover:shadow-md
                  hover:-translate-y-0.5
                  active:scale-95
                  transition
                  duration-150
                  px-4
                "
              >
                <div className="text-base sm:text-sm font-semibold text-gray-800 leading-snug">
                  {name}
                </div>

                <div className="text-xs text-gray-600 mt-1 truncate">
                  {v.telefoon ? v.telefoon : "—"}
                  {v.adres ? ` • ${v.adres}` : ""}
                </div>
              </a>
            );
          })}
        </div>
      )}
    </main>
  );
}