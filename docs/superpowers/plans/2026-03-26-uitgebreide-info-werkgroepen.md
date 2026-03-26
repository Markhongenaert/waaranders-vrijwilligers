# Uitgebreide Info Werkgroepen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Voeg een rijke HTML-teksteditor toe aan werkgroepen zodat doenkers uitgebreide info kunnen beheren en vrijwilligers die kunnen lezen via een detail-pagina.

**Architecture:** Tiptap client component (`RijkeTekstEditor`) hergebruikt in twee bestaande admin "use client" pagina's. Een nieuwe Server Component route onder `(app)/activiteiten/werkgroepen/[id]` rendert de opgeslagen HTML veilig via isomorphic-dompurify. De profielpagina popup navigeert naar die route via `router.push` met een `?terug=` query param voor context-afhankelijke terugnavigatie.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tiptap (@tiptap/react, StarterKit, Image, Placeholder, Underline), isomorphic-dompurify, Supabase (browser client voor uploads, server client voor lezen), Tailwind CSS 4

**Spec:** `docs/superpowers/specs/2026-03-26-uitgebreide-info-werkgroepen-design.md`

---

## Bestandsoverzicht

| Actie | Bestand | Verantwoordelijkheid |
|---|---|---|
| Aanmaken | `src/components/RijkeTekstEditor.tsx` | Herbruikbare Tiptap editor met toolbar + afbeelding upload |
| Aanmaken | `src/app/(app)/activiteiten/werkgroepen/[id]/page.tsx` | Server Component: toont gesaniteerde HTML + Terug-knop |
| Aanpassen | `src/app/admin/werkgroepen/beheer/page.tsx` | Voeg uitgebreide_info veld toe aan nieuw-formulier |
| Aanpassen | `src/app/admin/werkgroepen/beheer/[id]/page.tsx` | Laad/sla uitgebreide_info op, toon voorbeeld-link na save |
| Aanpassen | `src/app/(app)/profiel/page.tsx` | Popup: toon "Meer lezen..." link, navigeer naar detail-route |
| Aanpassen | `src/app/globals.css` | Voeg `.wa-prose` utility class toe |

---

## Task 1: Database migratie + npm packages installeren

**Bestanden:** geen codewijzigingen, alleen setup

- [ ] **Stap 1: Voer de database migratie uit**

Ga naar Supabase Dashboard → SQL Editor en voer uit:
```sql
ALTER TABLE werkgroepen ADD COLUMN uitgebreide_info text;
```
Verwacht: commando succesvol, geen foutmelding.

- [ ] **Stap 2: Installeer Tiptap packages**

```bash
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-image @tiptap/extension-placeholder @tiptap/extension-underline
```
Verwacht: packages toegevoegd aan `package.json` en `package-lock.json`.

- [ ] **Stap 3: Installeer isomorphic-dompurify**

```bash
npm install isomorphic-dompurify
npm install --save-dev @types/dompurify
```
Verwacht: packages toegevoegd.

- [ ] **Stap 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: installeer tiptap en isomorphic-dompurify voor uitgebreide info werkgroepen"
```

---

## Task 2: CSS — `.wa-prose` utility class

**Bestanden:**
- Aanpassen: `src/app/globals.css`

- [ ] **Stap 1: Voeg `.wa-prose` toe in de `@layer components` sectie van `globals.css`**

Voeg de volgende regels toe aan het einde van het `@layer components { ... }` blok (vóór de sluitende `}`):

```css
  /* Prose stijl voor rijke HTML-inhoud (uitgebreide_info werkgroepen) */
  .wa-prose h2 { font-size: 1.25rem; font-weight: 700; margin: 1rem 0 0.5rem; }
  .wa-prose h3 { font-size: 1.1rem; font-weight: 600; margin: 0.75rem 0 0.25rem; }
  .wa-prose ul { list-style: disc; padding-left: 1.5rem; margin: 0.5rem 0; }
  .wa-prose ol { list-style: decimal; padding-left: 1.5rem; margin: 0.5rem 0; }
  .wa-prose strong { font-weight: 700; }
  .wa-prose em { font-style: italic; }
  .wa-prose u { text-decoration: underline; }
  .wa-prose img { max-width: 100%; border-radius: 0.5rem; margin: 0.75rem 0; }
  .wa-prose p { margin: 0.5rem 0; }
