"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin } from "@/lib/auth";

type VolunteerStatus = "active" | "inactive" | "missing" | "error";

/**
 * Bepaalt of de ingelogde gebruiker een vrijwilligersrij heeft en of die actief is.
 * Belangrijk: "missing" en "error" zijn géén "inactive".
 */
async function getMyVolunteerStatus(): Promise<VolunteerStatus> {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) return "error";
  const user = userRes.user;
  if (!user) return "error";

  // Gebruik de echte tabel, niet vrijwilligers_public
  const { data: v, error: vErr } = await supabase
    .from("vrijwilligers")
    .select("actief")
    .eq("id", user.id)
    .maybeSingle();

  if (vErr) {
    // Dit is typisch "permission denied"/RLS/probleem → NIET als blocked behandelen
    console.warn("[AppHeader] vrijwilligers select error:", vErr);
    return "error";
  }

  if (!v) return "missing";
  return v.actief === false ? "inactive" : "active";
}

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

      // 🔒 Alleen blokkeren als we zeker weten: actief=false
      const status = await getMyVolunteerStatus();

      if (status === "inactive") {
        await supabase.auth.signOut();
        window.location.href = "/login?blocked=1";
        return;
      }

      // status === "missing": onboarding (rij bestaat nog niet) → NIET uitloggen
      // status === "error": technische DB/RLS fout → NIET uitloggen + NIET blocked
      // Je kan dit desnoods later beter afhandelen via /login?err=1

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
          <a href="/activiteiten" className="wa-btn wa-btn-brand px-4 py-2 text-sm font-semibold">
            Activiteiten
          </a>

          <a href="/profiel" className="wa-btn wa-btn-brand px-4 py-2 text-sm font-semibold">
            Profiel
          </a>

          {isDoenkerAdmin && (
            <a href="/admin" className="wa-btn wa-btn-brand px-4 py-2 text-sm font-semibold">
              Doenkers
            </a>
          )}
        </nav>

        <button onClick={logout} className="wa-btn wa-btn-ghost px-3 py-2 text-sm font-medium">
          Uitloggen
        </button>
      </div>
    </header>
  );
}