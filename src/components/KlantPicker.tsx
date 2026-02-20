"use client";

import { useMemo, useState } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";

type Klant = { id: string; naam: string };

export function KlantPicker({
  klanten,
  value,
  onChange,
  required = false,
  allowCreate = true,
}: {
  klanten: Klant[];
  value: string | null;
  onChange: (klantId: string | null) => void;
  required?: boolean;
  allowCreate?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(() => {
    const current = klanten.find((k) => k.id === value);
    return current?.naam ?? "";
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return klanten.slice(0, 30);
    return klanten.filter((k) => k.naam.toLowerCase().includes(q)).slice(0, 30);
  }, [klanten, query]);

  const exactMatch = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return klanten.find((k) => k.naam.toLowerCase() === q) ?? null;
  }, [klanten, query]);

  const pick = (k: Klant) => {
    setQuery(k.naam);
    onChange(k.id);
  };

  const maybeCreate = () => {
    if (!allowCreate) return;
    const q = query.trim();
    if (!q) return;

    if (exactMatch) return; // bestaat al
    const ok = confirm(`Klant "${q}" bestaat niet. Nieuwe klant aanmaken?`);
    if (!ok) return;

    // returnTo = huidige pagina incl querystring
    const current = new URL(pathname, "http://dummy.local");
    const sp = new URLSearchParams(searchParams.toString());
    current.search = sp.toString();

    const target = new URL("/admin/klanten/nieuw", "http://dummy.local");
    target.searchParams.set("returnTo", current.pathname + (current.search ? `?${sp.toString()}` : ""));
    target.searchParams.set("prefillNaam", q);

    router.push(target.pathname + "?" + target.searchParams.toString());
  };

  return (
    <div className="space-y-2">
      <label className="block font-medium">Klant{required ? " (verplicht)" : ""}</label>

      <input
        className="w-full border rounded-xl p-3"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(null); // reset keuze zolang user typt
        }}
        onBlur={maybeCreate}
        placeholder="Begin te typen…"
      />

      <div className="border rounded-xl p-2 max-h-60 overflow-auto bg-white">
        {filtered.length === 0 ? (
          <div className="text-sm text-gray-600 p-2">Geen klanten gevonden.</div>
        ) : (
          filtered.map((k) => (
            <button
              type="button"
              key={k.id}
              onClick={() => pick(k)}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50"
            >
              {k.naam}
            </button>
          ))
        )}
      </div>

      {required && !value && (
        <div className="text-sm text-red-600">Selecteer een klant.</div>
      )}
    </div>
  );
}