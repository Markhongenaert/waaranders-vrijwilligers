"use client";

import { useEffect, useState } from "react";
import { isDoenkerOrAdmin } from "@/lib/auth";

export default function DoenkerGuard({
  children,
  redirectTo = "/",
}: {
  children: React.ReactNode;
  redirectTo?: string;
}) {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      const ok = await isDoenkerOrAdmin();
      if (!alive) return;
      setAllowed(ok);

      if (!ok) {
        window.location.href = redirectTo;
      }
    })();

    return () => {
      alive = false;
    };
  }, [redirectTo]);

  if (allowed === null) return <p className="p-8">Toegang controleren…</p>;
  if (!allowed) return null;

  return <>{children}</>;
}