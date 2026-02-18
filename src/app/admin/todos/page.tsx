"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin } from "@/lib/auth";

type Vrijwilliger = { id: string; naam: string | null };

type Todo = {
  id: string;
  wat: string;
  wie_vrijwilliger_id: string;
  streefdatum: string | null; // YYYY-MM-DD
  status: "gepland" | "bezig" | "gedaan";
  prioriteit: "laag" | "normaal" | "hoog";
};

type BinnenDagSort = "prioriteit" | "persoon";

function prioRank(p: Todo["prioriteit"]) {
  if (p === "hoog") return 0;
  if (p === "normaal") return 1;
  return 2;
}

export default function AdminTodosPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const [todos, setTodos] = useState<Todo[]>([]);
  const [vrijwilligers, setVrijwilligers] = useState<Vrijwilliger[]>([]);

  const [filterUser, setFilterUser] = useState<string>("ALL");
  const [showDone, setShowDone] = useState(false);

  // ✅ secundaire sort binnen streefdatum
  const [binnenDagSort, setBinnenDagSort] = useState<BinnenDagSort>("prioriteit");

  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const naamById = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of vrijwilligers) m.set(v.id, v.naam ?? "(naam ontbreekt)");
    return m;
  }, [vrijwilligers]);

  const load = async () => {
    setLoading(true);
    setError(null);
    setMsg(null);

    const { data: sess } = await supabase.auth.getSession();
    const user = sess.session?.user;
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

    const { data: v, error: e1 } = await supabase
      .from("vrijwilligers")
      .select("id,naam")
      .order("naam", { ascending: true });

    if (e1) {
      setError(e1.message);
      setLoading(false);
      return;
    }

    let q = supabase
      .from("todos")
      .select("id,wat,wie_vrijwilliger_id,streefdatum,status,prioriteit");

    if (!showDone) q = q.neq("status", "gedaan");
    if (filterUser !== "ALL") q = q.eq("wie_vrijwilliger_id", filterUser);

    // DB order: streefdatum eerst (primair)
    q = q.order("streefdatum", { ascending: true, nullsFirst: false });

    const { data: t, error: e2 } = await q;

    if (e2) {
      setError(e2.message);
      setLoading(false);
      return;
    }

    setVrijwilligers((v ?? []) as Vrijwilliger[]);
    setTodos((t ?? []) as Todo[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterUser, showDone]);

  // ✅ primair altijd streefdatum, binnen dag keuze
  const sortedTodos = useMemo(() => {
    const arr = [...todos];

    arr.sort((a, b) => {
  // 1) altijd streefdatum primair (null onderaan)
  const ad = a.streefdatum ?? "9999-12-31";
  const bd = b.streefdatum ?? "9999-12-31";
  if (ad < bd) return -1;
  if (ad > bd) return 1;

  // 2) binnen dezelfde streefdatum: keuze
  if (binnenDagSort === "prioriteit") {
    // hoog -> normaal -> laag
    const rank = (p: Todo["prioriteit"]) => (p === "hoog" ? 0 : p === "normaal" ? 1 : 2);
    const pr = rank(a.prioriteit) - rank(b.prioriteit);
    if (pr !== 0) return pr;
  } else {
    // persoon A->Z
    const an = (naamById.get(a.wie_vrijwilliger_id) ?? "").toLowerCase();
    const bn = (naamById.get(b.wie_vrijwilliger_id) ?? "").toLowerCase();
    if (an < bn) return -1;
    if (an > bn) return 1;
  }

  // 3) tie-breakers (stabiel)
  const sr = (s: Todo["status"]) => (s === "gepland" ? 0 : s === "bezig" ? 1 : 2);
  const sdiff = sr(a.status) - sr(b.status);
  if (sdiff !== 0) return sdiff;

  return a.wat.localeCompare(b.wat);
});


    return arr;
  }, [todos, binnenDagSort, naamById]);

  const setStatus = async (id: string, status: Todo["status"]) => {
    setBusyId(id);
    setError(null);
    setMsg(null);

    const { error } = await supabase.from("todos").update({ status }).eq("id", id);

    if (error) setError(error.message);
    else setMsg("Status aangepast.");

    await load();
    setBusyId(null);
  };

  if (loading) return <main className="mx-auto max-w-3xl p-6 md:p-10">Laden…</main>;

  if (!allowed) {
    return (
      <main className="mx-auto max-w-3xl p-6 md:p-10">
        <h1 className="text-3xl font-semibold tracking-tight mb-2">TODO’s</h1>
        <p>Je hebt geen rechten om deze pagina te bekijken.</p>
      </main>
    );
  }

  const countOpen = todos.filter((t) => t.status !== "gedaan").length;
  const countDone = todos.filter((t) => t.status === "gedaan").length;

  return (
    <main className="mx-auto max-w-3xl p-6 md:p-10">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight mb-1">TODO’s</h1>
          <p className="text-gray-600">
            {showDone ? (
              <>
                Totaal: {todos.length} (open: {countOpen}, gedaan: {countDone})
              </>
            ) : (
              <>Open taken: {todos.length}</>
            )}
          </p>
        </div>

        <div className="flex gap-2">
          <button className="border rounded-xl px-3 py-2 text-sm" onClick={load}>
            Refresh
          </button>
          <a className="border rounded-xl px-3 py-2 text-sm" href="/admin/todos/toevoegen">
            + Toevoegen
          </a>
        </div>
      </div>

      {error && <p className="text-red-600 mb-4">Fout: {error}</p>}
      {msg && <p className="text-green-700 mb-4">{msg}</p>}

      <div className="border rounded-2xl p-4 bg-white/80 shadow-sm mb-4 space-y-3">
        <div>
          <label className="text-sm font-medium block mb-1">Filter op persoon</label>
          <select
            className="border rounded-xl px-3 py-2 text-sm w-full"
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
          >
            <option value="ALL">Iedereen</option>
            {vrijwilligers.map((v) => (
              <option key={v.id} value={v.id}>
                {v.naam ?? "(naam ontbreekt)"}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showDone}
              onChange={(e) => setShowDone(e.target.checked)}
            />
            Toon ook “gedaan”
          </label>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Binnen streefdatum:</span>
            <select
              className="border rounded-xl px-3 py-2 text-sm"
              value={binnenDagSort}
              onChange={(e) => setBinnenDagSort(e.target.value as BinnenDagSort)}
            >
              <option value="prioriteit">Prioriteit</option>
              <option value="persoon">Persoon</option>
            </select>
          </div>
        </div>

        <p className="text-xs text-gray-500">
          Sortering is altijd: <strong>streefdatum</strong> (vroegste bovenaan), daarna jouw keuze.
        </p>
      </div>

      {sortedTodos.length === 0 ? (
        <p className="text-gray-600">Geen TODO’s (volgens huidige filter).</p>
      ) : (
        <ul className="space-y-3">
          {sortedTodos.map((t) => {
            const busy = busyId === t.id;
            const naam = naamById.get(t.wie_vrijwilliger_id) ?? "(onbekend)";
            return (
              <li key={t.id} className="border rounded-2xl p-4 bg-white/80 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium">{t.wat}</div>
                    <div className="text-sm text-gray-600 mt-1">
                      Voor: {naam}
                      {" • "}
                      {t.streefdatum ? `Streefdatum: ${t.streefdatum}` : "Geen streefdatum"}
                      {" • "}
                      Prioriteit: {t.prioriteit}
                      {" • "}
                      Status: {t.status}
                    </div>
                  </div>

                  <a
                    className="border rounded-xl px-3 py-2 text-sm whitespace-nowrap"
                    href={`/admin/todos/${t.id}`}
                  >
                    Bewerken
                  </a>
                </div>

                <div className="flex gap-2 mt-3 flex-wrap">
                  <button
                    className="border rounded-xl px-3 py-2 text-sm"
                    onClick={() => setStatus(t.id, "gepland")}
                    disabled={busy || t.status === "gepland"}
                  >
                    Gepland
                  </button>
                  <button
                    className="border rounded-xl px-3 py-2 text-sm"
                    onClick={() => setStatus(t.id, "bezig")}
                    disabled={busy || t.status === "bezig"}
                  >
                    Bezig
                  </button>
                  <button
                    className="border rounded-xl px-3 py-2 text-sm"
                    onClick={() => setStatus(t.id, "gedaan")}
                    disabled={busy}
                  >
                    Gedaan
                  </button>

                  {busy && <span className="text-sm text-gray-500 self-center">Bezig…</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
