# Vakantieplanning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Voeg een vakantieplanning-feature toe aan het admin-gedeelte met een invoertabblad en een maandkalender.

**Architecture:** Eén "use client" pagina met twee tabbladen. Tab 1 bevat een dropdown + CRUD voor vakantieperioden per doenker/admin. Tab 2 bevat een zelfgebouwde maandkalender (geen externe libs) die badges toont per dag op basis van aanwezigheidstelling. Alle Supabase-aanroepen gaan via de browser-client (supabaseClient.ts) omdat de pagina volledig client-side is.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Supabase browser client

---

## File Structure

| Bestand | Actie | Verantwoordelijkheid |
|---|---|---|
| `src/app/admin/page.tsx` | Modify | Voeg "Vakanties" tegel toe |
| `src/app/admin/vakanties/page.tsx` | Create | Hoofd-pagina: tab-switching, auth-check, data fetching |
| `src/app/admin/vakanties/_components/InvoerenTab.tsx` | Create | Tab 1: dropdown + vakantieperioden CRUD |
| `src/app/admin/vakanties/_components/KalenderTab.tsx` | Create | Tab 2: maandkalender met badges + popup |

---

### Task 1: Tegel toevoegen op admin-pagina

**Files:**
- Modify: `src/app/admin/page.tsx`

- [ ] **Stap 1: Voeg "Vakanties" toe aan de tiles-array**

Voeg `{ title: "Vakanties", href: "/admin/vakanties" }` toe na de "Werkgroepen" tegel in de array.

```tsx
const tiles = [
  { title: "Activiteiten", href: "/admin/activiteiten" },
  { title: "Klanten", href: "/admin/klanten" },
  { title: "Vrijwilligers", href: "/admin/vrijwilligers" },
  { title: "Werkgroepen", href: "/admin/werkgroepen" },
  { title: "Vakanties", href: "/admin/vakanties" },
  { title: "Todo", href: "/admin/todos" },
  { title: "Admin", href: "/admin/admins" },
];
```

- [ ] **Stap 2: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat: voeg Vakanties-tegel toe op doenkerspagina"
```

---

### Task 2: Hoofdpagina met tab-switching en auth-check

**Files:**
- Create: `src/app/admin/vakanties/page.tsx`

- [ ] **Stap 1: Maak de hoofdpagina aan**

De pagina checkt `isDoenkerOrAdmin()`, laadt alle actieve doenkers/admins en alle vakantieperioden, en geeft die door aan de twee tab-componenten. Tabbladen wisselen via lokale state.

```tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin } from "@/lib/auth";
import InvoerenTab from "./_components/InvoerenTab";
import KalenderTab from "./_components/KalenderTab";

export type Doenker = {
  id: string;
  voornaam: string | null;
  achternaam: string | null;
};

export type VakantiePerio = {
  id: string;
  vrijwilliger_id: string;
  begin_datum: string; // ISO "YYYY-MM-DD"
  eind_datum: string;
};

