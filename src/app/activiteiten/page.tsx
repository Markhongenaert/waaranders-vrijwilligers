// src/app/activiteiten/page.tsx
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

type VrijwilligerMini = {
  id: string;
  naam: string;
  user_id: string | null; // Optie A: toevoegen in DB
};

type MeedoenRow = {
  vrijwilliger_id: string;
  vrijwilligers: VrijwilligerMini | VrijwilligerMini[] | null;
};

type ActiviteitRow = {
  id: string;
  titel: string;
  toelichting: string | null;
  wanneer: string; // ISO
  aantal_vrijwilligers: number | null;
  meedoen: MeedoenRow[];
};

// ---------------- helpers ----------------

function fmtDagDatum(iso: string) {
  const d = new Date(iso);
  // "dinsdag 19 feb"
  return new Intl.DateTimeFormat("nl-BE", {
    weekday: "long",
    day: "2-digit",
    month: "short",
  }).format(d);
}

function monthKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(iso: string) {
  const d = new Date(iso);
  const s = new Intl.DateTimeFormat("nl-BE", { month: "long", year: "numeric" }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1); // "Februari 2026"
}

function normalizeVrijwilliger(v: MeedoenRow["vrijwilligers"]): VrijwilligerMini | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

// ---------------- server actions ----------------

async function getMijnVrijwilliger() {
  const supabase = await supabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, vrijwilliger: null as VrijwilligerMini | null };

  // vereist: vrijwilligers.user_id bestaat en is ingevuld
  const { data: v, error } = await supabase
    .from("vrijwilligers")
    .select("id, naam, user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) console.error("Vrijwilliger lookup error:", error.message);

  return { user, vrijwilliger: (v ?? null) as VrijwilligerMini | null };
}

async function inschrijven(formData: FormData) {
  "use server";

  const activiteit_id = String(formData.get("activiteit_id") ?? "");
  if (!activiteit_id) return;

  const supabase = await supabaseServer();
  const { user, vrijwilliger } = await getMijnVrijwilliger();
  if (!user || !vrijwilliger) return;

  // voorkom dubbele inschrijving
  const { data: bestaand } = await supabase
    .from("meedoen")
    .select("activiteit_id, vrijwilliger_id")
    .eq("activiteit_id", activiteit_id)
    .eq("vrijwilliger_id", vrijwilliger.id)
    .maybeSingle();

  if (!bestaand) {
    const { error } = await supabase.from("meedoen").insert({
      activiteit_id,
      vrijwilliger_id: vrijwilliger.id,
    });
    if (error) console.error("Inschrijven error:", error.message);
  }

  revalidatePath("/activiteiten");
}

async function uitschrijven(formData: FormData) {
  "use server";

  const activiteit_id = String(formData.get("activiteit_id") ?? "");
  if (!activiteit_id) return;

  const supabase = await supabaseServer();
  const { user, vrijwilliger } = await getMijnVrijwilliger();
  if (!user || !vrijwilliger) return;

  const { error } = await supabase
    .from("meedoen")
    .delete()
    .eq("activiteit_id", activiteit_id)
    .eq("vrijwilliger_id", vrijwilliger.id);

  if (error) console.error("Uitschrijven error:", error.message);

  revalidatePath("/activiteiten");
}

// ---------------- page ----------------

