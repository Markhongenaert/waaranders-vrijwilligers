import { supabase } from "@/lib/supabaseClient";

export type RoleCode = "vrijwilliger" | "doenker" | "admin";

/**
 * Haalt mijn rolcodes op op basis van vrijwilliger_roles.
 * Belangrijk: als mijn vrijwilliger-record bestaat maar actief=false, dan krijg ik geen rollen terug.
 */
export async function getMyRoleCodes(): Promise<RoleCode[]> {
  const { data: sess, error: sessErr } = await supabase.auth.getSession();
  if (sessErr) {
    console.error("getSession error:", sessErr.message);
    return [];
  }

  const user = sess.session?.user;
  if (!user) return [];

  // 1) Find my vrijwilliger row (public.vrijwilligers.user_id == auth.users.id)
  //    Neem actief mee, zodat gearchiveerden automatisch geen rollen meer krijgen.
  const { data: v, error: vErr } = await supabase
    .from("vrijwilligers")
    .select("id, actief")
    .eq("user_id", user.id)
    .maybeSingle();

  if (vErr) {
    console.error("getMyRoleCodes vrijwilligers lookup error:", vErr.message);
    return [];
  }

  // Geen vrijwilliger-record => geen rollen
  if (!v?.id) return [];

  // Gearchiveerd => geen rollen (en dus geen toegang tot doenker/admin pagina's)
  if (v.actief === false) return [];

  // 2) Fetch role codes for that vrijwilliger_id
  const { data, error } = await supabase
    .from("vrijwilliger_roles")
    .select("roles(code)")
    .eq("vrijwilliger_id", v.id);

  if (error) {
    console.error("getMyRoleCodes roles lookup error:", error.message);
    return [];
  }

  const codes = (data ?? [])
    .map((r: any) => r.roles?.code)
    .filter(Boolean);

  return Array.from(new Set(codes)) as RoleCode[];
}

/**
 * True als er een vrijwilliger-record is én actief=true.
 * (Handig om in AppHeader of in een layout hard te blokkeren.)
 */
export async function isMyVolunteerActive(): Promise<boolean> {
  const { data: sess, error: sessErr } = await supabase.auth.getSession();
  if (sessErr) return false;

  const user = sess.session?.user;
  if (!user) return false;

  const { data: v, error } = await supabase
    .from("vrijwilligers")
    .select("actief")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return false;

  // Als er geen vrijwilliger-record is, laten we dit "true" of "false"?
  // Voor jouw use-case: alleen vrijwilligers kunnen inloggen, dus dit mag false zijn.
  // Maar safe default: enkel blokkeren bij expliciet actief=false.
  if (!v) return true;

  return v.actief !== false;
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