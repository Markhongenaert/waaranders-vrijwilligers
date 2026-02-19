// src/app/admin/activiteiten/page.tsx
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
  klant_id: string | null;
  klanten: KlantMini[];
};

async function deleteActiviteit(formData: FormData) {
  "use server";

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = supabaseServer();
  const { error } = await supabase.from("activiteiten").delete().eq("id", id);

  // Optioneel: je kan error loggen, maar build hoeft niet te falen
  if (error) {
    console.error("Delete activiteit error:", error.message);
  }

  revalidatePath("/admin/activiteiten");
}

export default async function AdminActiviteitenPage() {
  const supabase = supabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Beheer – Activiteiten</h1>
        <p>Je moet ingelogd zijn om dit te zien.</p>
        <Link href="/activiteiten">Terug naar activiteiten</Link>
      </main>
    );
  }

  const { data, error } = await supabase
    .from("activiteiten")
    .select(
      "id, titel, wanneer, aantal_vrijwilligers, toelichting, klant_id, klanten(naam)"
    )
    .order("wanneer", { ascending: true });

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Beheer – Activiteiten</h1>
        <p style={{ color: "crimson" }}>Fout bij laden: {error.message}</p>
        <Link href="/activiteiten">Terug</Link>
      </main>
    );
  }

  const activiteiten: ActiviteitRow[] = (data ?? []) as ActiviteitRow[];

  return (
    <main style={{ padding: 24 }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 16,
        }}
      >
        <h1 style={{ margin: 0 }}>Beheer – Activiteiten</h1>
        <Link href="/activiteiten">Publieke lijst</Link>
      </header>

      <div style={{ height: 16 }} />

      {activiteiten.length === 0 ? (
        <p>Geen activiteiten gevonden.</p>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            border: "1px solid #ddd",
          }}
        >
          <thead>
            <tr>
              <th style={th}>Wanneer</th>
              <th style={th}>Titel</th>
              <th style={th}>Klant</th>
              <th style={th}>Vrijw.</th>
              <th style={th}>Acties</th>
            </tr>
          </thead>
          <tbody>
            {activiteiten.map((a) => {
              const klantNaam = a.klanten?.[0]?.naam ?? "—";
              const wanneer = a.wanneer ? new Date(a.wanneer) : null;

              return (
                <tr key={a.id}>
                  <td style={td}>
                    {wanneer ? wanneer.toLocaleString("nl-BE") : "—"}
                  </td>
                  <td style={td}>{a.titel}</td>
                  <td style={td}>{klantNaam}</td>
                  <td style={td} align="center">
                    {a.aantal_vrijwilligers ?? "—"}
                  </td>
                  <td style={td}>
                    <form action={deleteActiviteit}>
                      <input type="hidden" name="id" value={a.id} />
                      <button
                        type="submit"
                        style={{
                          border: "1px solid #ddd",
                          borderRadius: 8,
                          padding: "6px 10px",
                          cursor: "pointer",
                        }}
                      >
                        Verwijder
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </main>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  borderBottom: "1px solid #ddd",
  background: "#fafafa",
};

const td: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid #eee",
  verticalAlign: "top",
};
