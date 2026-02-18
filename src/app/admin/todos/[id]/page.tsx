"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Vrijwilliger = { id: string; naam: string | null };

type Todo = {
  id: string;
  wat: string;
  wie_vrijwilliger_id: string;
  streefdatum: string | null;
  status: "gepland" | "bezig" | "gedaan";
  prioriteit: "laag" | "normaal" | "hoog";
};

export default function TodoEditPage() {
  const params = useParams();
  const id = (params?.id as string) || "";

  const [loading, setLoading] = useState(true);

  const [vrijwilligers, setVrijwilligers] = useState<Vrijwilliger[]>([]);
  const [todo, setTodo] = useState<Todo | null>(null);

  const [wat, setWat] = useState("");
  const [wie, setWie] = useState("");
  const [streefdatum, setStreefdatum] = useState("");
  const [prioriteit, setPrioriteit] = useState<"laag" | "normaal" | "hoog">("normaal");
  const [status, setStatus] = useState<"gepland" | "bezig" | "gedaan">("gepland");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    setMsg(null);

    if (!id) {
      setError("Interne fout: ontbrekend TODO-id in de URL.");
      setLoading(false);
      return;
    }

    const { data: sess } = await supabase.auth.getSession();
    const user = sess.session?.user;
    if (!user) {
      window.location.href = "/login";
      return;
    }

    // 1) TODO laden (RLS beslist)
    const { data: t, error: eTodo } = await supabase
      .from("todos")
      .select("id,wat,wie_vrijwilliger_id,streefdatum,status,prioriteit")
      .eq("id", id)
      .maybeSingle();

    if (eTodo) {
      setError(eTodo.message);
      setLoading(false);
      return;
    }

    if (!t) {
      setError("TODO niet gevonden of je hebt geen rechten om deze te bekijken.");
      setLoading(false);
      return;
    }

    const tt = t as Todo;
    setTodo(tt);

    setWat(tt.wat ?? "");
    setWie(tt.wie_vrijwilliger_id ?? "");
    setStreefdatum(tt.streefdatum ?? "");
    setPrioriteit(tt.prioriteit);
    setStatus(tt.status);

    // 2) vrijwilligerslijst (voor dropdown). Als dit faalt: geen harde stop.
    const { data: v, error: eV } = await supabase
      .from("vrijwilligers")
      .select("id,naam")
      .order("naam", { ascending: true });

    if (!eV) setVrijwilligers((v ?? []) as Vrijwilliger[]);
    else {
      console.warn("Vrijwilligerslijst niet leesbaar:", eV.message);
      setVrijwilligers([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const save = async () => {
    setError(null);
    setMsg(null);

    if (!todo) return;

    if (!wat.trim()) {
      setError("Veld 'Wat' is verplicht.");
      return;
    }
    if (!wie) {
      setError("Kies een persoon bij 'Wie'.");
      return;
    }

    setBusy(true);

    const { data: sess } = await supabase.auth.getSession();
    const me = sess.session?.user?.id;

    const payload: any = {
      wat: wat.trim(),
      wie_vrijwilliger_id: wie,
      streefdatum: streefdatum ? streefdatum : null,
      prioriteit,
      status,
    };
    if (me) payload.bijgewerkt_door = me;

    const { error } = await supabase.from("todos").update(payload).eq("id", todo.id);

if (error) {
     setError(error.message);
    } else {
     window.location.href = "/admin/todos";
     return;
    }

    setBusy(false);
  };

  const remove = async () => {
    if (!todo) return;
    const ok = window.confirm("TODO verwijderen? Dit kan niet ongedaan gemaakt worden.");
    if (!ok) return;

    setBusy(true);
    setError(null);
    setMsg(null);

    const { error } = await supabase.from("todos").delete().eq("id", todo.id);

    if (error) {
     setError(error.message);
    } else {
     // meteen terug naar overzicht
     window.location.href = "/admin/todos";
     return;
    }


    window.location.href = "/admin/todos";
  };

  if (loading) return <main className="mx-auto max-w-3xl p-6 md:p-10">Laden…</main>;

  if (!todo) {
    return (
      <main className="mx-auto max-w-3xl p-6 md:p-10">
        <h1 className="text-3xl font-semibold tracking-tight mb-2">TODO bewerken</h1>
        {error ? <p className="text-red-600">Fout: {error}</p> : <p>Onbekende fout.</p>}
        <div className="mt-4">
          <a className="border rounded-xl px-3 py-2 text-sm" href="/admin/todos">
            Terug
          </a>
        </div>
      </main>
    );
  }

  const canPickWho = vrijwilligers.length > 0;

  return (
    <main className="mx-auto max-w-3xl p-6 md:p-10">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight mb-1">TODO bewerken</h1>
          <p className="text-gray-600">Pas de taak aan en sla op.</p>
        </div>
        <a className="border rounded-xl px-3 py-2 text-sm" href="/admin/todos">
          Terug
        </a>
      </div>

      {error && <p className="text-red-600 mb-4">Fout: {error}</p>}
      {msg && <p className="text-green-700 mb-4">{msg}</p>}

      <div className="border rounded-2xl p-4 bg-white/80 shadow-sm space-y-4">
        <div>
          <label className="text-sm font-medium block mb-1">Wat</label>
          <input className="w-full border rounded-xl p-3" value={wat} onChange={(e) => setWat(e.target.value)} />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Wie</label>
          {canPickWho ? (
            <select className="w-full border rounded-xl p-3" value={wie} onChange={(e) => setWie(e.target.value)}>
              <option value="">-- kies --</option>
              {vrijwilligers.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.naam ?? "(naam ontbreekt)"}
                </option>
              ))}
            </select>
          ) : (
            <input className="w-full border rounded-xl p-3 bg-gray-50" value={wie} readOnly />
          )}
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Streefdatum</label>
          <input className="w-full border rounded-xl p-3" type="date" value={streefdatum} onChange={(e) => setStreefdatum(e.target.value)} />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Prioriteit</label>
          <select className="w-full border rounded-xl p-3" value={prioriteit} onChange={(e) => setPrioriteit(e.target.value as any)}>
            <option value="laag">Laag</option>
            <option value="normaal">Normaal</option>
            <option value="hoog">Hoog</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Status</label>
          <select className="w-full border rounded-xl p-3" value={status} onChange={(e) => setStatus(e.target.value as any)}>
            <option value="gepland">Gepland</option>
            <option value="bezig">Bezig</option>
            <option value="gedaan">Gedaan</option>
          </select>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button className="border rounded-xl px-4 py-2" onClick={save} disabled={busy}>
            {busy ? "Bezig…" : "Opslaan"}
          </button>
          <button className="border rounded-xl px-4 py-2" onClick={remove} disabled={busy}>
            Verwijderen
          </button>
        </div>
      </div>
    </main>
  );
}
