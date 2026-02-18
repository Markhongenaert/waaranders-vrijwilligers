"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin } from "@/lib/auth";

type Todo = {
  id: string;
  wat: string;
  streefdatum: string | null; // date
  status: "gepland" | "bezig" | "gedaan";
  prioriteit: "laag" | "normaal" | "hoog";
  thema_id: string | null;
};

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
    const user = sess.session?.user;
    if (!user) {
      window.location.href = "/login";
      return;
    }

    // Mag deze gebruiker beheren (doenker of admin)?
    const ok = await isDoenkerOrAdmin();
    setCanBeheer(ok);

    // Mijn TODO's: RLS + expliciete filter op mezelf
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
  }, []);

  const setStatus = async (id: string, status: Todo["status"]) => {
    setError(null);
    setMsg(null);

    const { error } = await supabase.from("todos").update({ status }).eq("id", id);

    if (error) setError(error.message);
    else setMsg("Status aangepast.");

    await load();
  };

  return (
    <main className="mx-auto max-w-3xl p-6 md:p-10">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Mijn TODO’s</h1>
          <p className="text-gray-600 mt-1">Open taken (status niet “gedaan”).</p>
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
      ) : items.length === 0 ? (
        <p className="text-gray-600">Geen open TODO’s 🎉</p>
      ) : (
        <ul className="space-y-3">
          {items.map((t) => (
            <li key={t.id} className={`border rounded-2xl p-4 bg-white/80 shadow-sm ${isOverdue(t.streefdatum, t.status) ? "border-red-500" : "" }`}>
              <div className="font-medium">{t.wat}</div>

              <div className="text-sm text-gray-600 mt-1">
                {t.streefdatum ? `Streefdatum: ${t.streefdatum}` : "Geen streefdatum"}
                {` • Prioriteit: ${t.prioriteit}`}
                {` • Status: ${t.status}`}
              </div>

              <div className="flex gap-2 mt-3">
                <button
                  className="border rounded-xl px-3 py-2 text-sm"
                  onClick={() => setStatus(t.id, "gepland")}
                  disabled={t.status === "gepland"}
                >
                  Gepland
                </button>
                <button
                  className="border rounded-xl px-3 py-2 text-sm"
                  onClick={() => setStatus(t.id, "bezig")}
                  disabled={t.status === "bezig"}
                >
                  Bezig
                </button>
                <button
                  className="border rounded-xl px-3 py-2 text-sm"
                  onClick={() => setStatus(t.id, "gedaan")}
                >
                  Gedaan
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
