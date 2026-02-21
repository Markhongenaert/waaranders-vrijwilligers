"use client";

import "./globals.css";
import React, { ReactNode, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin } from "@/lib/auth";

export default function RootLayout({ children }: { children: ReactNode }) {
  const [isDoenkerAdmin, setIsDoenkerAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const user = data.session?.user ?? null;

        if (!user) {
          setIsDoenkerAdmin(false);
          setChecking(false);
          return;
        }

        const ok = await isDoenkerOrAdmin();
        setIsDoenkerAdmin(ok);
      } finally {
        setChecking(false);
      }
    };

    init();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <html lang="nl" className="min-h-full">
      {/* body background kan door globals.css overschreven worden,
          daarom zetten we de echte achtergrond op een wrapper div */}
      <body className="min-h-full">
        <div className="min-h-screen bg-gray-100>
          <header className="border-b p-4 flex justify-between items-center bg-white">
            <nav className="flex gap-2 items-center">
              <a
                href="/activiteiten"
                className="bg-blue-900 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-800 transition"
              >
                Activiteiten
              </a>

              <a
                href="/profiel"
                className="bg-blue-900 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-800 transition"
              >
                Profiel
              </a>

              {!checking && isDoenkerAdmin && (
                <a
                  href="/doenkers"
                  className="bg-blue-900 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-800 transition"
                >
                  Doenkers
                </a>
              )}
            </nav>

            <button onClick={logout} className="border rounded-xl px-3 py-2 text-sm bg-white">
              Uitloggen
            </button>
          </header>

          {/* main krijgt geen achtergrond -> groene wrapper blijft zichtbaar */}
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}