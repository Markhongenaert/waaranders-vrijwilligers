"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AuthBootstrap() {
  useEffect(() => {
    const ensureProfile = async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) return;

      const { error } = await supabase
        .from("vrijwilligers")
        .upsert(
          {
            id: user.id,
            user_id: user.id,
            naam: user.email,
          },
          { onConflict: "id" }
        );

      if (error) {
        console.error("Profiel upsert fout:", error.message);
      }
    };

    ensureProfile();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          ensureProfile();
        }
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  return null;
}