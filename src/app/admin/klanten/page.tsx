"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin } from "@/lib/auth";

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

    const ok = await isDoenkerOrAdmin();
    setAllowed(ok);
    if (!ok) {
      setLoading(false);
      return;
    }

    // Alleen actieve + niet-gearchiveerde klanten tonen
    const { data: rows, error: e } = await supabase
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
          <p className="text-sm text-gray-600">
            Beheer de klanten. (Archiveren zit voorlopig bewust niet in de UI.)
          </p>
        </div>

        <div className="flex gap-2">
          <Link className="border rounded-xl px-3 py-2 text-sm" href={nieuwHref}>
            + Nieuwe klant
          </Link>
          <button className="border rounded-xl px-3 py-2 text-sm" onClick={load}>
            Refresh
          </button>
        </div>
      </div>

      {error && <p className="text-red-600 mb-4">Fout: {error}</p>}

      <div className="mb-4">
        <input
          className="w-full border rounded-xl p-3"
          placeholder="Zoek klant (naam, contactpersoon, telefoon, adres)…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="border rounded-2xl p-4 bg-white/80 shadow-sm">
          <div className="font-medium">Nog geen klanten</div>
          <p className="text-sm text-gray-700 mt-1">
            Maak je eerste klant aan via <span className="font-medium">“+ Nieuwe klant”</span>.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {/* Tegel “Nieuwe klant” bovenaan (extra groot klikdoel) */}
          <li className="border rounded-2xl p-4 bg-white/80 shadow-sm">
            <Link href={nieuwHref} className="block">
              <div className="font-medium">+ Nieuwe klant</div>
              <div className="text-sm text-gray-600 mt-1">Klant toevoegen</div>
            </Link>
          </li>

          {filtered.map((k) => {
            const detailHref = returnTo
              ? `/admin/klanten/${k.id}?returnTo=${encodeURIComponent(returnTo)}`
              : `/admin/klanten/${k.id}`;

            return (
              <li key={k.id} className="border rounded-2xl p-4 bg-white/80 shadow-sm">
                <Link href={detailHref} className="block">
                  <div className="font-medium whitespace-pre-line break-words">{k.naam}</div>

                  <div className="text-sm text-gray-700 mt-2">
                    {k.contactpersoon_naam ? (
                      <span>Contact: {k.contactpersoon_naam}</span>
                    ) : (
                      <span className="text-gray-500">Geen contactpersoon</span>
                    )}
                    {k.contactpersoon_telefoon ? ` • ${k.contactpersoon_telefoon}` : ""}
                  </div>

                  {k.adres && <div className="text-sm text-gray-600 mt-1 whitespace-pre-line">{k.adres}</div>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}