```

- [ ] **Stap 2: Verifieer dat de app nog steeds opstart**

```bash
npm run dev
```
Verwacht: geen compile errors, app draait op localhost:3000.

- [ ] **Stap 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: voeg wa-prose utility class toe voor uitgebreide info rendering"
```

---

## Task 3: `RijkeTekstEditor` component

**Bestanden:**
- Aanmaken: `src/components/RijkeTekstEditor.tsx`

- [ ] **Stap 1: Maak het bestand aan**

Maak `src/components/RijkeTekstEditor.tsx` aan met de volgende inhoud:

```tsx
"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface Props {
  value: string;
  onChange: (html: string) => void;
}

export default function RijkeTekstEditor({ value, onChange }: Props) {
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Image,
      Placeholder.configure({ placeholder: "Schrijf hier de uitgebreide informatie…" }),
    ],
    content: value,
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });

  if (!editor) return null;

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setUploading(true);

    const sanitizedName = file.name.replace(/[^a-z0-9.\-_]/gi, "-").toLowerCase();
    const path = `${Date.now()}-${sanitizedName}`;

    try {
      const { error } = await supabase.storage
        .from("werkgroep-afbeeldingen")
        .upload(path, file);
      if (error) throw error;

      const { data } = supabase.storage
        .from("werkgroep-afbeeldingen")
        .getPublicUrl(path);

      editor.chain().focus().setImage({ src: data.publicUrl }).run();
    } catch {
      setUploadError("Upload mislukt. Probeer opnieuw.");
    } finally {
      setUploading(false);
      // reset input zodat hetzelfde bestand opnieuw gekozen kan worden
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const btnClass = (active: boolean) =>
    `px-2 py-1 rounded text-sm border ${
      active
        ? "bg-sky-800 text-white border-sky-800"
        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
    }`;

  return (
    <div className="border rounded-xl bg-white overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 p-2 border-b bg-gray-50">
        <button
          type="button"
          aria-label="Titel (H2)"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={btnClass(editor.isActive("heading", { level: 2 }))}
        >
          H2
        </button>
        <button
          type="button"
          aria-label="Subtitel (H3)"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={btnClass(editor.isActive("heading", { level: 3 }))}
        >
          H3
        </button>
        <button
          type="button"
          aria-label="Vetgedrukt"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={btnClass(editor.isActive("bold"))}
        >
          <strong>V</strong>
        </button>
        <button
          type="button"
          aria-label="Schuingedrukt"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={btnClass(editor.isActive("italic"))}
        >
          <em>S</em>
        </button>
        <button
          type="button"
          aria-label="Onderlijnd"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={btnClass(editor.isActive("underline"))}
        >
          <span className="underline">O</span>
        </button>
        <button
          type="button"
          aria-label="Ongeordende lijst"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={btnClass(editor.isActive("bulletList"))}
        >
          • lijst
        </button>
        <button
          type="button"
          aria-label="Geordende lijst"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={btnClass(editor.isActive("orderedList"))}
        >
          1. lijst
        </button>
        <button
          type="button"
          aria-label="Afbeelding uploaden"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className={btnClass(false)}
        >
          {uploading ? "Bezig…" : "Afbeelding"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageUpload}
        />
      </div>

      {/* Editor */}
      <EditorContent
        editor={editor}
        className="wa-prose min-h-[200px] p-3 focus-within:outline-none"
      />

      {uploadError && (
        <div className="wa-alert-error mx-3 mb-3">{uploadError}</div>
      )}
    </div>
  );
}
```

- [ ] **Stap 2: Verifieer dat de app compileert**

