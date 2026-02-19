// src/app/admin/activiteiten/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

type KlantMini = { naam: string };

type ActiviteitRow = {
  id: string;
  titel: string;
  wanneer: string;
  aantal_vrijwilligers: number | null;
  toelichting: string | null;
  klanten: KlantMini[];
};

async function deleteActiviteit(formData: FormData) {
  "use server";

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await supabaseServer();
  const { error } = await supabase.from("activiteiten").delete().eq("id", id);
  if (error) console.error("Delete activiteit error:", error.message);

  revalidatePath("/admin/activiteiten");
}

export default async function AdminActiviteitenPage() {
  const supabase = await supabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Beheer – Activiteiten</h1>
        <p>Je moet ingelogd zijn om dit te zien.</p>
        <Link href="/activiteiten">Terug</Link>
      </main>
    );
  }

  const { data, error } = await supabase
    .from("activiteiten")
    .select("id, titel, wanneer, aantal_vrijwilligers, toelichting, klanten(naam)")
    .order("wanneer", { ascending: true });

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Beheer – Activiteiten</h1>
        <p style={{ color: "crimson" }}>Fout bij laden: {error.message}</p>
      </main>
    );
  }

  const activiteiten = (data ?? []) as ActiviteitRow[];

  return (
    <main style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
      <header style={styles.header}>
        <h1 style={{ margin: 0 }}>Beheer – Activiteiten</h1>
        <div style={{ display: "flex", gap: 12 }}>
          <Link href="/admin/klanten">Klanten</Link>
          <Link href="/activiteiten">Publiek</Link>
        </div>
      </header>

      <div style={{ height: 16 }} />

      {activiteiten.length === 0 ? (
        <p>Geen activiteiten gevonden.</p>
      ) : (
        <ul style={styles.list}>
          {activiteiten.map((a) => {
            const klantNaam = a.klanten?.[0]?.naam ?? null;
            const wanneer = a.wanneer ? new Date(a.wanneer) : null;

            return (
              <li key={a.id} style={styles.card}>
                <div style={styles.rowTop}>
                  <div style={styles.title}>{a.titel}</div>
                  <div style={styles.date}>
                    {wanneer ? wanneer.toLocaleString("nl-BE") : "—"}
                  </div>
                </div>

                <div style={styles.meta}>
                  <span>
                    <strong>Vrijwilligers:</strong> {a.aantal_vrijwilligers ?? "—"}
                  </span>
                  {klantNaam ? (
                    <span>
                      <strong>Klant:</strong> {klantNaam}
                    </span>
                  ) : null}
                </div>

                {a.toelichting ? <div style={styles.note}>{a.toelichting}</div> : null}

                <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
                  {/* Als je later edit toevoegt: <Link href={`/admin/activiteiten/${a.id}`}>Bewerk</Link> */}
                  <form action={deleteActiviteit}>
                    <input type="hidden" name="id" value={a.id} />
                    <button type="submit" style={styles.btn}>
                      Verwijder
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 16,
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
    borderRadius: 12,
    padding: 14,
    background: "white",
  },
  rowTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "baseline",
  },
  title: {
    fontWeight: 700,
    fontSize: 16,
    lineHeight: 1.2,
  },
  date: {
    opacity: 0.85,
    whiteSpace: "nowrap",
  },
  meta: {
    display: "flex",
    gap: 16,
    flexWrap: "wrap",
    marginTop: 8,
    opacity: 0.9,
  },
  note: {
    marginTop: 10,
    opacity: 0.92,
  },
  btn: {
    border: "1px solid #ddd",
    borderRadius: 10,
    padding: "6px 10px",
    cursor: "pointer",
  },
};