export default function VakantiesPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"invoeren" | "kalender">("invoeren");
  const [doenkers, setDoenkers] = useState<Doenker[]>([]);
  const [perioden, setPerioden] = useState<VakantiePerio[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const ok = await isDoenkerOrAdmin();
      if (!mounted) return;
      setAllowed(ok);
    })();
    return () => { mounted = false; };
  }, []);

  const loadData = async () => {
    setLoading(true);
    setErr(null);
    try {
      // Haal alle actieve vrijwilligers op met rol doenker of admin
      const { data: roleData, error: roleErr } = await supabase
        .from("vrijwilliger_roles")
        .select("vrijwilliger_id, roles(code), vrijwilligers(id, voornaam, achternaam, actief)")
        .in("roles.code", ["doenker", "admin"]);
      if (roleErr) throw roleErr;

      // Filter: actief=true en rol is doenker of admin
      const seen = new Set<string>();
      const uniqueDoenkers: Doenker[] = [];
      for (const r of roleData ?? []) {
        const v = (r as any).vrijwilligers;
        const roleCode = (r as any).roles?.code;
        if (!v || v.actief === false) continue;
        if (!["doenker", "admin"].includes(roleCode)) continue;
        if (seen.has(v.id)) continue;
        seen.add(v.id);
        uniqueDoenkers.push({ id: v.id, voornaam: v.voornaam, achternaam: v.achternaam });
      }
      uniqueDoenkers.sort((a, b) => {
        const an = (a.achternaam ?? "") + (a.voornaam ?? "");
        const bn = (b.achternaam ?? "") + (b.voornaam ?? "");
        return an.localeCompare(bn, "nl");
      });

      // Haal alle vakantieperioden op
      const { data: periData, error: periErr } = await supabase
        .from("vakantie_perioden")
        .select("id, vrijwilliger_id, begin_datum, eind_datum")
        .order("begin_datum", { ascending: true });
      if (periErr) throw periErr;

      setDoenkers(uniqueDoenkers);
      setPerioden((periData ?? []) as VakantiePerio[]);
    } catch (e: any) {
      setErr(e?.message ?? "Fout bij laden.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (allowed !== true) return;
    loadData();
  }, [allowed]);

  if (allowed === null) return <main className="p-6">Laden…</main>;
  if (allowed === false) {
    return (
      <main className="p-6">
        <div className="wa-alert-error">Geen toegang.</div>
      </main>
    );
  }

  return (
    <main className="p-5 sm:p-6 space-y-4">
      <h1 className="text-xl font-semibold">Vakanties</h1>

      {err && <div className="wa-alert-error">{err}</div>}

      {/* Tabbladen */}
      <div className="flex border-b border-gray-200">
        {(["invoeren", "kalender"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "invoeren" ? "Vakanties invoeren" : "Kalender"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-gray-600">Laden…</div>
      ) : tab === "invoeren" ? (
        <InvoerenTab doenkers={doenkers} perioden={perioden} onRefresh={loadData} />
      ) : (
        <KalenderTab doenkers={doenkers} perioden={perioden} />
      )}
    </main>
  );
}
```

- [ ] **Stap 2: Commit (leeg skelet, tab-switch werkt)**

```bash
git add src/app/admin/vakanties/page.tsx
git commit -m "feat: voeg vakanties pagina toe met tab-switching en data loading"
```

---

### Task 3: Tab 1 — Vakanties invoeren

**Files:**
- Create: `src/app/admin/vakanties/_components/InvoerenTab.tsx`

- [ ] **Stap 1: Maak InvoerenTab aan**

Props: `doenkers`, `perioden`, `onRefresh`. State: geselecteerde doenker, invoerformulier open/dicht, begin/eindatum velden, errormeldingen.

```tsx
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Doenker, VakantiePerio } from "../page";

type Props = {
  doenkers: Doenker[];
  perioden: VakantiePerio[];
  onRefresh: () => Promise<void>;
};

function fullName(d: Doenker) {
  return [d.voornaam ?? "", d.achternaam ?? ""].join(" ").trim() || "—";
}

