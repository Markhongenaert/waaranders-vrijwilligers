"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin } from "@/lib/auth";
import VrijwilligerDetail from "../VrijwilligerDetail";

type InteresseMini = { titel: string | null };
type RolMini = { titel: string | null };

type VrijwilligerFull = {
  id: string;
  voornaam: string | null;
  achternaam: string | null;
  telefoon: string | null;
  adres: string | null;

  vrijwilliger_interesses:
    | { interesses: InteresseMini | InteresseMini[] | null }
    | { interesses: InteresseMini | InteresseMini[] | null }[]
    | null;

  vrijwilliger_roles:
    | { roles: RolMini | RolMini[] | null }
    | { roles: RolMini | RolMini[] | null }[]
    | null;
};

export default function VrijwilligerDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const q = (searchParams.get("q") ?? "").trim();

  const id = params?.id;

  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [vrijwilliger, setVrijwilliger] = useState<VrijwilligerFull | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const ok = await isDoenkerOrAdmin();
      if (!mounted) return;
      setAllowed(ok);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (allowed !== true) return;
    if (!id) return;

    let mounted = true;
    (async () => {
      setLoading(true);
      setErr(null);

      try {
        const { data, error } = await supabase
          .from("vrijwilligers")
          .select(
            `
            id,
            voornaam,
            achternaam,
            telefoon,
            adres,
            vrijwilliger_interesses(
              interesses(titel)
            ),
            vrijwilliger_roles!vr_vrijwilliger_fkey(
              roles(titel)
            )
          `
          )
          .eq("id", id)
          .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error("Vrijwilliger niet gevonden.");

        if (!mounted) return;
        setVrijwilliger(data as VrijwilligerFull);
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message ?? "Fout bij laden.");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [allowed, id]);

  if (allowed === null) return <main className="p-6">Laden…</main>;

  if (allowed === false) {
    return (
      <main className="p-6">
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-800">
          Geen toegang.
        </div>
      </main>
    );
  }

  return (
    <main className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Vrijwilliger</h1>
        <a
          className="border rounded-xl px-4 py-2"
          href={`/admin/vrijwilligers${q ? `?q=${encodeURIComponent(q)}` : ""}`}
        >
          Terug
        </a>
      </div>

      {err && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-red-700">
          {err}
        </div>
      )}

      {loading ? (
        <div className="text-gray-600">Laden…</div>
      ) : vrijwilliger ? (
        <VrijwilligerDetail
          vrijwilliger={vrijwilliger}
          onSaved={(patch) =>
            setVrijwilliger((prev) => (prev ? { ...prev, ...patch } : prev))
          }
          returnHref={`/admin/vrijwilligers${q ? `?q=${encodeURIComponent(q)}` : ""}`}
        />
      ) : (
        <div className="text-gray-600">Geen data.</div>
      )}
    </main>
  );
}