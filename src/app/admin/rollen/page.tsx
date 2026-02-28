"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type RoleCode = "vrijwilliger" | "doenker" | "admin";

type Vrijwilliger = {
  id: string;
  naam: string | null;
  actief?: boolean | null;
};

type Role = {
  id: string;
  code: RoleCode;
  titel: string;
};

type VrijwilligerRoleRow = {
  vrijwilliger_id: string;
  rol_id: string;
  roles?: { code?: string } | { code?: string }[] | null;
};

function extractRoleCode(row: any): RoleCode | null {
  const rr = row?.roles;
  const code = Array.isArray(rr) ? rr[0]?.code : rr?.code;
  if (code === "admin" || code === "doenker" || code === "vrijwilliger") return code;
  return null;
}

function fmtSupabaseError(e: any): string {
  if (!e) return "Onbekende fout.";
  const parts = [e.message, e.details, e.hint, e.code].filter(Boolean);
  return parts.join(" | ");
}

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

  const currentRoleByUser = useMemo(() => {
    const m = new Map<string, RoleCode>();
    for (const row of vRoles) {
      const code = extractRoleCode(row);
      if (code) m.set(row.vrijwilliger_id, code);
    }
    return m;
  }, [vRoles]);

  const adminCount = useMemo(() => {
    let c = 0;
    for (const row of vRoles) {
      const code = extractRoleCode(row);
      if (code === "admin") c++;
    }
    return c;
  }, [vRoles]);

  // Belangrijk: in jouw schema is `vrijwilliger_roles.vrijwilliger_id` een FK naar `vrijwilligers.id`
  // (niet naar auth.users.id). Dus: eerst mijn vrijwilligers.id ophalen via user_id.
  const getMyVrijwilligerId = async (): Promise<string | null> => {
    const { data: sess, error: sessErr } = await supabase.auth.getSession();
    if (sessErr) {
      setError(`Session fout: ${fmtSupabaseError(sessErr)}`);
      return null;
    }
    const user = sess.session?.user ?? null;
    if (!user) return null;

    const { data: v, error } = await supabase
      .from("vrijwilligers")
      .select("id, actief")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      setError(`Vrijwilliger lookup faalde: ${fmtSupabaseError(error)} (mogelijk RLS)`);
      return null;
    }

    // Als je geen vrijwilliger-record hebt of je bent gearchiveerd, geen admin-tools.
    if (!v?.id) return null;
    if (v.actief === false) return null;

    return v.id as string;
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    setMsg(null);

    const myVrijwilligerId = await getMyVrijwilligerId();
    if (!myVrijwilligerId) {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user ?? null;
      if (!user) window.location.href = "/login";
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    // 1) Rollen (ids) ophalen
    const { data: r, error: er } = await supabase
      .from("roles")
      .select("id,code,titel")
      .in("code", ["vrijwilliger", "doenker", "admin"]);

    if (er) {
      setError(`Roles lezen faalde: ${fmtSupabaseError(er)}`);
      setLoading(false);
      return;
    }

    const rolesList = (r ?? []) as Role[];
    setRoles(rolesList);

    // 2) Check: ben ik admin? (via vrijwilliger_roles voor mijn vrijwilligers.id)
    const { data: myRoles, error: e0 } = await supabase
      .from("vrijwilliger_roles")
      .select("roles(code)")
      .eq("vrijwilliger_id", myVrijwilligerId);

    if (e0) {
      setError(`Mijn rollen lezen faalde: ${fmtSupabaseError(e0)} (mogelijk RLS)`);
      setLoading(false);
      return;
    }

    const hasAdmin = (myRoles ?? []).some((row: any) => extractRoleCode(row) === "admin");
    setIsAdmin(hasAdmin);

    if (!hasAdmin) {
      setLoading(false);
      return;
    }

    // 3) Vrijwilligerslijst (✅ enkel actief)
    const { data: v, error: e1 } = await supabase
      .from("vrijwilligers")
      .select("id, naam, actief")
      .eq("actief", true)
      .order("naam", { ascending: true, nullsFirst: false });

    if (e1) {
      setError(`Vrijwilligers lezen faalde: ${fmtSupabaseError(e1)} (mogelijk RLS)`);
      setLoading(false);
      return;
    }

    // 4) Alle vrijwilliger_roles (met join naar role code)
    const { data: vr, error: e2 } = await supabase
      .from("vrijwilliger_roles")
      .select("vrijwilliger_id,rol_id,roles(code)");

    if (e2) {
      setError(`Vrijwilliger_roles lezen faalde: ${fmtSupabaseError(e2)} (mogelijk RLS)`);
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

  const setRoleForUser = async (targetVrijwilligerId: string, newRole: RoleCode) => {
    setBusyUserId(targetVrijwilligerId);
    setError(null);
    setMsg(null);

    const myVrijwilligerId = await getMyVrijwilligerId();
    if (!myVrijwilligerId) {
      window.location.href = "/login";
      return;
    }

    // voorkom dat je jezelf als laatste admin verwijdert
    if (targetVrijwilligerId === myVrijwilligerId && newRole !== "admin" && adminCount <= 1) {
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

    const allRoleIds = (["vrijwilliger", "doenker", "admin"] as RoleCode[])
      .map((c) => roleIdByCode.get(c))
      .filter(Boolean) as string[];

    // 1) verwijder bestaande basisrollen (single-choice)
    const { error: dErr } = await supabase
      .from("vrijwilliger_roles")
      .delete()
      .eq("vrijwilliger_id", targetVrijwilligerId)
      .in("rol_id", allRoleIds);

    if (dErr) {
      setError(`Verwijderen faalde: ${fmtSupabaseError(dErr)} (RLS policy ontbreekt?)`);
      setBusyUserId(null);
      return;
    }

    // 2) voeg gekozen rol toe
    const { error: iErr } = await supabase.from("vrijwilliger_roles").insert({
      vrijwilliger_id: targetVrijwilligerId,
      rol_id: targetRoleId,
      toegekend_door: myVrijwilligerId,
    });

    if (iErr) {
      setError(`Toevoegen faalde: ${fmtSupabaseError(iErr)} (RLS policy ontbreekt?)`);
    } else {
      setMsg("Rol aangepast.");
    }

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
            onSave={(newRole) => setRoleForUser(v.id, newRole)}
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
  currentRole: RoleCode;
  busy: boolean;
  onSave: (newRole: RoleCode) => Promise<void>;
}) {
  const [value, setValue] = useState<RoleCode>(currentRole);

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
          onChange={(e) => setValue(e.target.value as RoleCode)}
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