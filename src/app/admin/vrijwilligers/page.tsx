"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin } from "@/lib/auth";
import VrijwilligerDetail from "./VrijwilligerDetail";

type InteresseMini = { titel: string | null };
type RolMini = { titel: string | null };

type Vrijwilliger = {
  id: string;
  voornaam: string | null;
  achternaam: string | null;
  telefoon: string | null;
  adres: string | null;

  vrijwilliger_interesses:
    | { interesses: InteresseMini | InteresseMini[] | null }
    | { interesses: InteresseMini | InteresseMini[] | null }[]
    | null;

  vrijwilliger_roles:
    | { roles: RolMini | RolMini[] | null }
    | { roles: RolMini | RolMini[] | null }[]
    | null;
};

function norm(s: string) {
  return s.trim().toLowerCase();
}

function fullName(v: Vrijwilliger) {
  return [v.voornaam ?? "", v.achternaam ?? ""].join(" ").trim() || "—";
}

export default function VrijwilligersAdminPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [rows, setRows] = useState<Vrijwilliger[]>([]);
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  // 📥 data ophalen
  useEffect(() => {
    if (allowed !== true) return;

    let mounted = true;

    (async () => {
      setLoading(true);
      setErr(null);

      try {
        const { data, error } = await supabase
          .from("vrijwilligers")
          .select(`
            id,
            voornaam,
            achternaam,
            telefoon,
            adres,
            vrijwilliger_interesses(
              interesses(titel)
            ),
            vrijwilliger_roles!vr_vrijwilliger_fkey(
              roles(titel)
            )
          `)
          .order("achternaam", { ascending: true, nullsFirst: false })
          .order("voornaam", { ascending: true, nullsFirst: false });

        if (error) throw error;

        const list = (data ?? []) as Vrijwilliger[];

        if (!mounted) return;
        setRows(list);

        if (!selectedId && list.length) {
          setSelectedId(list[0].id);
        }
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

    return rows.filter((v) =>
      fullName(v).toLowerCase().includes(needle)
    );
  }, [q, rows]);

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId]
  );

  const updateLocal = (
    id: string,
    patch: { telefoon: string | null; adres: string | null }
  ) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
  };

  if (allowed === null) {
    return <main className="p-6">Laden…</main>;
  }

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
      <h1 className="text-xl font-semibold">Vrijwilligers</h1>

      {err && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-red-700">
          {err}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Lijst */}
        <div className="space-y-3">
          <input
            className="w-full border rounded-xl p-3"
            placeholder="Zoek vrijwilliger…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <div className="rounded-xl border divide-y">
            {loading ? (
              <div className="p-3 text-gray-600">Laden…</div>
            ) : filtered.length === 0 ? (
              <div className="p-3 text-gray-600">Geen resultaten</div>
            ) : (
              filtered.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedId(v.id)}
                  className={`w-full text-left p-3 hover:bg-gray-50 ${
                    selectedId === v.id ? "bg-gray-50" : ""
                  }`}
                >
                  <div className="font-medium">{fullName(v)}</div>
                  <div className="text-sm text-gray-600">
                    {v.telefoon ?? "—"}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Detail */}
        <div className="lg:col-span-2">
          {selected ? (
            <VrijwilligerDetail
              vrijwilliger={selected}
              onSaved={(patch) => updateLocal(selected.id, patch)}
            />
          ) : (
            <div className="rounded-xl border p-4 text-gray-600">
              Selecteer links een vrijwilliger.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}