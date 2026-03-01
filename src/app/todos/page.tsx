"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin } from "@/lib/auth";

type Todo = {
  id: string;
  wat: string;
  streefdatum: string | null; // YYYY-MM-DD
  status: "gepland" | "bezig" | "gedaan";
  prioriteit: "laag" | "normaal" | "hoog";
  thema_id: string | null;
};

function formatTodoDatum(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, "0")}/${String(
    d.getMonth() + 1
  ).padStart(2, "0")}`;
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
  if (!dateStr || status === "gedaan") return false;
  const today = new Date().toISOString().slice(0, 10);
  return dateStr < today;
}

export default function TodosPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Todo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [canBeheer, setCanBeheer] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    setMsg(null);

    const { data: sess } = await supabase.auth.getSession();
    const user = sess.session?.user ?? null;

    if (!user) {
      window.location.href = "/login";
      return;
    }

    setCanBeheer(await isDoenkerOrAdmin());

    const { data, error } = await supabase
      .from("todos")
      .select("id,wat,streefdatum,status,prioriteit,thema_id")
      .eq("wie_vrijwilliger_id", user.id)
      .neq("status", "gedaan")
      .order("streefdatum", { ascending: true, nullsFirst: false });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setItems((data ?? []) as Todo[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setStatus = async (id: string, status: Todo["status"]) => {
    setError(null);
    setMsg(null);

    const { error } = await supabase
      .from("todos")
      .update({ status })
      .eq("id", id);

    if (error) {
      setError(error.message);
    } else {
      setMsg("Status aangepast.");
      await load();
    }
  };

  const sorted = useMemo(() => {
    const arr = [...items];

    arr.sort((a, b) => {
      const ad = a.streefdatum ?? "9999-12-31";
      const bd = b.streefdatum ?? "9999-12-31";

      if (ad < bd) return -1;
      if (ad > bd) return 1;

      const rank = (p: Todo["prioriteit"]) =>
        p === "hoog" ? 0 : p === "normaal" ? 1 : 2;

      const pr = rank(a.prioriteit) - rank(b.prioriteit);
      if (pr !== 0) return pr;

      return a.wat.localeCompare(b.wat);
    });

    return arr;
  }, [items]);

  return (
    <main className="mx-auto max-w-3xl p-6 md:p-10">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h1 className="text-2xl bg-blue-900 text-white font-bold px-4 py-2 rounded-xl">
            Mijn TODO’s
          </h1>
          <p className="text-gray-600 mt-2">
            Open taken (status niet “gedaan”).
          </p>
        </div>

        {canBeheer && (
          <a
            href="/admin/todos/toevoegen"
            className="border rounded-xl px-3 py-2 text-sm"
          >
            + Toevoegen
          </a>
        )}
      </div>

      {error && <p className="text-red-600 mb-4">Fout: {error}</p>}
      {msg && <p className="text-green-700 mb-4">{msg}</p>}

      {loading ? (
        <p>Laden…</p>
      ) : sorted.length === 0 ? (
        <p className="text-gray-600">Geen open TODO’s 🎉</p>
      ) : (
        <ul className="space-y-3">
          {sorted.map((t) => {
            const overdue = isOverdue(t.streefdatum, t.status);

            return (
              <li
                key={t.id}
                className={`border rounded-2xl p-4 bg-white shadow-sm flex flex-col ${
                  overdue ? "border-red-500" : ""
                }`}
              >
                {/* Titel */}
                <div className="font-medium text-base break-words leading-snug">
                  {t.wat}
                </div>

                {/* Badges */}
                <div className="text-sm text-gray-600 mt-3 flex flex-wrap gap-2 items-center">
                  {t.streefdatum ? (
                    <span className="px-2 py-0.5 rounded-full border text-xs">
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

                  {overdue && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
                      verlopen
                    </span>
                  )}
                </div>

                {/* Acties */}
                <div className="mt-4 flex justify-between items-center border-t pt-3">
                  <a
                    href={`/admin/todos/${t.id}`}
                    className="text-sm text-blue-900 font-medium hover:underline"
                  >
                    Bewerken
                  </a>

                  <button
                    onClick={() => setStatus(t.id, "gedaan")}
                    className="rounded-full w-9 h-9 flex items-center justify-center bg-green-600 text-white text-lg hover:bg-green-700 transition"
                    title="Markeer als klaar"
                  >
                    ✓
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}