export default async function ActiviteitenPage() {
  const supabase = await supabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { vrijwilliger: mijnVrijwilliger } = await getMijnVrijwilliger();

  const { data, error } = await supabase
    .from("activiteiten")
    .select(
      `
      id,
      titel,
      toelichting,
      wanneer,
      aantal_vrijwilligers,
      meedoen (
        vrijwilliger_id,
        vrijwilligers ( id, naam, user_id )
      )
    `
    )
    .order("wanneer", { ascending: true });

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Activiteiten</h1>
        <p style={{ color: "crimson" }}>Fout bij laden: {error.message}</p>
      </main>
    );
  }

  const activiteiten = (data ?? []) as ActiviteitRow[];

  // groepeer per maand
  const groups: { key: string; label: string; items: ActiviteitRow[] }[] = [];
  for (const a of activiteiten) {
    const k = monthKey(a.wanneer);
    let g = groups.find((x) => x.key === k);
    if (!g) {
      g = { key: k, label: monthLabel(a.wanneer), items: [] };
      groups.push(g);
    }
    g.items.push(a);
  }

  const meedoetIk = (a: ActiviteitRow) => {
    if (!mijnVrijwilliger) return false;
    return (a.meedoen ?? []).some((m) => m.vrijwilliger_id === mijnVrijwilliger.id);
  };

  const namenIngeschreven = (a: ActiviteitRow) => {
    const namen = (a.meedoen ?? [])
      .map((m) => normalizeVrijwilliger(m.vrijwilligers)?.naam ?? null)
      .filter(Boolean) as string[];
    return Array.from(new Set(namen));
  };

  const kanActie = Boolean(user && mijnVrijwilliger);

  return (
    <main style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
      <header style={styles.header}>
        <h1 style={{ margin: 0 }}>Activiteiten</h1>
        <nav style={{ display: "flex", gap: 12 }}>
          <Link href="/admin/activiteiten">Beheer</Link>
        </nav>
      </header>

      <div style={{ height: 16 }} />

      {!user ? (
        <div style={styles.infoBox}>
          Log in om je te kunnen inschrijven.
        </div>
      ) : user && !mijnVrijwilliger ? (
        <div style={styles.warnBox}>
          Je bent ingelogd, maar je login is nog niet gekoppeld aan een vrijwilliger.
          (Voeg <code>user_id</code> toe in tabel <code>vrijwilligers</code> en koppel éénmalig.)
        </div>
      ) : null}

      {activiteiten.length === 0 ? (
        <p>Geen activiteiten gevonden.</p>
      ) : (
        <div style={{ display: "grid", gap: 18 }}>
          {groups.map((g) => (
            <section key={g.key} style={{ display: "grid", gap: 12 }}>
              {/* sticky maandtitel */}
              <div style={styles.monthSticky}>{g.label}</div>

              <ul style={styles.list}>
                {g.items.map((a) => {
                  const ikDoeMee = meedoetIk(a);
                  const namen = namenIngeschreven(a);
                  const nodig = a.aantal_vrijwilligers ?? null;

                  return (
                    <li
                      key={a.id}
                      style={{
                        ...styles.card,
                        ...(ikDoeMee ? styles.cardIngeschreven : {}),
                      }}
                    >
                      {/* Titel + datum */}
                      <div style={styles.rowTop}>
                        <div style={styles.titleWrap}>
                          <div style={styles.title}>{a.titel}</div>
                          {ikDoeMee ? <span style={styles.badge}>Je neemt deel</span> : null}
                        </div>
                        <div style={styles.date}>{fmtDagDatum(a.wanneer)}</div>
                      </div>

                      {/* Toelichting onder titel */}
                      {a.toelichting ? (
                        <div style={styles.toelichting}>{a.toelichting}</div>
                      ) : null}

                      {/* Meta */}
                      <div style={styles.meta}>
                        <div>
                          <strong>Vrijwilligers nodig:</strong> {nodig ?? "—"}
                        </div>
                        <div>
                          <strong>Ingeschreven:</strong>{" "}
                          {namen.length ? namen.join(", ") : "Nog niemand"}
                        </div>
                      </div>

                      {/* Actieknoppen */}
                      <div style={styles.actions}>
                        {!kanActie ? (
                          <span style={{ opacity: 0.7 }}>(koppel je login om in te schrijven)</span>
                        ) : ikDoeMee ? (
                          <form action={uitschrijven}>
                            <input type="hidden" name="activiteit_id" value={a.id} />
                            <button type="submit" style={styles.btnSecondary}>
                              Uitschrijven
                            </button>
                          </form>
                        ) : (
                          <form action={inschrijven}>
                            <input type="hidden" name="activiteit_id" value={a.id} />
                            <button type="submit" style={styles.btnPrimary}>
                              Inschrijven
                            </button>
                          </form>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}

// ---------------- styles ----------------

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 16,
  },
  infoBox: {
    border: "1px solid #e5e5e5",
    borderRadius: 12,
    padding: 12,
    background: "#fafafa",
    marginBottom: 16,
  },
  warnBox: {
    border: "1px solid #f0c36d",
    borderRadius: 12,
    padding: 12,
    background: "#fff7e6",
    marginBottom: 16,
  },
  monthSticky: {
    position: "sticky",
    top: 0,
    zIndex: 5,
    background: "#d9ecff", // lichtblauw sticky label
    border: "1px solid #b8dcff",
    borderRadius: 10,
    padding: "8px 12px",
    fontWeight: 800,
    width: "fit-content",
    boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
  },
  list: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    display: "grid",
    gap: 12,
  },
  card: {
    border: "1px solid #e5e5e5",
    borderRadius: 14,
    padding: 14,
    background: "white",
  },
  cardIngeschreven: {
    border: "3px solid #2e7d32", // dikke groene rand
    background: "#e9f7ec", // lichtgroen
  },
  rowTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 12,
  },
  titleWrap: {
    display: "flex",
    alignItems: "baseline",
    gap: 10,
    minWidth: 0,
  },
  title: {
    fontWeight: 900,
    fontSize: 16,
    lineHeight: 1.2,
  },
  badge: {
    fontSize: 12,
    fontWeight: 800,
    padding: "2px 8px",
    borderRadius: 999,
    background: "#2e7d32",
    color: "white",
    whiteSpace: "nowrap",
  },
  date: {
    opacity: 0.85,
    whiteSpace: "nowrap",
  },
  toelichting: {
    marginTop: 8,
    opacity: 0.92,
  },
  meta: {
    marginTop: 10,
    display: "grid",
    gap: 6,
    opacity: 0.95,
  },
  actions: {
    marginTop: 12,
    display: "flex",
    gap: 10,
    alignItems: "center",
  },
  btnPrimary: {
    border: "1px solid #111",
    borderRadius: 12,
    padding: "8px 12px",
    cursor: "pointer",
    fontWeight: 900,
    background: "white",
  },
  btnSecondary: {
    border: "1px solid #999",
    borderRadius: 12,
    padding: "8px 12px",
    cursor: "pointer",
    fontWeight: 800,
    background: "white",
  },
};