```bash
npm run build
```
Verwacht: geen TypeScript fouten gerelateerd aan `RijkeTekstEditor`. (Build kan falen als andere pagina's de component al proberen te importeren — dat is OK als de fout elders zit.)

Alternatief: open `npm run dev` en importeer de component tijdelijk op een admin pagina om te zien of deze zonder errors rendert.

- [ ] **Stap 3: Commit**

```bash
git add src/components/RijkeTekstEditor.tsx
git commit -m "feat: voeg RijkeTekstEditor component toe met Tiptap en Supabase image upload"
```

---

## Task 4: Detail route — Uitgebreide info weergave

**Bestanden:**
- Aanmaken: `src/app/(app)/activiteiten/werkgroepen/[id]/page.tsx`

- [ ] **Stap 1: Maak de directory aan**

```bash
mkdir -p "src/app/(app)/activiteiten/werkgroepen/[id]"
```

- [ ] **Stap 2: Maak de Server Component pagina aan**

Maak `src/app/(app)/activiteiten/werkgroepen/[id]/page.tsx` aan:

```tsx
import { supabaseServer } from "@/lib/supabase/server";
import DOMPurify from "isomorphic-dompurify";
import { notFound } from "next/navigation";

const ALLOWED_TERUG_PREFIXES = ["/profiel", "/admin/werkgroepen/beheer"];

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ terug?: string }>;
}

export default async function WerkgroepDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { terug } = await searchParams;

  const terugParam = terug ?? "";
  const terugUrl = ALLOWED_TERUG_PREFIXES.some((p) => terugParam.startsWith(p))
    ? terugParam
    : "/profiel";

  const supabase = await supabaseServer();
  const { data: werkgroep, error } = await supabase
    .from("werkgroepen")
    .select("id, titel, uitgebreide_info")
    .eq("id", id)
    .maybeSingle();

  if (error || !werkgroep) notFound();

  const safeHtml = DOMPurify.sanitize(werkgroep.uitgebreide_info ?? "");

  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-6 md:p-10 space-y-5">
      <div className="flex items-center gap-3">
        <a
          href={terugUrl}
          className="border rounded-xl px-4 py-2 text-sm bg-white hover:shadow-sm transition"
        >
          ← Terug
        </a>
        <h1 className="text-xl font-semibold">{werkgroep.titel}</h1>
      </div>

      <div className="wa-card p-5">
        {safeHtml ? (
          <div
            className="wa-prose"
            dangerouslySetInnerHTML={{ __html: safeHtml }}
          />
        ) : (
          <p className="text-gray-600">Geen uitgebreide informatie beschikbaar.</p>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Stap 3: Verifieer**

Start `npm run dev`. Navigeer naar `/activiteiten/werkgroepen/[een-bestaand-id]?terug=/profiel`.
Verwacht: pagina laadt, toont werkgroep titel en "Geen uitgebreide informatie beschikbaar." (want het veld is nog leeg).

Controleer ook: `/activiteiten/werkgroepen/onbekend-id` → Next.js 404 pagina.

- [ ] **Stap 4: Commit**

```bash
git add "src/app/(app)/activiteiten/werkgroepen/[id]/page.tsx"
git commit -m "feat: voeg detail route toe voor uitgebreide info werkgroepen"
```

---

## Task 5: Admin beheer — Nieuw werkgroep formulier

**Bestanden:**
- Aanpassen: `src/app/admin/werkgroepen/beheer/page.tsx`

- [ ] **Stap 1: Voeg `uitgebreideInfo` state toe**

Bovenaan de bestaande state declaraties (na `const [meerInfoUrl, setMeerInfoUrl] = useState("")`), voeg toe:

```tsx
const [uitgebreideInfo, setUitgebreideInfo] = useState("");
```

- [ ] **Stap 2: Importeer `RijkeTekstEditor`**

Voeg toe aan de imports bovenaan het bestand:

```tsx
import RijkeTekstEditor from "@/components/RijkeTekstEditor";
```

- [ ] **Stap 3: Reset `uitgebreideInfo` in `openNew()`**

In de `openNew()` functie, voeg toe na de bestaande resets:

```tsx
setUitgebreideInfo("");
```

- [ ] **Stap 4: Voeg het veld toe aan het formulier**

In het formulier, na het `opdracht` textarea blok en vóór het `meer_info_url` blok, voeg toe:

```tsx
<div>
  <label className="block font-medium mb-1">Uitgebreide informatie</label>
  <RijkeTekstEditor value={uitgebreideInfo} onChange={setUitgebreideInfo} />
</div>
```

- [ ] **Stap 5: Voeg het veld toe aan `saveNew()`**

In de `.insert(...)` call, voeg toe naast de bestaande velden:

```tsx
uitgebreide_info: uitgebreideInfo || null,
```

De volledige insert wordt:
```tsx
const { error } = await supabase
  .from("werkgroepen")
  .insert({
    titel: titel.trim(),
    opdracht: opdracht.trim() || null,
    trekker: trekker.trim() || null,
    meer_info_url: meerInfoUrl.trim() || null,
    uitgebreide_info: uitgebreideInfo || null,
  });
```

- [ ] **Stap 6: Verifieer**

Open `npm run dev`. Ga naar `/admin/werkgroepen/beheer`, klik "+ Nieuw".
Verwacht: formulier toont editor onder "Toelichting". Maak een werkgroep aan met wat tekst in de editor. Controleer in Supabase dat `uitgebreide_info` ingevuld is.

- [ ] **Stap 7: Commit**

```bash
git add src/app/admin/werkgroepen/beheer/page.tsx
git commit -m "feat: voeg uitgebreide_info editor toe aan nieuw werkgroep formulier"
```

---

## Task 6: Admin beheer — Werkgroep bewerken

**Bestanden:**
- Aanpassen: `src/app/admin/werkgroepen/beheer/[id]/page.tsx`

- [ ] **Stap 1: Voeg imports toe**

Bovenaan het bestand, voeg toe:

```tsx
import RijkeTekstEditor from "@/components/RijkeTekstEditor";
```

- [ ] **Stap 2: Voeg state toe**

Na de bestaande state declaraties (`meerInfoUrl`, `setMeerInfoUrl`), voeg toe:

```tsx
const [uitgebreideInfo, setUitgebreideInfo] = useState("");
const [savedSuccessfully, setSavedSuccessfully] = useState(false);
```

- [ ] **Stap 3: Laad `uitgebreide_info` uit de DB**

In de select query, voeg `uitgebreide_info` toe:

```tsx
const { data, error } = await supabase
  .from("werkgroepen")
  .select("id, titel, opdracht, trekker, meer_info_url, uitgebreide_info")
  .eq("id", id)
  .maybeSingle();
```

Na het setten van de andere velden, voeg toe:

```tsx
setUitgebreideInfo((data as any).uitgebreide_info ?? "");
```

- [ ] **Stap 4: Reset `savedSuccessfully` bij wijzigingen**

Voeg een `useEffect` toe die `savedSuccessfully` reset wanneer `uitgebreideInfo` verandert na een save:

```tsx
useEffect(() => {
  setSavedSuccessfully(false);
}, [uitgebreideInfo]);
```

- [ ] **Stap 5: Update de `save()` functie — voeg ook `msg` state toe (stap 5 en 8 zijn één atomische wijziging)**

Voeg eerst de `msg` state toe bij de andere state declaraties (bovenaan de component):
```tsx
const [msg, setMsg] = useState<string | null>(null);
```

Vervang dan de volledige `save()` functie. De belangrijkste wijzigingen ten opzichte van de originele versie:
- `uitgebreide_info` toegevoegd aan de update
- `window.location.href` redirect verwijderd — gebruiker blijft op pagina voor de voorbeeld-link
- `setSavedSuccessfully(true)` en `setMsg("Opgeslagen.")` toegevoegd na succesvolle save
- `setMsg(null)` reset aan het begin van save

```tsx
async function save() {
  if (!titel.trim()) { setErr("Titel is verplicht."); return; }
  setBusy(true);
  setErr(null);
  setMsg(null);
  try {
    const { error } = await supabase
      .from("werkgroepen")
      .update({
        titel: titel.trim(),
        opdracht: opdracht.trim() || null,
        trekker: trekker.trim() || null,
        meer_info_url: meerInfoUrl.trim() || null,
        uitgebreide_info: uitgebreideInfo || null,
      })
      .eq("id", id);
    if (error) throw error;
    setMsg("Opgeslagen.");
    setSavedSuccessfully(true);
    setBusy(false);
  } catch (e: any) {
    setErr(e?.message ?? "Fout bij opslaan.");
    setBusy(false);
  }
}
```

Toon `msg` in de JSX (direct na de `{err && ...}` regel):
```tsx
{msg && <div className="wa-alert-success">{msg}</div>}
```

> **Let op:** De bestaande pagina had `window.location.href` als redirect na save. Dit vervangen we zodat de `savedSuccessfully` state zichtbaar blijft. De "Terug" en "Annuleren" links blijven gewoon werken voor navigatie.

- [ ] **Stap 6: Voeg editor toe aan het formulier**

Na het `opdracht` textarea blok, vóór het `meer_info_url` blok:

```tsx
<div>
  <label className="block font-medium mb-1">Uitgebreide informatie</label>
  <RijkeTekstEditor value={uitgebreideInfo} onChange={setUitgebreideInfo} />
</div>
```

- [ ] **Stap 7: Voeg "Voorbeeld bekijken" link toe**

Na de "Opslaan" / "Annuleren" knoppen, voeg toe:

```tsx
{savedSuccessfully && uitgebreideInfo && (
  <a
    href={`/activiteiten/werkgroepen/${id}?terug=/admin/werkgroepen/beheer/${id}`}
    className="inline-block text-sm text-sky-700 hover:underline mt-2"
    target="_blank"
    rel="noopener noreferrer"
  >
    Voorbeeld bekijken →
  </a>
)}
```

- [ ] **Stap 8: Verifieer**

Open `/admin/werkgroepen/beheer/[id]`. Controleer:
- Editor laadt bestaande inhoud (of leeg als nieuw veld)
- Na opslaan: succesmelding verschijnt, "Voorbeeld bekijken →" link verschijnt
- Pas de editor aan: link verdwijnt (savedSuccessfully reset)
- Sla opnieuw op: link verschijnt terug
- Klik "Voorbeeld bekijken →": opent detail pagina met de opgeslagen inhoud en "Terug naar beheer" werkt correct

- [ ] **Stap 9: Commit**

```bash
git add "src/app/admin/werkgroepen/beheer/[id]/page.tsx"
git commit -m "feat: voeg uitgebreide_info editor toe aan werkgroep bewerk-pagina met voorbeeld-link"
```

---

## Task 7: Profielpagina — Popup aanpassen

**Bestanden:**
- Aanpassen: `src/app/(app)/profiel/page.tsx`

- [ ] **Stap 1: Voeg `useRouter` import toe**

Bovenaan het bestand, voeg toe (van `next/navigation`, niet `next/router`):

```tsx
import { useRouter } from "next/navigation";
```

- [ ] **Stap 2: Initialiseer router**

In de component body, direct na de state declaraties:

```tsx
const router = useRouter();
```

- [ ] **Stap 3: Update het `Werkgroep` type**

Het bestaande type:
```tsx
type Werkgroep = {
  id: string;
  titel: string;
  opdracht: string | null;
  meer_info_url: string | null;
};
```

Voeg `uitgebreide_info` toe:
```tsx
type Werkgroep = {
  id: string;
  titel: string;
  opdracht: string | null;
  meer_info_url: string | null;
  uitgebreide_info: string | null;
};
```

- [ ] **Stap 4: Update het `opdrachtPopup` type**

Het bestaande type:
```tsx
const [opdrachtPopup, setOpdrachtPopup] = useState<{ tekst: string; url: string | null } | null>(null);
```

Vervang door:
```tsx
const [opdrachtPopup, setOpdrachtPopup] = useState<{
  tekst: string;
  werkgroepId: string;
  uitgebreideInfo: string | null;
} | null>(null);
```

- [ ] **Stap 5: Update de werkgroepen query**

Zoek de select van `werkgroepen`:
```tsx
.select("id, titel, opdracht, meer_info_url")
```

Voeg `uitgebreide_info` toe:
```tsx
.select("id, titel, opdracht, meer_info_url, uitgebreide_info")
```

- [ ] **Stap 6: Update de popup trigger knop**

Zoek de bestaande conditie:
```tsx
{w.opdracht && (
  <button
    type="button"
    onClick={() => setOpdrachtPopup({ tekst: w.opdracht!, url: w.meer_info_url ?? null })}
    ...
  >
    Toelichting
  </button>
)}
```

Vervang door:
```tsx
{(w.opdracht || w.uitgebreide_info) && (
  <button
    type="button"
    onClick={() => setOpdrachtPopup({
      tekst: w.opdracht ?? "",
      werkgroepId: w.id,
      uitgebreideInfo: w.uitgebreide_info ?? null,
    })}
    className="border border-gray-300 rounded-xl px-3 py-1.5 text-sm bg-white hover:shadow-sm transition"
  >
    Toelichting
  </button>
)}
```

- [ ] **Stap 7: Update de popup JSX**

Zoek de bestaande popup inhoud:
```tsx
<p className="text-gray-800 leading-relaxed">{opdrachtPopup.tekst}</p>
{opdrachtPopup.url && (
  <a
    href={opdrachtPopup.url}
    target="_blank"
    rel="noopener noreferrer"
    className="block font-bold text-green-700 hover:underline"
  >
    Meer lezen...
  </a>
)}
```

Vervang door:
```tsx
{opdrachtPopup.tekst && (
  <p className="text-gray-800 leading-relaxed">{opdrachtPopup.tekst}</p>
)}
{opdrachtPopup.uitgebreideInfo && (
  <button
    type="button"
    onClick={() => {
      setOpdrachtPopup(null);
      router.push(
        `/activiteiten/werkgroepen/${opdrachtPopup.werkgroepId}?terug=/profiel`
      );
    }}
    className="block font-bold text-green-700 hover:underline text-left"
  >
    Meer lezen...
  </button>
)}
```

- [ ] **Stap 8: Verifieer**

Open `/profiel`:
- Werkgroep met alleen `opdracht` (geen `uitgebreide_info`): "Toelichting" knop → popup toont tekst, geen "Meer lezen..."
- Werkgroep met `uitgebreide_info` gevuld: "Toelichting" knop → popup toont tekst + groene "Meer lezen..." link
- Klik "Meer lezen...": popup sluit, navigeert naar `/activiteiten/werkgroepen/[id]?terug=/profiel`
- Op de detailpagina: inhoud getoond, "← Terug" navigeert terug naar `/profiel`
- Werkgroep met alleen `uitgebreide_info` (geen `opdracht`): "Toelichting" knop verschijnt, popup toont alleen "Meer lezen..."

- [ ] **Stap 9: Commit**

```bash
git add src/app/(app)/profiel/page.tsx
git commit -m "feat: pas profielpagina popup aan voor uitgebreide_info navigatie"
```

---

## Task 8: RLS Storage policies (handmatig uit te voeren)

**Bestanden:** geen — SQL in Supabase dashboard

- [ ] **Stap 1: Voer de RLS policies uit in Supabase SQL Editor**

```sql
-- Iedereen kan lezen (publiek)
CREATE POLICY "Publieke leestoegang werkgroep-afbeeldingen"
ON storage.objects FOR SELECT
USING (bucket_id = 'werkgroep-afbeeldingen');

-- Alleen doenkers en admins mogen uploaden
CREATE POLICY "Doenkers en admins mogen uploaden"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'werkgroep-afbeeldingen'
  AND EXISTS (
    SELECT 1
    FROM vrijwilliger_roles vr
    JOIN roles r ON r.id = vr.role_id
    WHERE vr.vrijwilliger_id = auth.uid()
      AND r.code IN ('doenker', 'admin')
  )
);

