// src/app/admin/klanten/page.tsx
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

type KlantRow = {
  id: string;
  naam: string;
  email: string | null;
  telefoon: string | null;
};

async function deleteKlant(formData: FormData) {
  "use server";

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await supabaseServer();

  // Let op: als er activiteiten naar deze klant verwijzen, kan dit falen door FK constraint.
  const { error } = await supabase.from("klanten").delete().eq("id", id);
  if (error) console.error("Delete klant error:", error.message);

  revalidatePath("/admin/klanten");
}

export default async function AdminKlantenPage() {
  const supabase = await supabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Beheer – Klanten</h1>
        <p>Je moet ingelogd zijn om dit te zien.</p>
        <Link href="/activiteiten">Terug</Link>
      </main>
    );
  }

  const { data, error } = await supabase
    .from("klanten")
    .select("id, naam, email, telefoon")
    .order("naam", { ascending: true });

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Beheer – Klanten</h1>
        <p style={{ color: "crimson" }}>Fout bij laden: {error.message}</p>
      </main>
    );
  }

  const klanten: KlantRow[] = (data ?? []) as KlantRow[];

  return (
    <main style={{ padding: 24 }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
        <h1 style={{ margin: 0 }}>Beheer – Klanten</h1>
        <div style={{ display: "flex", gap: 12 }}>
          <Link href="/admin/activiteiten">Activiteiten</Link>
          <Link href="/admin/klanten/nieuw">+ Nieuwe klant</Link>
        </div>
      </header>

      <div style={{ height: 16 }} />

      {klanten.length === 0 ? (
        <p>Nog geen klanten.</p>
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
              <th style={th}>Naam</th>
              <th style={th}>Email</th>
              <th style={th}>Telefoon</th>
              <th style={th}>Acties</th>
            </tr>
          </thead>
          <tbody>
            {klanten.map((k) => (
              <tr key={k.id}>
                <td style={td}>{k.naam}</td>
                <td style={td}>{k.email ?? "—"}</td>
                <td style={td}>{k.telefoon ?? "—"}</td>
                <td style={td}>
                  <div style={{ display: "flex", gap: 10 }}>
                    {/* Optioneel als je edit toevoegt: */}
                    {/* <Link href={`/admin/klanten/${k.id}`}>Bewerk</Link> */}
                    <form action={deleteKlant}>
                      <input type="hidden" name="id" value={k.id} />
                      <button style={btn} type="submit">
                        Verwijder
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
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

const btn: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: "6px 10px",
  cursor: "pointer",
};
