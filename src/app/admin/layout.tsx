"use client";

export const dynamic = "force-dynamic";

import { ReactNode, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin } from "@/lib/auth";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

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
      setLoading(false);
    };

    init();
  }, []);

  if (loading) return <main className="p-8">Laden…</main>;

  if (!allowed) {
    return (
      <main className="p-8 max-w-3xl">
        <h2 className="text-2xl font-bold mb-2">Beheer</h2>
        <p>Je hebt geen rechten om deze pagina te bekijken.</p>
      </main>
    );
  }

  return <>{children}</>;
}