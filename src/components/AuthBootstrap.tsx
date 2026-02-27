"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Props = {
  children: React.ReactNode;
  /** Als true: deze routes vereisen login en sturen door naar /login */
  requireAuth?: boolean;
};

export default function AuthBootstrap({ children, requireAuth = true }: Props) {
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    const provision = async (user: { id: string; email?: string | null }) => {
      // Maak/Update de vrijwilliger-rij (id = auth.uid())
      const { error } = await supabase
        .from("vrijwilligers")
        .upsert(
          {
            id: user.id,
            user_id: user.id,
            // naam: beter niet hard overschrijven als vrijwilliger zelf een naam kiest
            // Daarom alleen zetten als hij nog null is doen we later eventueel via DB.
            // Voor nu: we laten naam weg of vullen minimaal.
          },
          { onConflict: "id" }
        );

      return error?.message ?? null;
    };

    const run = async () => {
      setErr(null);

      const { data, error } = await supabase.auth.getSession();
      if (!alive) return;

      if (error) {
        setErr(error.message);
        setReady(true);
        return;
      }

      const user = data.session?.user;

      if (!user) {
        if (requireAuth) {
          // Protected route: naar login
          window.location.href = "/login";
          return;
        }
        // Public route: gewoon doorlaten
        setReady(true);
        return;
      }

      const msg = await provision({ id: user.id, email: user.email });
      if (!alive) return;

      if (msg) {
        setErr(msg);
        setReady(true);
        return;
      }

      setReady(true);
    };

    run();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;

      // Als user verandert (login/logout), opnieuw evalueren
      if (!session?.user) {
        if (requireAuth) {
          window.location.href = "/login";
          return;
        }
        setReady(true);
        return;
      }

      // User is ingelogd → provision opnieuw (idempotent)
      provision({ id: session.user.id, email: session.user.email }).then((msg) => {
        if (!alive) return;
        if (msg) setErr(msg);
        setReady(true);
      });
    });

    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, [requireAuth]);

  if (!ready) {
    return (
      <div className="p-6 text-sm text-slate-600">
        Even opstarten…
      </div>
    );
  }

  if (err) {
    return (
      <div className="p-6">
        <div className="rounded-xl border bg-red-50 text-red-800 p-4">
          Opstartfout: {err}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}