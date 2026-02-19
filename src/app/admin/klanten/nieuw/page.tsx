// src/app/admin/klanten/nieuw/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

async function createKlant(formData: FormData) {
  "use server";

  const naam = String(formData.get("naam") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const telefoon = String(formData.get("telefoon") ?? "").trim();

  if (!naam) return;

  const supabase = await supabaseServer();

  const { error } = await supabase.from("klanten").insert({
    naam,
    email: email || null,
    telefoon: telefoon || null,
  });

  if (error) {
    console.error("Create klant error:", error.message);
    return;
  }

  redirect("/admin/klanten");
}

export default async function NieuweKlantPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Nieuwe klant</h1>
        <p>Je moet ingelogd zijn.</p>
        <Link href="/activiteiten">Terug</Link>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, maxWidth: 560 }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
        <h1 style={{ margin: 0 }}>Nieuwe klant</h1>
        <Link href="/admin/klanten">Terug naar klanten</Link>
      </header>

      <div style={{ height: 16 }} />

      <form action={createKlant} style={{ display: "grid", gap: 12 }}>
        <label>
          <div style={label}>Naam *</div>
          <input name="naam" required style={input} />
        </label>

        <label>
          <div style={label}>Email</div>
          <input name="email" type="email" style={input} />
        </label>

        <label>
          <div style={label}>Telefoon</div>
          <input name="telefoon" style={input} />
        </label>

        <button type="submit" style={primaryBtn}>
          Opslaan
        </button>
      </form>
    </main>
  );
}

const label: React.CSSProperties = { fontWeight: 600, marginBottom: 6 };
const input: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #ddd",
  borderRadius: 10,
};
const primaryBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #111",
  cursor: "pointer",
  fontWeight: 700,
};
