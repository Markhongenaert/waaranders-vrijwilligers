// src/app/activiteiten/page.tsx
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";

type KlantMini = { naam: string };

type ActiviteitRow = {
  id: string;
  titel: string;
  wanneer: string; // ISO string
  aantal_vrijwilligers: number | null;
  toelichting: string | null;
  klant_id: string | null;
  klanten: KlantMini[]; // Supabase join komt vaak als array
};

export default async function ActiviteitenPage() {
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from("activiteiten")
    .select(
      "id, titel, wanneer, aantal_vrijwilligers, toelichting, klant_id, klanten(naam)"
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
        <h1 style={{ margin: 0 }}>Activiteiten</h1>
        <Link href="/admin/activiteiten">Beheer</Link>
      </header>

      <div style={{ height: 16 }} />

      {activiteiten.length === 0 ? (
        <p>Geen activiteiten gevonden.</p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "grid",
            gap: 12,
          }}
        >
          {activiteiten.map((a) => {
            const klantNaam = a.klanten?.[0]?.naam ?? "—";
            const wanneer = a.wanneer ? new Date(a.wanneer) : null;

            return (
              <li
                key={a.id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: 10,
                  padding: 14,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <strong>{a.titel}</strong>
                  <span>{wanneer ? wanneer.toLocaleString("nl-BE") : "—"}</span>
                </div>

                <div style={{ height: 8 }} />

                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  <span>
                    <strong>Klant:</strong> {klantNaam}
                  </span>
                  <span>
                    <strong>Vrijwilligers nodig:</strong>{" "}
                    {a.aantal_vrijwilligers ?? "—"}
                  </span>
                </div>

                {a.toelichting ? (
                  <>
                    <div style={{ height: 8 }} />
                    <div style={{ opacity: 0.9 }}>{a.toelichting}</div>
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
