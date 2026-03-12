"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin } from "@/lib/auth";
import { formatDagMaand } from "@/lib/dateHelpers";

type Todo = {
  id: string;
  wat: string;
  wie_vrijwilliger_id: string;
  streefdatum: string | null; // YYYY-MM-DD
  prioriteit: "laag" | "normaal" | "hoog";
  status: "gepland" | "bezig" | "gedaan";
};

type Vrijwilliger = {
  id: string;
  naam: string | null;
  actief?: boolean | null;
};


function isOverdue(dateStr: string | null, status: Todo["status"]) {
  if (!dateStr || status === "gedaan") return false;
  const today = new Date().toISOString().slice(0, 10);
  return dateStr < today;
}

function TodoCard({
  t,
  overdue,
  onSetStatus,
  editHref,
}: {
  t: Todo;
  overdue: boolean;
  onSetStatus: (id: string, status: Todo["status"]) => void;
  editHref: string;
}) {
  return (
    <li
      className={`wa-card p-4 flex flex-col ${overdue ? "bg-white border-2 border-red-500" : ""}`}
    >
      {/* Titel – volle breedte */}
      <div className="font-medium text-base break-words leading-snug">{t.wat}</div>

      {/* Onderste sectie */}
      <div className="mt-4 border-t pt-3 space-y-2">
        {/* Dringend-badge op aparte regel, alleen bij hoge prioriteit */}
        {t.prioriteit?.toLowerCase() === "hoog" && (
          <div>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold border border-red-500 text-red-700 bg-white">
              Dringend
            </span>
          </div>
        )}

        {/* Datum links — Bewerken midden — Vinkje rechts */}
        <div className="flex items-center justify-between gap-2">
          {t.streefdatum ? (
            <span className={`px-2 py-0.5 rounded-full border text-xs ${overdue ? "bg-white text-red-700 font-bold border-red-300" : ""}`}>
              {formatDagMaand(t.streefdatum!)}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full border text-xs text-gray-500">geen datum</span>
          )}

          <a href={editHref} className="text-sm text-blue-900 font-medium hover:underline">
            Bewerken
          </a>

          {t.status !== "gedaan" ? (
            <button
              onClick={() => onSetStatus(t.id, "gedaan")}
              className="px-2 py-0.5 rounded-full border border-green-500 text-green-700 text-xs font-semibold bg-white hover:bg-green-50 transition"
              title="Markeer als gedaan"
            >
              ✓
            </button>
          ) : (
            <button
              onClick={() => onSetStatus(t.id, "gepland")}
              className="rounded-full w-9 h-9 flex items-center justify-center bg-gray-200 text-gray-800 text-lg hover:bg-gray-300 transition"
              title="Terug naar gepland"
            >
              ↩
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

export default function AdminTodosPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const [items, setItems] = useState<Todo[]>([]);
  const [vrijwilligers, setVrijwilligers] = useState<Vrijwilliger[]>([]);

  const [showDone, setShowDone] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("alle");

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

    // Alleen actieve vrijwilligers in de selector
    const { data: v, error: eV } = await supabase
      .from("vrijwilligers")
      .select("id,naam,actief")
      .eq("actief", true)
      .order("naam", { ascending: true });

    if (eV) {
      setError(eV.message);
      setLoading(false);
      return;
    }

    const { data: t, error: eT } = await supabase
      .from("todos")
      .select("id,wat,wie_vrijwilliger_id,streefdatum,prioriteit,status");

    if (eT) {
      setError(eT.message);
      setLoading(false);
      return;
    }

    const activeVrijwilligers = (v ?? []) as Vrijwilliger[];
    setVrijwilligers(activeVrijwilligers);
    setItems((t ?? []) as Todo[]);

    // Safety net: als geselecteerde persoon niet meer actief is -> terug naar "Iedereen"
    const activeIds = new Set(activeVrijwilligers.map((x) => x.id));
    setSelectedUserId((prev) => (prev !== "alle" && !activeIds.has(prev) ? "alle" : prev));

    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const naamById = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of vrijwilligers) map.set(v.id, v.naam ?? "");
    return map;
  }, [vrijwilligers]);

  const filtered = useMemo(() => {
    let arr = [...items];
    if (!showDone) arr = arr.filter((t) => t.status !== "gedaan");
    if (selectedUserId !== "alle") arr = arr.filter((t) => t.wie_vrijwilliger_id === selectedUserId);
    return arr;
  }, [items, showDone, selectedUserId]);

  const sortByDateAsc = (a: Todo, b: Todo) => {
    const ad = a.streefdatum ?? "9999-12-31";
    const bd = b.streefdatum ?? "9999-12-31";
    if (ad < bd) return -1;
    if (ad > bd) return 1;
    return a.wat.localeCompare(b.wat);
  };

  const groupedByPerson = useMemo(() => {
    if (selectedUserId !== "alle") return [];

    const map = new Map<string, Todo[]>();
    for (const t of filtered) {
      const uid = t.wie_vrijwilliger_id;
      if (!map.has(uid)) map.set(uid, []);
      map.get(uid)!.push(t);
    }

    const groups = Array.from(map.entries()).map(([uid, todos]) => ({
      uid,
      naam: naamById.get(uid) || "(onbekend)",
      todos: todos.sort(sortByDateAsc),
    }));

    groups.sort((a, b) => a.naam.localeCompare(b.naam));
    return groups;
  }, [filtered, selectedUserId, naamById]);

  const flatSorted = useMemo(() => {
    if (selectedUserId === "alle") return [];
    const arr = [...filtered];
    arr.sort(sortByDateAsc);
    return arr;
  }, [filtered, selectedUserId]);

  const setStatus = async (id: string, status: Todo["status"]) => {
    setError(null);
    const { error } = await supabase.from("todos").update({ status }).eq("id", id);
    if (error) setError(error.message);
    await load();
  };

  if (loading) return <main className="mx-auto max-w-3xl p-6 md:p-10">Laden…</main>;

  if (!allowed) {
    return (
      <main className="mx-auto max-w-3xl p-6 md:p-10">
        <p>Je hebt geen toegang.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-6 md:p-10">
      <div className="flex items-start justify-between gap-4 mb-4">
        <h1 className="text-3xl font-semibold tracking-tight mb-1">Todo’s</h1>
        <a href="/admin/todos/toevoegen" className="wa-btn-action px-3 py-2 text-sm text-center">
          Todo toevoegen
        </a>
      </div>

      <div className="flex flex-col gap-2 mb-4">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium" htmlFor="persoon-select">
            Van wie wil je todo&apos;s zien?
          </label>
          <select
            id="persoon-select"
            className="border rounded-xl px-3 py-2 text-sm"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
          >
            <option value="alle">Iedereen</option>
            {vrijwilligers.map((v) => (
              <option key={v.id} value={v.id}>
                {v.naam ?? "(naam ontbreekt)"}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
          Toon ook gedaan
        </label>
      </div>

      {error && <p className="text-red-600 mb-4">Fout: {error}</p>}

      {selectedUserId === "alle" ? (
        groupedByPerson.length === 0 ? (
          <p className="text-gray-600">Geen TODO’s.</p>
        ) : (
          <div className="space-y-8">
            {groupedByPerson.map((g) => (
              <section key={g.uid}>
                <h2 className="text-lg wa-section-header px-3 py-2 -mx-2 sticky top-0 z-10">
                  {g.naam}
                </h2>

                <ul className="space-y-3 mt-3">
                  {g.todos.map((t) => {
                    const overdue = isOverdue(t.streefdatum, t.status);
                    return (
                      <TodoCard
                        t={t}
                        overdue={overdue}
                        onSetStatus={setStatus}
                        editHref={`/admin/todos/${t.id}`}
                      />
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )
      ) : flatSorted.length === 0 ? (
        <p className="text-gray-600">Geen TODO’s.</p>
      ) : (
        <ul className="space-y-3">
          {flatSorted.map((t) => {
            const overdue = isOverdue(t.streefdatum, t.status);
            return (
              <TodoCard
                t={t}
                overdue={overdue}
                onSetStatus={setStatus}
                editHref={`/admin/todos/${t.id}`}
              />
            );
          })}
        </ul>
      )}
    </main>
  );
}