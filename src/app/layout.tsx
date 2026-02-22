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
      <body className="min-h-screen bg-gray-500 text-gray-900">
        {/* Header */}
        <header className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
            <nav className="flex items-center gap-2 sm:gap-3">
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
              className="bg-white border border-gray-300 rounded-xl px-3 py-2 text-sm font-medium hover:bg-gray-50 transition"
            >
              Uitloggen
            </button>
          </div>
        </header>

        {/* Page container */}
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8">
          {/* “Content surface” zodat het niet “zweeft” op grijs */}
          <div className="rounded-3xl bg-white shadow-sm border border-gray-200">
            <div className="p-4 sm:p-6">{children}</div>
          </div>
        </div>
      </body>
    </html>
  );
}