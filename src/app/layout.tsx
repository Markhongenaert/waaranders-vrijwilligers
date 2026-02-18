"use client";

import "./globals.css";
import { ReactNode, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin } from "@/lib/auth";

export default function RootLayout({ children }: { children: ReactNode }) {
  const [userNaam, setUserNaam] = useState<string | null>(null);
  const [canBeheer, setCanBeheer] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user ?? null;

      if (!user) {
        setUserNaam(null);
        setCanBeheer(false);
        return;
      }

      // 🔹 naam ophalen uit vrijwilligers
      const { data: v } = await supabase
        .from("vrijwilligers")
        .select("naam")
        .eq("id", user.id)
        .maybeSingle();

      setUserNaam(v?.naam ?? null);

      const ok = await isDoenkerOrAdmin();
      setCanBeheer(ok);
    };

    init();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <html lang="nl">
      <body>
        <header className="border-b p-4 flex justify-between items-center">
          <nav className="flex gap-3 items-center">
            <a href="/activiteiten" className="font-semibold">
              Activiteiten
            </a>
            <a href="/profiel" className="font-semibold">
              Profiel
            </a>

            {canBeheer && (
              <a href="/doenkers" className="font-semibold">
                Doenkers
              </a>
            )}
          </nav>

          <div className="flex gap-4 items-center">
            {userNaam && (
              <>
                <span className="text-sm text-gray-700 font-medium">
                  {userNaam}
                </span>
                <button
                  onClick={logout}
                  className="border rounded-xl px-3 py-1 text-sm"
                >
                  Uitloggen
                </button>
              </>
            )}
          </div>
        </header>

        <main>{children}</main>
      </body>
    </html>
  );
}
