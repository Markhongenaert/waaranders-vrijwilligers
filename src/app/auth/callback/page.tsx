"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

async function goNext(userId: string) {
  // Kijk of er al een profiel bestaat met een naam
  const { data: prof, error } = await supabase
    .from("vrijwilligers")
    .select("naam")
    .eq("id", userId)
    .maybeSingle();

  // Als RLS of iets anders blokkeert, toon activiteiten (en we debuggen daarna)
  if (error) {
    console.error("Profiel-check fout:", error.message);
    window.location.href = "/activiteiten";
    return;
  }

  const hasName = !!prof?.naam && prof.naam.trim().length > 0;
  window.location.href = hasName ? "/activiteiten" : "/profiel";
}

export default function AuthCallbackPage() {
  useEffect(() => {
    let unsub: (() => void) | null = null;

    const run = async () => {
      // 1) Als sessie al bestaat (bv. refresh), meteen doorsturen
      const { data } = await supabase.auth.getSession();
      if (data.session?.user?.id) {
        await goNext(data.session.user.id);
        return;
      }

      // 2) Wacht op auth state change na klikken op magic link
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user?.id) {
          goNext(session.user.id);
        }
      });

      unsub = () => sub.subscription.unsubscribe();
    };

    run();

    return () => {
      if (unsub) unsub();
    };
  }, []);

  return (
    <main className="p-8">
      <h1 className="text-xl font-bold">Even geduld…</h1>
      <p>We ronden je login af.</p>
    </main>
  );
}
