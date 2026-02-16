"use client";

import { ReactNode, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { isAdminUser } from "@/lib/auth";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const admin = await isAdminUser(user.id);
      setOk(admin);
      setLoading(false);
    };

    run();
  }, []);

  if (loading) return <main className="p-8">Laden…</main>;

  if (!ok) {
    return (
      <main className="p-8 max-w-2xl">
        <h1 className="text-2xl font-bold mb-2">Beheer</h1>
        <p>Je hebt geen admin-rechten.</p>
      </main>
    );
  }

  return (
    <main className="p-8 max-w-3xl">
      <div className="flex flex-wrap gap-2 mb-6">
        <a className="border rounded-xl px-4 py-2" href="/admin/toevoegen">
          Toevoegen
        </a>
        <a className="border rounded-xl px-4 py-2" href="/admin/activiteiten">
          Beheren
        </a>
        <a className="border rounded-xl px-4 py-2" href="/admin/rollen">
          Autorisatie/rollen
        </a>
      </div>

      {children}
    </main>
  );
}
