"use client";

import "./globals.css";
import { ReactNode, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin } from "@/lib/auth";

export default function RootLayout({ children }: { children: ReactNode }) {
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
    <html lang="nl">
      <body className="min-h-screen bg-green-50">
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

            {isDoenkerAdmin && (
              <a
                href="/doenkers"
                className="bg-blue-900 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-800 transition"
              >
                Doenkers
              </a>
            )}
          </nav>

          <button
            onClick={logout}
            className="border rounded-xl px-3 py-1 text-sm"
          >
            Uitloggen
          </button>
        </header>

        <main>{children}</main>
      </body>
    </html>
  );
}
