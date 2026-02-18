"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin, isAdmin } from "@/lib/auth";

export default function DoenkersPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [canAdmin, setCanAdmin] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user ?? null;

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const ok = await isDoenkerOrAdmin();
      setAllowed(ok);

      if (ok) {
        const a = await isAdmin();
        setCanAdmin(a);
      }

      setLoading(false);
    };

    init();
  }, []);

  if (loading) return <main className="mx-auto max-w-3xl p-6 md:p-10">Laden…</main>;

  if (!allowed) {
    return (
      <main className="mx-auto max-w-3xl p-6 md:p-10">
        <h1 className="text-3xl font-semibold tracking-tight mb-2">Doenkers</h1>
        <p>Je hebt geen rechten om deze pagina te bekijken.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-6 md:p-10">
      <h1 className="text-3xl font-semibold tracking-tight mb-4">Doenkers</h1>

      <div className="border rounded-2xl p-2 bg-white/80 shadow-sm flex gap-2 flex-wrap">
        <a className="border rounded-xl px-3 py-2 text-sm" href="/admin/toevoegen">
          Toevoegen
        </a>
        <a className="border rounded-xl px-3 py-2 text-sm" href="/admin/activiteiten">
          Beheren
        </a>
        <a className="border rounded-xl px-3 py-2 text-sm" href="/admin/todos">
          Todo
        </a>
        {canAdmin && (
          <a className="border rounded-xl px-3 py-2 text-sm" href="/admin/rollen">
            Admin
          </a>
        )}
      </div>

      <p className="text-gray-600 mt-4">
        Kies hierboven een onderdeel. (De inhoud zit in de bestaande pagina’s.)
      </p>
    </main>
  );
}
