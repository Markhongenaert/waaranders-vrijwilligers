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

  // Let op: supabase kan relationele velden als object of array teruggeven (afhankelijk van je select)
  vrijwilliger_interesses:
    | { interesses: InteresseMini | InteresseMini[] | null }
    | { interesses: InteresseMini | InteresseMini[] | null }[]
    | null;

  vrijwilliger_roles:
    | { roles: RolMini | RolMini[] | null; rollen?: RolMini | RolMini[] | null }
    | { roles: RolMini | RolMini[] | null; rollen?: RolMini | RolMini[] | null }[]
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

  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Vrijwilliger[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 1) auth check
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const ok = await isDoenkerOrAdmin();
        if (!mounted) return;
        setAllowed(ok);
      } catch {
        if (!mounted) return;
        setAllowed(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // 2) fetch data
  useEffect(() => {
    if (allowed !== true) return;

    let mounted = true;
    (async () => {
      setLoading(true);
      setErr(null);

      try {
        // PAS HIER AAN als jouw relation names anders zijn:
        // - vrijwilliger_roles(... roles(titel)) kan bij jou rollen(titel) zijn.
        const { data, error } = await supabase
          .from("vrijwilligers")
          .select(
            `
            id,
            voornaam,
            achternaam,
            telefoon,
            adres,
            vrijwilliger_interesses(
              interesses(titel)
            ),
            vrijwilliger_roles(
              roles(titel),
              rollen(titel)
            )
          `
          )
          .order("achternaam", { ascending: true, nullsFirst: false })
          .order("voornaam", { ascending: true, nullsFirst: false });

        if (error) throw error;

        const list = (data ?? []) as Vrijwilliger[];
        if (!mounted) return;

        setRows(list);
        // auto-select eerste (handig)
        if (!selectedId && list.length) setSelectedId(list[0].id);
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message ?? "Onbekende fout bij laden.");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed]);

  const filtered = useMemo(() => {
    const needle = norm(q);
    if (!needle) return rows;

    return rows.filter((v) => {
      const a = norm(v.achternaam ?? "");
      const b = norm(v.voornaam ?? "");
      const c = norm(fullName(v));
      return a.includes(needle) || b.includes(needle) || c.includes(needle);
    });
  }, [q, rows]);

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId]
  );

  const updateLocal = (id: string, patch: Partial<Vrijwilliger>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  if (allowed === false) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-800">
          Geen toegang. (Alleen Doenkers/Admin)
        </div>
      </div>
    );
  }

  if (allowed === null) {
    return <div className="p-6">Toegang controleren…</div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Vrijwilligers</h1>
        <a className="border rounded-xl px-4 py-2" href="/admin">
          Terug
        </a>
      </div>

      {err && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-red-700">
          {err}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT: lijst */}
        <div className="lg:col-span-1 space-y-3">
          <input
            className="w-full border rounded-xl p-3"
            placeholder="Zoek op voornaam / achternaam…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <div className="rounded-xl border overflow-hidden">
            {loading ? (
              <div className="p-4 text-gray-600">Laden…</div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-gray-600">Geen resultaten.</div>
            ) : (
              <ul className="divide-y">
                {filtered.map((v) => {
                  const active = v.id === selectedId;
                  return (
                    <li key={v.id}>
                      <button
                        className={[
                          "w-full text-left p-3 hover:bg-gray-50",
                          active ? "bg-gray-50" : "",
                        ].join(" ")}
                        onClick={() => setSelectedId(v.id)}
                      >
                        <div className="font-medium">{fullName(v)}</div>
                        <div className="text-sm text-gray-600">
                          {v.telefoon ? v.telefoon : "—"}{" "}
                          {v.adres ? "• " + v.adres : ""}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* RIGHT: detail */}
        <div className="lg:col-span-2">
          {selected ? (
            <VrijwilligerDetail
              vrijwilliger={selected}
              onSaved={(patch) => updateLocal(selected.id, patch)}
            />
          ) : (
            <div className="rounded-xl border p-4 text-gray-600">
              Kies links een vrijwilliger.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}