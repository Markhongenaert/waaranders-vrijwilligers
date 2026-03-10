"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin, isAdmin as checkIsAdmin } from "@/lib/auth";

type Klant = {
  id: string;
  naam: string;
  contactpersoon_naam: string | null;
  contactpersoon_telefoon: string | null;
  adres: string | null;
  actief: boolean;
  gearchiveerd_op: string | null;
};

function normalize(s: string) {
  return (s ?? "").trim().toLowerCase();
}

function safeReturnTo(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//")) return null;
  return raw;
}

export default function KlantenPage() {
  const sp = useSearchParams();
  const returnTo = safeReturnTo(sp.get("returnTo"));

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [adminUser, setAdminUser] = useState(false);

  const [items, setItems] = useState<Klant[]>([]);
  const [q, setQ] = useState("");

  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);

    const { data } = await supabase.auth.getSession();
    const user = data.session?.user ?? null;
    if (!user) {
      window.location.href = "/login";
      return;
    }

    const [ok, admin] = await Promise.all([isDoenkerOrAdmin(), checkIsAdmin()]);
    setAllowed(ok);
    setAdminUser(admin);
    if (!ok) {
      setLoading(false);
      return;
    }

    // Admins zien alle klanten; doenkers alleen actieve
    const { data: rows, error: e } = admin
      ? await supabase
          .from("klanten")
          .select("id,naam,contactpersoon_naam,contactpersoon_telefoon,adres,actief,gearchiveerd_op")
          .order("naam", { ascending: true })
      : await supabase
          .from("klanten")
          .select("id,naam,contactpersoon_naam,contactpersoon_telefoon,adres,actief,gearchiveerd_op")
          .eq("actief", true)
          .is("gearchiveerd_op", null)
          .order("naam", { ascending: true });

    if (e) {
      setError(e.message);
      setItems([]);
      setLoading(false);
      return;
    }

    setItems((rows ?? []) as Klant[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const needle = normalize(q);
    if (!needle) return items;

    return items.filter((k) => {
      const hay = [
        k.naam,
        k.contactpersoon_naam ?? "",
        k.contactpersoon_telefoon ?? "",
        k.adres ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(needle);
    });
  }, [items, q]);

  const nieuwHref = useMemo(() => {
    if (!returnTo) return "/admin/klanten/nieuw";
    const u = new URL("/admin/klanten/nieuw", "http://dummy.local");
    u.searchParams.set("returnTo", returnTo);
    return u.pathname + "?" + u.searchParams.toString();
  }, [returnTo]);

  if (loading) return <main className="mx-auto max-w-3xl p-6 md:p-10">Laden…</main>;

  if (!allowed) {
    return (
      <main className="mx-auto max-w-3xl p-6 md:p-10">
        <h1 className="text-3xl font-semibold tracking-tight mb-2">Klanten</h1>
        <p>Je hebt geen rechten om deze pagina te bekijken.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-6 md:p-10">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight mb-1">Klanten</h1>
        </div>

        <div className="flex gap-2">
          <Link className="wa-btn-action px-3 py-2 text-sm text-center" href={nieuwHref}>
            Maak klant
          </Link>
        </div>
      </div>

      {error && <p className="text-red-600 mb-4">Fout: {error}</p>}

      <div className="mb-4">
        <input
          className="w-full border-2 border-blue-900 rounded-xl p-3"
          placeholder="Zoek klant (naam, contactpersoon, telefoon, adres)…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="wa-card p-4">
          <div className="font-medium">Nog geen klanten</div>
          <p className="text-sm text-gray-700 mt-1">
            Maak je eerste klant aan via de knop <span className="font-medium">+ Nieuwe klant</span>.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
          {filtered.map((k) => {
            const detailHref = returnTo
              ? `/admin/klanten/${k.id}?returnTo=${encodeURIComponent(returnTo)}`
              : `/admin/klanten/${k.id}`;
            const gearchiveerd = !k.actief || k.gearchiveerd_op !== null;

            return (
              <div
                key={k.id}
                className="wa-card wa-muted-card h-28 sm:h-24 flex flex-col justify-center hover:shadow-md hover:-translate-y-0.5 active:scale-95 transition duration-150 px-4"
              >
                <Link href={detailHref} className="flex-1 flex flex-col justify-center">
                  <div className={`text-base sm:text-sm font-semibold leading-snug ${gearchiveerd ? "text-gray-400" : "text-gray-800"}`}>
                    {k.naam}
                  </div>
                  {gearchiveerd && (
                    <div className="text-xs font-medium text-gray-400 mt-0.5">Gearchiveerd</div>
                  )}
                </Link>

              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}