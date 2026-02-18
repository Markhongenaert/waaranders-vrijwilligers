"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin } from "@/lib/auth";

type Todo = {
  id: string;
  wat: string;
  wie_vrijwilliger_id: string;
  streefdatum: string | null;
  prioriteit: "laag" | "normaal" | "hoog";
  status: "gepland" | "bezig" | "gedaan";
};

type Vrijwilliger = {
  id: string;
  naam: string | null;
};

function formatTodoDatum(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}
function prioBadge(p: Todo["prioriteit"]) {
  if (p === "hoog") return "bg-red-600 text-white";
  if (p === "normaal") return "bg-amber-500 text-white";
  return "bg-gray-200 text-gray-800";
}

function statusBadge(s: Todo["status"]) {
  if (s === "gedaan") return "bg-green-600 text-white";
  if (s === "bezig") return "bg-blue-600 text-white";
  return "bg-gray-100 text-gray-800";
}

function isOverdue(dateStr: string | null, status: Todo["status"]) {
  if (!dateStr) return false;
  if (status === "gedaan") return false;
  const today = new Date().toISOString().slice(0, 10);
  return dateStr < today; // date strings YYYY-MM-DD vergelijken werkt
}


export default function AdminTodosPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const [items, setItems] = useState<Todo[]>([]);
  const [vrijwilligers, setVrijwilligers] = useState<Vrijwilliger[]>([]);

  const [showDone, setShowDone] = useState(false);
  const [binnenDagSort, setBinnenDagSort] =
    useState<"prioriteit" | "persoon">("prioriteit");

  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);

    const { data } = await supabase.auth.getSession();
    const user = data.session?.user ?? null;
    if (!user) {
      window.location.href = "/login";
      return;
    }

    const ok = await isDoenkerOrAdmin();
    setAllowed(ok);
    if (!ok) {
      setLoading(false);
      return;
    }

    const { data: t, error: e1 } = await supabase
      .from("todos")
      .select("id,wat,wie_vrijwilliger_id,streefdatum,prioriteit,status");

    if (e1) {
      setError(e1.message);
      setLoading(false);
      return;
    }

    const { data: v } = await supabase
      .from("vrijwilligers")
      .select("id,naam");

    setItems((t ?? []) as Todo[]);
    setVrijwilligers((v ?? []) as Vrijwilliger[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const naamById = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of vrijwilligers) {
      map.set(v.id, v.naam ?? "");
    }
    return map;
  }, [vrijwilligers]);

  const sorted = useMemo(() => {
    let arr = [...items];

    if (!showDone) {
      arr = arr.filter((t) => t.status !== "gedaan");
    }

    arr.sort((a, b) => {
      const ad = a.streefdatum ?? "9999-12-31";
      const bd = b.streefdatum ?? "9999-12-31";

      if (ad < bd) return -1;
      if (ad > bd) return 1;

      if (binnenDagSort === "prioriteit") {
        const rank = (p: Todo["prioriteit"]) =>
          p === "hoog" ? 0 : p === "normaal" ? 1 : 2;
        return rank(a.prioriteit) - rank(b.prioriteit);
      } else {
        const an = (naamById.get(a.wie_vrijwilliger_id) ?? "").toLowerCase();
        const bn = (naamById.get(b.wie_vrijwilliger_id) ?? "").toLowerCase();
        return an.localeCompare(bn);
      }
    });

    return arr;
  }, [items, showDone, binnenDagSort, naamById]);

  const setStatus = async (id: string, status: Todo["status"]) => {
    await supabase.from("todos").update({ status }).eq("id", id);
    load();
  };

  if (loading)
    return <main className="mx-auto max-w-3xl p-6 md:p-10">Laden…</main>;

  if (!allowed)
    return (
      <main className="mx-auto max-w-3xl p-6 md:p-10">
        Geen toegang.
      </main>
    );

  return (
    <main className="mx-auto max-w-3xl p-6 md:p-10">
      <h1 className="text-2xl bg-blue-900 text-white font-bold px-4 py-2 rounded-xl mb-4">
        TODO’s
      </h1>

      <div className="flex gap-4 flex-wrap mb-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showDone}
            onChange={(e) => setShowDone(e.target.checked)}
          />
          Toon ook gedaan
        </label>

        <select
          className="border rounded-xl px-3 py-1 text-sm"
          value={binnenDagSort}
          onChange={(e) =>
            setBinnenDagSort(e.target.value as "prioriteit" | "persoon")
          }
        >
          <option value="prioriteit">Binnen dag: prioriteit</option>
          <option value="persoon">Binnen dag: persoon</option>
        </select>

        <a
          href="/admin/todos/toevoegen"
          className="border rounded-xl px-3 py-1 text-sm"
        >
          + Toevoegen
        </a>
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {sorted.length === 0 ? (
        <p className="text-gray-600">Geen TODO’s.</p>
      ) : (
        <ul className="space-y-3">
          {sorted.map((t) => (
            <li
              key={t.id}
              className="border rounded-2xl p-4 bg-white/80 shadow-sm"
            >
              <div className="flex justify-between gap-4">
                <div>
                  <div className="font-medium">{t.wat}</div>
<div className="text-sm text-gray-600 mt-2 flex flex-wrap gap-2 items-center">
  {t.streefdatum && (
    <span className="px-2 py-0.5 rounded-full border text-xs">
      {formatTodoDatum(t.streefdatum)}
    </span>
  )}

  <span className="px-2 py-0.5 rounded-full border text-xs">
    {naamById.get(t.wie_vrijwilliger_id) || "(onbekend)"}
  </span>

  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${prioBadge(t.prioriteit)}`}>
    {t.prioriteit}
  </span>

  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge(t.status)}`}>
    {t.status}
  </span>

  {isOverdue(t.streefdatum, t.status) && (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
      verlopen
    </span>
  )}
</div>


                <div className="flex gap-2">
                  <a
                    href={`/admin/todos/${t.id}`}
                    className="border rounded-xl px-3 py-1 text-sm"
                  >
                    Bewerken
                  </a>
                  <button
                    onClick={() => setStatus(t.id, "gedaan")}
                    className="border rounded-xl px-3 py-1 text-sm"
                  >
                    ✔
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
