# Design: Uitgebreide info sectie voor werkgroepen

**Datum:** 2026-03-26
**Status:** Goedgekeurd

## Samenvatting

Werkgroepen krijgen een `uitgebreide_info` (text) veld in de database dat rijke HTML-inhoud bevat. Doenkers/admins beheren dit via een Tiptap-teksteditor met afbeelding-upload naar Supabase Storage. Vrijwilligers kunnen de inhoud lezen via een detail-route die vanuit de profielpagina (popup) én vanuit de admin beheerpagina bereikbaar is. De Terug-knop is context-afhankelijk via een `terug` query parameter.

---

## 0. Database migratie

Voer uit in de Supabase SQL Editor:

```sql
ALTER TABLE werkgroepen ADD COLUMN uitgebreide_info text;
```

---

## 1. Installatie

```bash
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-image @tiptap/extension-placeholder @tiptap/extension-underline
```

---

## 2. Component: RijkeTekstEditor

**Bestand:** `src/components/RijkeTekstEditor.tsx`
**Type:** Client component (`"use client"`)

**Props:**
```ts
interface Props {
  value: string;         // Huidige HTML-inhoud
  onChange: (html: string) => void;
}
```

**Toolbar knoppen (in volgorde):**
| Knop | Tiptap commando | aria-label |
|---|---|---|
| Titel (H2) | `toggleHeading({ level: 2 })` | `"Titel (H2)"` |
| Subtitel (H3) | `toggleHeading({ level: 3 })` | `"Subtitel (H3)"` |
| Vetjes | `toggleBold()` | `"Vetgedrukt"` |
| Schuingedrukt | `toggleItalic()` | `"Schuingedrukt"` |
| Onderlijnd | `toggleUnderline()` | `"Onderlijnd"` |
| Ongeordende lijst | `toggleBulletList()` | `"Ongeordende lijst"` |
| Geordende lijst | `toggleOrderedList()` | `"Geordende lijst"` |
| Afbeelding uploaden | hidden file input → upload | `"Afbeelding uploaden"` |

Alle toolbar-knoppen moeten een `aria-label` attribuut hebben (zie kolom hierboven).

**Afbeelding upload flow:**
1. Verborgen `<input type="file" accept="image/*">` getriggerd via knop
2. Saniteer de bestandsnaam: verwijder spaties en niet-ASCII tekens, bv. `file.name.replace(/[^a-z0-9.\-_]/gi, '-').toLowerCase()`
3. Upload naar Supabase Storage bucket `werkgroep-afbeeldingen` via browser client met pad `${Date.now()}-${sanitizedName}`
4. **Tijdens upload:** disable de upload-knop en toon een laad-indicator in de knop ("Bezig…")
5. **Bij fout:** toon een `wa-alert-error` melding onder de toolbar ("Upload mislukt. Probeer opnieuw.")
6. **Bij succes:** haal publieke URL op via `supabase.storage.from('werkgroep-afbeeldingen').getPublicUrl(path)` en voeg in via `editor.chain().focus().setImage({ src: publicUrl }).run()`

**Extensions:**
- `StarterKit` (bevat Bold, Italic, Headings, Lists, etc.)
- `Underline` (van `@tiptap/extension-underline`)
- `Image` (van `@tiptap/extension-image`)
- `Placeholder` met tekst "Schrijf hier de uitgebreide informatie…"

---

## 3. Admin beheer — Nieuw werkgroep formulier

**Bestand:** `src/app/admin/werkgroepen/beheer/page.tsx`

**Wijzigingen:**
- Voeg `uitgebreideInfo` state toe (`useState<string>("")`)
- Voeg in het formulier een sectie toe onder het `opdracht` textarea:
  ```
  label: "Uitgebreide informatie"
  component: <RijkeTekstEditor value={uitgebreideInfo} onChange={setUitgebreideInfo} />
  ```
- `saveNew()`: voeg `uitgebreide_info: uitgebreideInfo || null` toe aan de insert
- Het bestaande `meer_info_url` veld blijft staan als optioneel veld (niet verwijderd)

---

## 4. Admin beheer — Werkgroep bewerken

**Bestand:** `src/app/admin/werkgroepen/beheer/[id]/page.tsx`

**Wijzigingen:**
- Voeg `uitgebreideInfo` state toe (`useState<string>("")`)
- Laad ook `uitgebreide_info` in de select query
- Stel `setUitgebreideInfo(data.uitgebreide_info ?? "")` in na laden
- Voeg `<RijkeTekstEditor>` sectie toe onder het `opdracht` veld (label: "Uitgebreide informatie")
- `save()`: voeg `uitgebreide_info: uitgebreideInfo || null` toe aan de update
- **Na een succesvolle `save()`** (niet eerder): als `uitgebreideInfo` gevuld is, toon een "Voorbeeld bekijken →" link:
  ```
  href={`/activiteiten/werkgroepen/${id}?terug=/admin/werkgroepen/beheer/${id}`}
  ```
  Implementeer dit via een `savedSuccessfully` boolean state (`useState(false)`):
  - Zet `setSavedSuccessfully(true)` aan het einde van een succesvolle `save()`
  - Reset naar `false` via een `useEffect` die luistert naar `uitgebreideInfo` wijzigingen (zodat de link verdwijnt zodra er nieuwe unsaved changes zijn)
  - Toon de link alleen als `savedSuccessfully && uitgebreideInfo`