-- Alleen doenkers en admins mogen verwijderen
CREATE POLICY "Doenkers en admins mogen verwijderen"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'werkgroep-afbeeldingen'
  AND EXISTS (
    SELECT 1
    FROM vrijwilliger_roles vr
    JOIN roles r ON r.id = vr.role_id
    WHERE vr.vrijwilliger_id = auth.uid()
      AND r.code IN ('doenker', 'admin')
  )
);
```

Verwacht: 3 policies aangemaakt zonder fouten.

- [ ] **Stap 2: Verifieer in Supabase dashboard**

Ga naar Storage → `werkgroep-afbeeldingen` → Policies. Controleer dat de 3 policies zichtbaar zijn.

- [ ] **Stap 3: Test image upload**

Log in als doenker/admin in de app. Ga naar een werkgroep bewerken, upload een afbeelding in de editor.
Verwacht: afbeelding verschijnt in de editor en is zichtbaar via de publieke URL.

- [ ] **Stap 4: Eindcommit**

```bash
git add .
git commit -m "feat: voltooi uitgebreide info werkgroepen implementatie"
```

---

## Eindverificatie

Na alle tasks:

1. **Doenker flow:** Login als doenker → `/admin/werkgroepen/beheer/[id]` → voeg uitgebreide info toe met afbeelding → sla op → klik "Voorbeeld bekijken →" → verifieer rendering
2. **Vrijwilliger flow:** Login als vrijwilliger → `/profiel` → klik "Toelichting" op werkgroep met uitgebreide_info → klik "Meer lezen..." → verifieer detail pagina → klik "← Terug" → terug op profiel
3. **Admin via beheer:** klik "Voorbeeld bekijken →" → Terug-knop gaat naar beheer pagina van die werkgroep
4. **Veiligheid:** probeer URL `/activiteiten/werkgroepen/[id]?terug=//evil.com` — verwacht: Terug-knop gaat naar `/profiel` (fallback)
5. **Lege staat:** werkgroep zonder uitgebreide_info → detail pagina toont "Geen uitgebreide informatie beschikbaar."
