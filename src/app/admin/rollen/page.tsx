"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Vrijwilliger = {
  id: string;
  naam: string | null;
};

type AdminRow = {
  user_id: string;
};

export default function RollenPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [vrijwilligers, setVrijwilligers] = useState<Vrijwilliger[]>([]);
  const [admins, setAdmins] = useState<AdminRow[]>([]);

  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const adminSet = useMemo(() => new Set(admins.map((a) => a.user_id)), [admins]);

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

    // Check admin: kan ik mezelf vinden in admins?
    const { data: myAdminRow, error: e0 } = await supabase
      .from("admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (e0) {
      setError(e0.message);
      setLoading(false);
      return;
    }

    const ok = !!myAdminRow;
    setIsAdmin(ok);

    if (!ok) {
      setLoading(false);
      return;
    }

    // Vrijwilligerslijst
    const { data: v, error: e1 } = await supabase
      .from("vrijwilligers")
      .select("id,naam")
      .order("naam", { ascending: true });

    if (e1) {
      setError(e1.message);
      setLoading(false);
      return;
    }

    // Admins
    const { data: a, error: e2 } = await supabase.from("admins").select("user_id");

    if (e2) {
      setError(e2.message);
      setLoading(false);
      return;
    }

    setVrijwilligers((v ?? []) as Vrijwilliger[]);
    setAdmins((a ?? []) as AdminRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const makeAdmin = async (userId: string) => {
    setBusyUserId(userId);
    setError(null);
    setMsg(null);

    const { error } = await supabase.from("admins").insert({ user_id: userId });

    if (error) setError(error.message);
    else setMsg("Admin toegevoegd.");

    await load();
    setBusyUserId(null);
  };

  const removeAdmin = async (userId: string) => {
    setBusyUserId(userId);
    setError(null);
    setMsg(null);

    const { error } = await supabase.from("admins").delete().eq("user_id", userId);

    if (error) setError(error.message);
    else setMsg("Admin verwijderd.");

    await load();
    setBusyUserId(null);
  };

  if (loading) return <p>Laden…</p>;

  if (!isAdmin) {
    return (
      <>
        <h2 className="text-2xl font-bold mb-2">Autorisatie / rollen</h2>
        <p>Je hebt geen admin-rechten.</p>
      </>
    );
  }

  return (
    <>
      <h2 className="text-2xl font-bold mb-2">Autorisatie / rollen</h2>
      <p className="text-gray-600 mb-6">
        Voorlopig beheren we hier wie admin is. Later kunnen we dit uitbreiden met extra rollen.
      </p>

      {error && <p className="text-red-600 mb-4">Fout: {error}</p>}
      {msg && <p className="text-green-700 mb-4">{msg}</p>}

      <div className="border rounded-xl overflow-hidden">
        <div className="grid grid-cols-3 gap-2 p-3 font-medium bg-gray-50">
          <div>Vrijwilliger</div>
          <div>Status</div>
          <div className="text-right">Actie</div>
        </div>

        {vrijwilligers.map((v) => {
          const status = adminSet.has(v.id);
          const busy = busyUserId === v.id;

          return (
            <div key={v.id} className="grid grid-cols-3 gap-2 p-3 border-t items-center">
              <div>{v.naam ?? "(naam ontbreekt)"}</div>
              <div>{status ? "Admin" : "—"}</div>
              <div className="text-right">
                {!status ? (
                  <button
                    className="border rounded-xl px-3 py-2 text-sm"
                    onClick={() => makeAdmin(v.id)}
                    disabled={busy}
                  >
                    {busy ? "Bezig…" : "Maak admin"}
                  </button>
                ) : (
                  <button
                    className="border rounded-xl px-3 py-2 text-sm"
                    onClick={() => removeAdmin(v.id)}
                    disabled={busy}
                  >
                    {busy ? "Bezig…" : "Verwijder admin"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
