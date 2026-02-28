"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin, isMyVolunteerActive } from "@/lib/auth";

export default function AppHeader() {
  const [isDoenkerAdmin, setIsDoenkerAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user ?? null;

      if (!user) {
        if (!cancelled) setIsDoenkerAdmin(false);
        return;
      }

      // 🔒 geblokkeerde/gearchiveerde vrijwilliger -> uitloggen + melding
      const active = await isMyVolunteerActive();
      if (!active) {
        await supabase.auth.signOut();
        window.location.href = "/login?blocked=1";
        return;
      }

      const ok = await isDoenkerOrAdmin();
      if (!cancelled) setIsDoenkerAdmin(ok);
    };

    // eerste init
    init();

    // ✅ luister naar login/logout en refresh meteen
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setIsDoenkerAdmin(false);
        return;
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        // kleine tick zodat session zeker beschikbaar is
        setTimeout(() => {
          if (!cancelled) init();
        }, 0);
      }
    });

    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe();
    };
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
              href="/admin"
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