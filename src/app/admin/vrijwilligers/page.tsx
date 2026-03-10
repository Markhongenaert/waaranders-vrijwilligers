"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin, isAdmin as checkIsAdmin } from "@/lib/auth";

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
  const [adminUser, setAdminUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [rows, setRows] = useState<Vrijwilliger[]>([]);
  const [q, setQ] = useState(initialQ);

  // 🔐 rechtencontrole
  useEffect(() => {
    let mounted = true;
    (async () => {
      const [ok, admin] = await Promise.all([isDoenkerOrAdmin(), checkIsAdmin()]);
      if (!mounted) return;
      setAllowed(ok);
      setAdminUser(admin);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // 📥 lijst ophalen
  useEffect(() => {
    if (allowed !== true) return;

    let mounted = true;
    (async () => {
      setLoading(true);
      setErr(null);

      try {
        const select = "id, voornaam, achternaam, telefoon, adres, actief";
        const order = { ascending: true, nullsFirst: false } as const;

        const { data, error } = await supabase
          .from("vrijwilligers")
          .select(select)
          .eq("actief", true)
          .order("achternaam", order)
          .order("voornaam", order);

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
  }, [allowed, adminUser]);

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
        <div className="wa-alert-error">
          Geen toegang.
        </div>
      </main>
    );
  }

  return (
    <main className="p-5 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Vrijwilligers</h1>
      </div>

      {err && (
        <div className="wa-alert-error">
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
            const gearchiveerd = v.actief === false;

            return (
              <a
                key={v.id}
                href={href}
                className="wa-card wa-neutral-card h-28 sm:h-24 flex flex-col justify-center hover:shadow-md hover:-translate-y-0.5 active:scale-95 transition duration-150 px-4"
              >
                <div className={`text-base sm:text-sm font-semibold leading-snug ${gearchiveerd ? "text-gray-400" : "text-gray-800"}`}>
                  {name}
                </div>

                {gearchiveerd && (
                  <div className="text-xs font-medium text-gray-400 mt-0.5">Gearchiveerd</div>
                )}
              </a>
            );
          })}
        </div>
      )}
    </main>
  );
}