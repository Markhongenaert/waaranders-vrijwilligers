import { supabase } from "@/lib/supabaseClient";

export type RoleCode = "vrijwilliger" | "doenker" | "admin";

export async function getMyRoleCodes(): Promise<RoleCode[]> {
  const { data: sess, error: sessErr } = await supabase.auth.getSession();
  if (sessErr) {
    console.error("getSession error:", sessErr.message);
    return [];
  }

  const user = sess.session?.user;
  if (!user) return [];

  // 1) Find my vrijwilliger row (public.vrijwilligers.user_id == auth.users.id)
  const { data: v, error: vErr } = await supabase
    .from("vrijwilligers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (vErr) {
    console.error("getMyRoleCodes vrijwilligers lookup error:", vErr.message);
    return [];
  }
  if (!v?.id) return [];

  // 2) Fetch role codes for that vrijwilliger_id
  const { data, error } = await supabase
    .from("vrijwilliger_roles")
    .select("roles(code)")
    .eq("vrijwilliger_id", v.id);

  if (error) {
    console.error("getMyRoleCodes error:", error.message);
    return [];
  }

  const codes = (data ?? [])
    .map((r: any) => r.roles?.code)
    .filter(Boolean);

  return Array.from(new Set(codes)) as RoleCode[];
}

export async function hasRole(role: RoleCode): Promise<boolean> {
  const roles = await getMyRoleCodes();
  return roles.includes(role);
}

export async function isDoenkerOrAdmin(): Promise<boolean> {
  const roles = await getMyRoleCodes();
  return roles.includes("admin") || roles.includes("doenker");
}

export async function isAdmin(): Promise<boolean> {
  const roles = await getMyRoleCodes();
  return roles.includes("admin");
}