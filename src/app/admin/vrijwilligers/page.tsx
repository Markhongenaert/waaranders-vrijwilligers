"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin } from "@/lib/auth";

type Vrijwilliger = {
  id: string;
  voornaam: string | null;
  achternaam: string | null;
  telefoon: string | null;
  adres: string | null;
};

function norm(s: string) {
  return (s ?? "").trim().toLowerCase();
}

function fullName(v: Vrijwilliger) {
  return [v.voornaam ?? "", v.achternaam ?? ""].join(" ").trim() || "—";
}

export default function VrijwilligersOverzichtPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [rows, setRows] = useState<Vrijwilliger[]>([]);
  const [q, setQ] = useState("");

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

  // 📥 lijst ophalen (licht: enkel velden nodig voor tegels)
  useEffect(() => {
    if (allowed !== true) return;

    let mounted = true;
    (async () => {
      setLoading(true);
      setErr(null);

      try {
        const { data, error } = await supabase
          .from("vrijwilligers")
          .select("id, voornaam, achternaam, telefoon, adres")
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

  const filtered = useMemo(() => {
    const needle = norm(q);
    if (!needle) return rows;
    return rows.filter((v) => norm(fullName(v)).includes(needle));
  }, [q, rows]);

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
    <main className="p-6 space-y-4">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((v) => {
            const name = fullName(v);
            const href = `/admin/vrijwilligers/${v.id}?q=${encodeURIComponent(
              q.trim()
            )}`;

            return (
              <a
                key={v.id}
                href={href}
                className="border rounded-2xl p-5 hover:bg-gray-50 hover:shadow-sm transition"
              >
                <div className="text-lg font-semibold">{name}</div>
                <div className="text-sm text-gray-600 mt-1">
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