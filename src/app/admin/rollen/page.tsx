"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Vrijwilliger = {
  id: string;
  naam: string | null;
};

type Role = {
  id: string;
  code: "vrijwilliger" | "doenker" | "admin";
  titel: string;
};

type VrijwilligerRoleRow = {
  vrijwilliger_id: string;
  rol_id: string;
  roles?: { code?: string } | { code?: string }[] | null;
};

type RoleCode = "vrijwilliger" | "doenker" | "admin";

export default function RollenPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [vrijwilligers, setVrijwilligers] = useState<Vrijwilliger[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [vRoles, setVRoles] = useState<VrijwilligerRoleRow[]>([]);

  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const roleIdByCode = useMemo(() => {
    const m = new Map<RoleCode, string>();
    for (const r of roles) m.set(r.code, r.id);
    return m;
  }, [roles]);

  // Huidige rol per vrijwilliger, default = 'vrijwilliger'
  const currentRoleByUser = useMemo(() => {
    const m = new Map<string, RoleCode>();

    const extractCode = (row: any): RoleCode | null => {
      const rr = row?.roles;
      if (Array.isArray(rr)) {
        const c = rr[0]?.code;
        if (c === "admin" || c === "doenker" || c === "vrijwilliger") return c;
        return null;
      }
      const c = rr?.code;
      if (c === "admin" || c === "doenker" || c === "vrijwilliger") return c;
      return null;
    };

    for (const row of vRoles) {
      const code = extractCode(row);
      if (code) m.set(row.vrijwilliger_id, code);
    }

    return m;
  }, [vRoles]);

  const adminCount = useMemo(() => {
    let c = 0;
    for (const row of vRoles) {
      const rr: any = (row as any).roles;
      const code = Array.isArray(rr) ? rr[0]?.code : rr?.code;
      if (code === "admin") c++;
    }
    return c;
  }, [vRoles]);

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

    // Rollen ophalen (moet bestaan: vrijwilliger/doenker/admin)
    const { data: r, error: er } = await supabase
      .from("roles")
      .select("id,code,titel")
      .in("code", ["vrijwilliger", "doenker", "admin"]);

    if (er) {
      setError(er.message);
      setLoading(false);
      return;
    }

    const rolesList = (r ?? []) as Role[];
    setRoles(rolesList);

    // Check: ben ik admin?
    // (via vrijwilliger_roles join roles)
    const { data: myRoles, error: e0 } = await supabase
      .from("vrijwilliger_roles")
      .select("roles(code)")
      .eq("vrijwilliger_id", user.id);

    if (e0) {
      setError(e0.message);
      setLoading(false);
      return;
    }

    const hasAdmin = (myRoles ?? []).some((row: any) => {
      const rr = row.roles;
      const code = Array.isArray(rr) ? rr[0]?.code : rr?.code;
      return code === "admin";
    });

    setIsAdmin(hasAdmin);

    if (!hasAdmin) {
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

    // Alle vrijwilliger_roles met join naar role code
    const { data: vr, error: e2 } = await supabase
      .from("vrijwilliger_roles")
      .select("vrijwilliger_id,rol_id,roles(code)");

    if (e2) {
      setError(e2.message);
      setLoading(false);
      return;
    }

    setVrijwilligers((v ?? []) as Vrijwilliger[]);
    setVRoles((vr ?? []) as VrijwilligerRoleRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setRoleForUser = async (userId: string, newRole: RoleCode, myUserId: string) => {
    setBusyUserId(userId);
    setError(null);
    setMsg(null);

    // voorkom dat je jezelf als laatste admin verwijdert
    if (userId === myUserId && newRole !== "admin" && adminCount <= 1) {
      setError("Je kan jezelf niet verwijderen als laatste admin.");
      setBusyUserId(null);
      return;
    }

    const targetRoleId = roleIdByCode.get(newRole);
    if (!targetRoleId) {
      setError("Rol ontbreekt in tabel roles. Controleer seeds (vrijwilliger/doenker/admin).");
      setBusyUserId(null);
      return;
    }

    const allRoleIds = ["vrijwilliger", "doenker", "admin"]
      .map((c) => roleIdByCode.get(c as RoleCode))
      .filter(Boolean) as string[];

    // 1) verwijder bestaande van de 3 basisrollen (zodat het single-choice blijft)
    const { error: dErr } = await supabase
      .from("vrijwilliger_roles")
      .delete()
      .eq("vrijwilliger_id", userId)
      .in("rol_id", allRoleIds);

    if (dErr) {
      setError(dErr.message);
      setBusyUserId(null);
      return;
    }

    // 2) voeg gekozen rol toe
    const { error: iErr } = await supabase.from("vrijwilliger_roles").insert({
      vrijwilliger_id: userId,
      rol_id: targetRoleId,
      toegekend_door: myUserId,
    });

    if (iErr) setError(iErr.message);
    else setMsg("Rol aangepast.");

    await load();
    setBusyUserId(null);
  };

  if (loading) return <p className="p-8">Laden…</p>;

  if (!isAdmin) {
    return (
      <main className="p-8 max-w-3xl">
        <h2 className="text-2xl font-bold mb-2">Autorisatie / rollen</h2>
        <p>Je hebt geen admin-rechten.</p>
      </main>
    );
  }

  return (
    <main className="p-8 max-w-3xl">
      <h2 className="text-2xl font-bold mb-2">Autorisatie / rollen</h2>
      <p className="text-gray-600 mb-6">
        Kies per persoon één rol. (Later kunnen we multi-rollen toelaten als we dat nodig vinden.)
      </p>

      {error && <p className="text-red-600 mb-4">Fout: {error}</p>}
      {msg && <p className="text-green-700 mb-4">{msg}</p>}

      <div className="border rounded-xl overflow-hidden">
        <div className="grid grid-cols-3 gap-2 p-3 font-medium bg-gray-50">
          <div>Vrijwilliger</div>
          <div>Rol</div>
          <div className="text-right">Actie</div>
        </div>

        {vrijwilligers.map((v) => (
          <Row
            key={v.id}
            v={v}
            busy={busyUserId === v.id}
            currentRole={(currentRoleByUser.get(v.id) ?? "vrijwilliger") as RoleCode}
            onSave={async (newRole) => {
              const { data: sess } = await supabase.auth.getSession();
              const me = sess.session?.user?.id;
              if (!me) {
                window.location.href = "/login";
                return;
              }
              await setRoleForUser(v.id, newRole, me);
            }}
          />
        ))}
      </div>
    </main>
  );
}

function Row({
  v,
  currentRole,
  busy,
  onSave,
}: {
  v: { id: string; naam: string | null };
  currentRole: "vrijwilliger" | "doenker" | "admin";
  busy: boolean;
  onSave: (newRole: "vrijwilliger" | "doenker" | "admin") => Promise<void>;
}) {
  const [value, setValue] = useState(currentRole);

  useEffect(() => {
    setValue(currentRole);
  }, [currentRole]);

  return (
    <div className="grid grid-cols-3 gap-2 p-3 border-t items-center">
      <div>{v.naam ?? "(naam ontbreekt)"}</div>

      <div>
        <select
          className="border rounded-xl px-3 py-2 text-sm w-full"
          value={value}
          onChange={(e) => setValue(e.target.value as any)}
          disabled={busy}
        >
          <option value="vrijwilliger">Vrijwilliger</option>
          <option value="doenker">Doenker</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      <div className="text-right">
        <button
          className="border rounded-xl px-3 py-2 text-sm"
          onClick={() => onSave(value)}
          disabled={busy}
        >
          {busy ? "Bezig…" : "Opslaan"}
        </button>
      </div>
    </div>
  );
}
