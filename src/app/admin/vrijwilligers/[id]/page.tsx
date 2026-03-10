"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin, isAdmin as checkIsAdmin } from "@/lib/auth";
import VrijwilligerDetail from "../VrijwilligerDetail";

type RolMini = { titel: string | null };
type WerkgroepMini = { titel: string | null };

type VrijwilligerFull = {
  id: string;
  voornaam: string | null;
  achternaam: string | null;
  telefoon: string | null;
  adres: string | null;
  actief: boolean | null;

  werkgroep_deelnemers:
    | { werkgroepen: WerkgroepMini | WerkgroepMini[] | null }
    | { werkgroepen: WerkgroepMini | WerkgroepMini[] | null }[]
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
  const [adminUser, setAdminUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [vrijwilliger, setVrijwilliger] = useState<VrijwilligerFull | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [ok, admin] = await Promise.all([isDoenkerOrAdmin(), checkIsAdmin()]);
      if (!mounted) return;
      setAllowed(ok);
      setAdminUser(admin);
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
            actief,
            werkgroep_deelnemers(
              werkgroepen(titel)
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

        // Doenkers mogen geen gearchiveerde vrijwilligers inzien
        if (!adminUser && data.actief === false) {
          throw new Error("Geen toegang.");
        }

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
  }, [allowed, adminUser, id]);

  if (allowed === null) return <main className="p-6">Laden…</main>;

  if (allowed === false) {
    return (
      <main className="p-6">
        <div className="wa-alert-error">
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
          className="wa-btn wa-btn-ghost px-4 py-2"
          href={`/admin/vrijwilligers${q ? `?q=${encodeURIComponent(q)}` : ""}`}
        >
          Terug
        </a>
      </div>

      {err && (
        <div className="wa-alert-error">
          {err}
        </div>
      )}

      {loading ? (
        <div className="text-gray-600">Laden…</div>
      ) : vrijwilliger ? (
        <VrijwilligerDetail
          vrijwilliger={vrijwilliger}
          isAdmin={adminUser}
          onSaved={(patch) =>
            setVrijwilliger((prev) => (prev ? { ...prev, ...patch } : prev))
          }
          onActiefChanged={(actief) =>
            setVrijwilliger((prev) => (prev ? { ...prev, actief } : prev))
          }
          returnHref={`/admin/vrijwilligers${q ? `?q=${encodeURIComponent(q)}` : ""}`}
        />
      ) : (
        <div className="text-gray-600">Geen data.</div>
      )}
    </main>
  );
}