- Het bestaande `meer_info_url` veld blijft staan

---

## 5. Detail route: Uitgebreide info weergave

**Bestand:** `src/app/(app)/activiteiten/werkgroepen/[id]/page.tsx`
**Type:** Server Component

**`terug` parameter validatie:**
Gebruik een whitelist van toegestane prefixen in plaats van een simpele `/` check:
```ts
const ALLOWED_TERUG_PREFIXES = ['/profiel', '/admin/werkgroepen/beheer'];
const terugParam = searchParams?.terug ?? '';
const terugUrl = ALLOWED_TERUG_PREFIXES.some(p => terugParam.startsWith(p))
  ? terugParam
  : '/profiel';
```

Dit voorkomt protocol-relative URL exploits zoals `//evil.com`.

**Gedrag:**
- Laadt de werkgroep via de server Supabase client (`supabaseServer()`)
- Toont `werkgroep.titel` als paginatitel
- Rendert `uitgebreide_info` via `dangerouslySetInnerHTML` in een `wa-prose` wrapper
- **Sanitatie:** Gebruik `isomorphic-dompurify` om de HTML te saniteren vóór rendering:
  ```ts
  import DOMPurify from 'isomorphic-dompurify';
  const safeHtml = DOMPurify.sanitize(werkgroep.uitgebreide_info ?? '');
  ```
  Voeg `isomorphic-dompurify` toe aan de dependencies: `npm install isomorphic-dompurify`
- Toont een "← Terug" knop/link naar de gevalideerde `terugUrl`
- Geen `uitgebreide_info`: toont een melding "Geen uitgebreide informatie beschikbaar."

**Bescherming:** Valt automatisch onder de `(app)/` layout met `AuthBootstrap`.

---

## 6. Profielpagina — Popup aanpassen

**Bestand:** `src/app/(app)/profiel/page.tsx`

**Wijzigingen:**
- `Werkgroep` type: voeg `uitgebreide_info: string | null` toe
- Query: voeg `uitgebreide_info` toe aan de select van `werkgroepen`
- `opdrachtPopup` type: voeg `werkgroepId: string` en `uitgebreideInfo: string | null` toe
- **Popup trigger knop conditie aanpassen:** De knop "Toelichting" verschijnt nu wanneer `w.opdracht || w.uitgebreide_info` (was: alleen `w.opdracht`). Zo bereiken vrijwilligers ook de "Meer lezen" link voor werkgroepen zonder `opdracht` tekst maar mét `uitgebreide_info`.
- Popup trigger geeft ook `werkgroepId: w.id` en `uitgebreideInfo: w.uitgebreide_info` mee
- In de popup:
  - Verwijder de bestaande `meer_info_url` "Meer lezen..." link volledig
  - Als `uitgebreideInfo` gevuld: toon groene vette link "Meer lezen..." die via `router.push` navigeert naar `/activiteiten/werkgroepen/[werkgroepId]?terug=/profiel` en de popup sluit (`setOpdrachtPopup(null)`)
- `useRouter` importeren van `next/navigation` (niet `next/router`):
  ```ts
  import { useRouter } from 'next/navigation';
  const router = useRouter();
  ```

---

## 7. CSS — Prose stijl

**Bestand:** `src/app/globals.css`

Voeg een `.wa-prose` utility class toe voor de HTML-render in de detail route:
```css
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

---

## 8. RLS — Supabase Storage policies

De `werkgroep-afbeeldingen` bucket is al aangemaakt als publieke bucket.

**Benodigde SQL policies (uitvoeren in Supabase SQL Editor):**

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

> **Opmerking:** Opruimen van orphan-afbeeldingen (bij verwijderen van een werkgroep) valt buiten scope van deze implementatie.

---

## Beslissingen samengevat

| Beslissing | Keuze | Reden |
|---|---|---|
| Editor bibliotheek | Tiptap | Gevraagd in spec |
| Save strategie | Browser client (geen server action) | Bestaande pagina's zijn al client components |
| "Meer lezen" navigatie | Nieuwe route `/activiteiten/werkgroepen/[id]` | Gevraagd (optie b) |
| Terug-knop | `?terug=` query param met whitelist validatie | Context-afhankelijk: profiel vs. admin beheer |
| `meer_info_url` in popup | Verwijderd (vervangen door `uitgebreide_info`) | Gevraagd (optie a) |
| `meer_info_url` in formulieren | Behouden | Niet expliciet verwijderd in scope |
| Afbeelding bucket | `werkgroep-afbeeldingen` (al aangemaakt) | Gevraagd in spec |
| HTML sanitatie | `isomorphic-dompurify` server-side | XSS-preventie |
| Popup trigger | `w.opdracht \|\| w.uitgebreide_info` | Correcte weergave ook zonder `opdracht` tekst |
| "Voorbeeld bekijken" | Alleen na succesvolle save | Voorkomt stale preview verwarring |
