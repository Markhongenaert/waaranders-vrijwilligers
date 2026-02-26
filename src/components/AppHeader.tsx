"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin } from "@/lib/auth";

export default function AppHeader() {
  const [isDoenkerAdmin, setIsDoenkerAdmin] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user ?? null;

      if (!user) {
        setIsDoenkerAdmin(false);
        return;
      }

      const ok = await isDoenkerOrAdmin();
      setIsDoenkerAdmin(ok);
    };

    init();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <header className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <nav className="flex items-center gap-2 sm:gap-3">
          <a
            href="/activiteiten"
            className="wa-btn wa-btn-brand px-4 py-2 text-sm font-semibold"
          >
            Activiteiten
          </a>

          <a
            href="/profiel"
            className="wa-btn wa-btn-brand px-4 py-2 text-sm font-semibold"
          >
            Profiel
          </a>

          {isDoenkerAdmin && (
            <a
              href="/doenkers"
              className="wa-btn wa-btn-brand px-4 py-2 text-sm font-semibold"
            >
              Doenkers
            </a>
          )}
        </nav>

        <button
          onClick={logout}
          className="wa-btn wa-btn-ghost px-3 py-2 text-sm font-medium"
        >
          Uitloggen
        </button>
      </div>
    </header>
  );
}