import { supabase } from "@/lib/supabaseClient";

export type RoleCode = "vrijwilliger" | "doenker" | "admin";

export async function getMyRoleCodes(): Promise<RoleCode[]> {
  const { data: sess } = await supabase.auth.getSession();
  const user = sess.session?.user;
  if (!user) return [];

  const { data, error } = await supabase
    .from("vrijwilliger_roles")
    .select("roles(code)")
    .eq("vrijwilliger_id", user.id);

  if (error) {
    console.error("getMyRoleCodes error:", error.message);
    return [];
  }

  // data looks like: [{ roles: { code: "admin" } }, ...]  OR roles may be array-ish depending on FK
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