export default function InvoerenTab({ doenkers, perioden, onRefresh }: Props) {
  const [selectedId, setSelectedId] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [beginDatum, setBeginDatum] = useState("");
  const [eindDatum, setEindDatum] = useState("");
  const [formErr, setFormErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const myPerioden = perioden.filter((p) => p.vrijwilliger_id === selectedId);

  const handleAdd = async () => {
    setFormErr(null);
    if (!beginDatum || !eindDatum) {
      setFormErr("Vul beide datums in.");
      return;
    }
    if (eindDatum < beginDatum) {
      setFormErr("Einddatum moet gelijk aan of later zijn dan de begindatum.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("vakantie_perioden").insert({
        vrijwilliger_id: selectedId,
        begin_datum: beginDatum,
        eind_datum: eindDatum,
      });
      if (error) throw error;
      setShowForm(false);
      setBeginDatum("");
      setEindDatum("");
      await onRefresh();
    } catch (e: any) {
      setFormErr(e?.message ?? "Fout bij opslaan.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Weet je zeker dat je deze vakantieperiode wil verwijderen?")) return;
    setDeletingId(id);
    try {
      const { error } = await supabase.from("vakantie_perioden").delete().eq("id", id);
      if (error) throw error;
      await onRefresh();
    } catch (e: any) {
      alert(e?.message ?? "Fout bij verwijderen.");
    } finally {
      setDeletingId(null);
    }
  };

  function formatDate(iso: string) {
    // "YYYY-MM-DD" → "DD/MM/YYYY"
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }

  return (
    <div className="space-y-4 max-w-lg">
      {/* Dropdown */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Kies een doenker
        </label>
        <select
          className="w-full border rounded-xl p-3 text-sm"
          value={selectedId}
          onChange={(e) => {
            setSelectedId(e.target.value);
            setShowForm(false);
            setFormErr(null);
          }}
        >
          <option value="">— selecteer —</option>
          {doenkers.map((d) => (
            <option key={d.id} value={d.id}>
              {fullName(d)}
            </option>
          ))}
        </select>
      </div>

      {selectedId && (
        <>
          {/* Bestaande perioden */}
          <div className="space-y-2">
            {myPerioden.length === 0 ? (
              <p className="text-sm text-gray-500">Geen vakantieperioden gevonden.</p>
            ) : (
              myPerioden.map((p) => (
                <div
                  key={p.id}
                  className="wa-card flex items-center justify-between px-4 py-3"
                >
                  <span className="text-sm text-gray-800">
                    {formatDate(p.begin_datum)} – {formatDate(p.eind_datum)}
                  </span>
                  <button
                    onClick={() => handleDelete(p.id)}
                    disabled={deletingId === p.id}
                    className="wa-btn-danger text-xs px-3 py-1"
                  >
                    {deletingId === p.id ? "Verwijderen…" : "Verwijderen"}
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Knop Periode toevoegen */}
          {!showForm && (
            <button
              onClick={() => { setShowForm(true); setFormErr(null); }}
              className="wa-btn wa-btn-brand px-4 py-2 text-sm"
            >
              + Periode toevoegen
            </button>
          )}

          {/* Invoerformulier */}
          {showForm && (
            <div className="wa-card p-4 space-y-3">
              {formErr && <div className="wa-alert-error text-sm">{formErr}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Eerste dag
                </label>
                <input
                  type="date"
                  className="w-full border rounded-xl p-2.5 text-sm"
                  value={beginDatum}
                  onChange={(e) => setBeginDatum(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Laatste dag
                </label>
                <input
                  type="date"
                  className="w-full border rounded-xl p-2.5 text-sm"
                  value={eindDatum}
                  onChange={(e) => setEindDatum(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  disabled={saving}
                  className="wa-btn wa-btn-brand px-4 py-2 text-sm"
                >
                  {saving ? "Opslaan…" : "Opslaan"}
                </button>
                <button
                  onClick={() => { setShowForm(false); setBeginDatum(""); setEindDatum(""); setFormErr(null); }}
                  className="wa-btn wa-btn-ghost px-4 py-2 text-sm"
                >
                  Annuleren
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Stap 2: Commit**

```bash
git add src/app/admin/vakanties/_components/InvoerenTab.tsx
git commit -m "feat: voeg InvoerenTab toe voor vakantieperioden CRUD"
```

---

### Task 4: Tab 2 — Kalender

**Files:**
- Create: `src/app/admin/vakanties/_components/KalenderTab.tsx`

- [ ] **Stap 1: Maak KalenderTab aan**

Props: `doenkers`, `perioden`. State: huidige maand/jaar, popup-dag. Logica: bereken per dag hoeveel doenkers NIET op vakantie zijn, toon badge met kleur.

Kalender bouwstenen:
- `getDaysInMonth(year, month)` → array van Date-objecten voor de maand
- `getFirstWeekday(year, month)` → 0-6 (ma=0 t/m zo=6) als offset voor het eerste vakje
- Per dag: tel doenkers waarvoor GEEN vakantie overlapping is op die datum
- Badge-kleuren: ≥6 = groen, 4-5 = oranje, ≤3 = rood

Scroll-navigatie: `onWheel` event op de kalender-container, `deltaY > 0` = volgende maand, `< 0` = vorige maand.

```tsx
"use client";

import { useState, useCallback } from "react";
import type { Doenker, VakantiePerio } from "../page";

type Props = {
  doenkers: Doenker[];
  perioden: VakantiePerio[];
};

const MAANDEN = [
  "januari","februari","maart","april","mei","juni",
  "juli","augustus","september","oktober","november","december",
];
const WEEKDAGEN = ["Ma","Di","Wo","Do","Vr","Za","Zo"];

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fullName(d: Doenker) {
  return [d.voornaam ?? "", d.achternaam ?? ""].join(" ").trim() || "—";
}

// Geeft maandag-gebaseerde weekdag index (0=ma, 6=zo)
function mondayBasedDay(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function isOnVakantie(p: VakantiePerio, iso: string): boolean {
  return p.begin_datum <= iso && iso <= p.eind_datum;
}

export default function KalenderTab({ doenkers, perioden }: Props) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-11
  const [popup, setPopup] = useState<{ iso: string; aanwezig: Doenker[] } | null>(null);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY > 0) nextMonth();
    else prevMonth();
  }, [month, year]);

  // Bouw dag-array voor deze maand
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const offset = mondayBasedDay(firstDay); // lege vakjes vooraan

  const days: Date[] = [];
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d));
  }

  // Bereken aanwezige doenkers per dag
  function getAanwezig(date: Date): Doenker[] {
    const iso = toISO(date);
    return doenkers.filter((d) => {
      const opVakantie = perioden.some(
        (p) => p.vrijwilliger_id === d.id && isOnVakantie(p, iso)
      );
      return !opVakantie;
    });
  }

  function badgeColor(count: number): string {
    if (count >= 6) return "bg-green-500";
    if (count >= 4) return "bg-orange-500";
    return "bg-red-500";
  }

  return (
    <div className="space-y-3">
      {/* Navigatie */}
      <div className="flex items-center gap-4">
        <button onClick={prevMonth} className="wa-btn wa-btn-ghost px-3 py-1.5 text-sm">
          ‹
        </button>
        <span className="font-semibold text-gray-800 min-w-[160px] text-center">
          {MAANDEN[month]} {year}
        </span>
        <button onClick={nextMonth} className="wa-btn wa-btn-ghost px-3 py-1.5 text-sm">
          ›
        </button>
      </div>

      {/* Kalender grid */}
      <div
        className="select-none"
        onWheel={handleWheel}
      >
        {/* Weekdagnamen */}
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAGEN.map((d) => (
            <div key={d} className="text-xs font-medium text-gray-500 text-center py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Dagen */}
        <div className="grid grid-cols-7 gap-1">
          {/* Lege vakjes offset */}
          {Array.from({ length: offset }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}

          {days.map((date) => {
            const iso = toISO(date);
            const aanwezig = getAanwezig(date);
            const color = badgeColor(aanwezig.length);
            const isToday = iso === toISO(now);

            return (
              <div
                key={iso}
                className={`rounded-lg p-1 flex flex-col items-center gap-0.5 cursor-pointer hover:bg-gray-50 transition ${
                  isToday ? "ring-2 ring-blue-400" : ""
                }`}
                onClick={() => setPopup({ iso, aanwezig })}
              >
                <span className="text-xs text-gray-700 font-medium leading-none">
                  {date.getDate()}
                </span>
                <span
                  className={`text-xs font-bold text-white rounded-full px-1.5 py-0.5 leading-none ${color}`}
                >
                  {aanwezig.length}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Popup */}
      {popup && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="wa-card p-5 w-full max-w-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">
                Aanwezig op {popup.iso.split("-").reverse().join("/")}
              </h2>
              <button
                onClick={() => setPopup(null)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>
            {popup.aanwezig.length === 0 ? (
              <p className="text-sm text-gray-500">Niemand aanwezig.</p>
            ) : (
              <ul className="space-y-1">
                {popup.aanwezig.map((d) => (
                  <li key={d.id} className="text-sm text-gray-700">
                    {fullName(d)}
                  </li>
                ))}
              </ul>
            )}
            <button
              onClick={() => setPopup(null)}
              className="wa-btn wa-btn-ghost w-full py-2 text-sm"
            >
              Sluiten
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Stap 2: Commit**

```bash
git add src/app/admin/vakanties/_components/KalenderTab.tsx
git commit -m "feat: voeg KalenderTab toe met maandkalender en aanwezigheidsbadges"
```

---

### Task 5: Handmatige verificatie

- [ ] Start de dev-server: `npm run dev`
- [ ] Open `/admin` → controleer dat de "Vakanties" tegel zichtbaar is
- [ ] Navigeer naar `/admin/vakanties` → controleer tabbladen wisselen
- [ ] Tab "Vakanties invoeren": selecteer een doenker, voeg een periode toe, verwijder een periode
- [ ] Tab "Kalender": controleer navigatie via pijltjes en scroll, klik op een dag → popup toont namen
- [ ] Voer een ongeldige periode in (einddatum vóór begindatum) → foutmelding verschijnt
- [ ] Run lint: `npm run lint`

---

### Task 6: Eindcommit

- [ ] **Lint fix indien nodig, daarna eindcommit**

```bash
git add -A
git commit -m "feat: voeg vakantieplanning toe voor doenkers"
```
