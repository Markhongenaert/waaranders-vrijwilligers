"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin } from "@/lib/auth";

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
  if (s === "bezig") return "bg-blue-900 text-white";
  return "bg-gray-100 text-gray-800";
}

function isOverdue(dateStr: string | null, status: Todo["status"]) {
  if (!dateStr) return false;
  if (status === "gedaan") return false;
  const today = new Date().toISOString().slice(0, 10);
  return dateStr < today;
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

    // ✅ Alleen actieve vrijwilligers in de selector
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

    // ✅ Safety net: als geselecteerde persoon niet meer actief is -> terug naar "Iedereen"
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
    if (selectedUserId !== "alle") {
      arr = arr.filter((t) => t.wie_vrijwilliger_id === selectedUserId);
    }
    return arr;
  }, [items, showDone, selectedUserId]);

  // Helpers voor sort: datum dichtsbij eerst, null onderaan
  const sortByDateAsc = (a: Todo, b: Todo) => {
    const ad = a.streefdatum ?? "9999-12-31";
    const bd = b.streefdatum ?? "9999-12-31";
    if (ad < bd) return -1;
    if (ad > bd) return 1;
    return a.wat.localeCompare(b.wat);
  };

  // Group view wanneer "alle"
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
      <div className="bg-blue-900 text-white font-bold px-4 py-2 rounded-xl mb-4">
        TODO’s (beheer)
      </div>

      <div className="flex gap-3 flex-wrap mb-4 items-center">
        <select
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

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showDone}
            onChange={(e) => setShowDone(e.target.checked)}
          />
          Toon ook gedaan
        </label>

        <a href="/admin/todos/toevoegen" className="border rounded-xl px-3 py-2 text-sm">
          + Toevoegen
        </a>

        <button className="border rounded-xl px-3 py-2 text-sm" onClick={load}>
          Refresh
        </button>
      </div>

      {error && <p className="text-red-600 mb-4">Fout: {error}</p>}

      {/* Weergave */}
      {selectedUserId === "alle" ? (
        groupedByPerson.length === 0 ? (
          <p className="text-gray-600">Geen TODO’s.</p>
        ) : (
          <div className="space-y-8">
            {groupedByPerson.map((g) => (
              <section key={g.uid}>
                <h2 className="text-lg bg-blue-100 text-black font-semibold px-3 py-2 -mx-2 sticky top-0 z-10">
                  {g.naam}
                </h2>

                <ul className="space-y-3 mt-3">
                  {g.todos.map((t) => {
                    const overdue = isOverdue(t.streefdatum, t.status);

                    return (
                      <li key={t.id} className="border rounded-2xl p-4 bg-white/80 shadow-sm">
                        <div className="flex justify-between gap-4">
                          <div className="min-w-0">
                            <div className="font-medium break-words">{t.wat}</div>

                            <div className="text-sm text-gray-600 mt-2 flex flex-wrap gap-2 items-center">
                              {t.streefdatum ? (
                                <span
                                  className={`px-2 py-0.5 rounded-full border text-xs ${
                                    overdue ? "text-red-700 font-bold" : ""
                                  }`}
                                >
                                  {formatTodoDatum(t.streefdatum)}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full border text-xs text-gray-500">
                                  geen datum
                                </span>
                              )}

                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-semibold ${prioBadge(
                                  t.prioriteit
                                )}`}
                              >
                                {t.prioriteit}
                              </span>

                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge(
                                  t.status
                                )}`}
                              >
                                {t.status}
                              </span>
                            </div>
                          </div>

                          <div className="flex gap-2 shrink-0 items-start">
                            <a
                              href={`/admin/todos/${t.id}`}
                              className="border rounded-xl px-3 py-2 text-sm"
                            >
                              Bewerken
                            </a>

                            {t.status !== "gedaan" ? (
                              <button
                                onClick={() => setStatus(t.id, "gedaan")}
                                className="border rounded-xl px-3 py-2 text-sm"
                                title="Markeer als gedaan"
                              >
                                ✔
                              </button>
                            ) : (
                              <button
                                onClick={() => setStatus(t.id, "gepland")}
                                className="border rounded-xl px-3 py-2 text-sm"
                                title="Terug naar gepland"
                              >
                                ↩
                              </button>
                            )}
                          </div>
                        </div>
                      </li>
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
              <li key={t.id} className="border rounded-2xl p-4 bg-white/80 shadow-sm">
                <div className="flex justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium break-words">{t.wat}</div>

                    <div className="text-sm text-gray-600 mt-2 flex flex-wrap gap-2 items-center">
                      {t.streefdatum ? (
                        <span
                          className={`px-2 py-0.5 rounded-full border text-xs ${
                            overdue ? "text-red-700 font-bold" : ""
                          }`}
                        >
                          {formatTodoDatum(t.streefdatum)}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full border text-xs text-gray-500">
                          geen datum
                        </span>
                      )}

                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${prioBadge(
                          t.prioriteit
                        )}`}
                      >
                        {t.prioriteit}
                      </span>

                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge(
                          t.status
                        )}`}
                      >
                        {t.status}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 shrink-0 items-start">
                    <a
                      href={`/admin/todos/${t.id}`}
                      className="border rounded-xl px-3 py-2 text-sm"
                    >
                      Bewerken
                    </a>

                    {t.status !== "gedaan" ? (
                      <button
                        onClick={() => setStatus(t.id, "gedaan")}
                        className="border rounded-xl px-3 py-2 text-sm"
                        title="Markeer als gedaan"
                      >
                        ✔
                      </button>
                    ) : (
                      <button
                        onClick={() => setStatus(t.id, "gepland")}
                        className="border rounded-xl px-3 py-2 text-sm"
                        title="Terug naar gepland"
                      >
                        ↩
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}