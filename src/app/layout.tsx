"use client";

import "./globals.css";
import { ReactNode, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { isAdminUser } from "@/lib/auth";

export default function RootLayout({ children }: { children: ReactNode }) {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userNaam, setUserNaam] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user ?? null;

      if (!user) {
        setUserEmail(null);
        setUserNaam(null);
        setIsAdmin(false);
        return;
      }

      setUserEmail(user.email ?? null);

      // Naam ophalen uit vrijwilligers
      const { data: prof, error: profErr } = await supabase
        .from("vrijwilligers")
        .select("naam")
        .eq("id", user.id)
        .maybeSingle();

      if (profErr) {
        console.error("Kon naam niet laden:", profErr.message);
        setUserNaam(null);
      } else {
        setUserNaam(prof?.naam ?? null);
      }

      const admin = await isAdminUser(user.id);
      setIsAdmin(admin);
    };

    init();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const displayUser =
    userNaam && userNaam.trim().length > 0
      ? `${userNaam}${userEmail ? ` (${userEmail})` : ""}`
      : userEmail;

  return (
    <html lang="nl">
      <head>
  <link rel="manifest" href="/manifest.webmanifest" />
  <meta name="theme-color" content="#E9F1E6" />
  <link rel="apple-touch-icon" href="/icon-192.png" />
</head>

      <body>
        <header className="border-b p-4 flex justify-between items-center">
          <nav className="flex gap-3 items-center">
            <a href="/activiteiten" className="font-semibold">
              Waaranders
            </a>

            {isAdmin && (
              <>
                <a href="/admin/toevoegen" className="font-semibold">
                  Toevoegen
                </a>
                <a href="/admin/activiteiten" className="font-semibold">
                  Beheren
                </a>
                <a href="/admin/rollen" className="font-semibold">
                  Rollen
                </a>
              </>
            )}
          </nav>

          <div className="flex gap-4 items-center">
            {userEmail && (
              <>
                <span className="text-sm text-gray-600">{displayUser}</span>
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
