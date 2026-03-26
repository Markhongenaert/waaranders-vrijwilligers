# Design: Uitgebreide info sectie voor werkgroepen

**Datum:** 2026-03-26
**Status:** Goedgekeurd

## Samenvatting

Werkgroepen krijgen een `uitgebreide_info` (text) veld in de database dat rijke HTML-inhoud bevat. Doenkers/admins beheren dit via een Tiptap-teksteditor met afbeelding-upload naar Supabase Storage. Vrijwilligers kunnen de inhoud lezen via een detail-route die vanuit de profielpagina (popup) én vanuit de admin beheerpagina bereikbaar is. De Terug-knop is context-afhankelijk via een `terug` query parameter.

---

## 1. Installatie

```bash
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-image @tiptap/extension-placeholder
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
| Knop | Tiptap commando |
|---|---|
| Titel (H2) | `toggleHeading({ level: 2 })` |
| Subtitel (H3) | `toggleHeading({ level: 3 })` |
| Vetjes | `toggleBold()` |
| Schuingedrukt | `toggleItalic()` |
| Onderlijnd | `toggleUnderline()` |
| Ongeordende lijst | `toggleBulletList()` |
| Geordende lijst | `toggleOrderedList()` |
| Afbeelding uploaden | hidden file input → Supabase Storage upload → `setImage({ src: url })` |

**Afbeelding upload flow:**
1. Verborgen `<input type="file" accept="image/*">` getriggerd via knop
2. Upload naar Supabase Storage bucket `werkgroep-afbeeldingen` via browser client
3. Bestandsnaam: `${Date.now()}-${file.name}` (om botsingen te vermijden)
4. Haal publieke URL op via `supabase.storage.from('werkgroep-afbeeldingen').getPublicUrl(path)`
5. Voeg in via `editor.chain().focus().setImage({ src: publicUrl }).run()`

**Extensions:**
- `StarterKit` (bevat Bold, Italic, Headings, Lists, etc.)
- `Underline` (apart)
- `Image`
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

---

## 4. Admin beheer — Werkgroep bewerken

**Bestand:** `src/app/admin/werkgroepen/beheer/[id]/page.tsx`

**Wijzigingen:**
- Voeg `uitgebreideInfo` state toe (`useState<string>("")`)
- Laad ook `uitgebreide_info` in de select query
- Stel `setUitgebreideInfo(data.uitgebreide_info ?? "")` in na laden
- Voeg `<RijkeTekstEditor>` sectie toe onder het `opdracht` veld
- `save()`: voeg `uitgebreide_info: uitgebreideInfo || null` toe aan de update
- Als `uitgebreideInfo` gevuld is: toon een "Voorbeeld bekijken" link onderaan het formulier:
  ```
  href={`/activiteiten/werkgroepen/${id}?terug=/admin/werkgroepen/beheer/${id}`}
  ```

---

## 5. Detail route: Uitgebreide info weergave

**Bestand:** `src/app/(app)/activiteiten/werkgroepen/[id]/page.tsx`
**Type:** Server Component

**Gedrag:**
- Laadt de werkgroep via de server Supabase client (`supabaseServer()`)
- Leest `searchParams.terug`: valideert dat het begint met `/` (anders fallback `/profiel`)
- Toont `werkgroep.titel` als paginatitel
- Rendert `uitgebreide_info` via `dangerouslySetInnerHTML` in een `prose`-stijl wrapper
- Toont een "← Terug" knop/link naar de gevalideerde `terug` URL
- Geen `uitgebreide_info`: toont een melding "Geen uitgebreide informatie beschikbaar."

**Bescherming:** Valt automatisch onder de `(app)/` layout met `AuthBootstrap`.

---

## 6. Profielpagina — Popup aanpassen

**Bestand:** `src/app/(app)/profiel/page.tsx`

**Wijzigingen:**
- `Werkgroep` type: voeg `uitgebreide_info: string | null` toe
- Query: voeg `uitgebreide_info` toe aan de select van `werkgroepen`
- `opdrachtPopup` type: voeg `werkgroepId: string` en `uitgebreideInfo: string | null` toe
- Popup trigger: geef ook `werkgroepId: w.id` en `uitgebreideInfo: w.uitgebreide_info` mee
- In de popup:
  - Verwijder de bestaande `meer_info_url` "Meer lezen..." link volledig
  - Als `uitgebreideInfo` gevuld: toon groene vette link "Meer lezen..." die navigeert (via `router.push`) naar `/activiteiten/werkgroepen/[werkgroepId]?terug=/profiel` en sluit de popup
- `useRouter` importeren voor de navigatie

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

**Benodigde SQL policies:**

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
```

> **Let op:** Voer deze SQL uit in de Supabase SQL Editor. Ze gelden bovenop de bucket's publieke instelling.

---

## Beslissingen samengevat

| Beslissing | Keuze | Reden |
|---|---|---|
| Editor bibliotheek | Tiptap | Gevraagd in spec |
| Save strategie | Browser client (geen server action) | Bestaande pagina's zijn al client components |
| "Meer lezen" navigatie | Nieuwe route `/activiteiten/werkgroepen/[id]` | Gevraagd (optie b) |
| Terug-knop | `?terug=` query param | Context-afhankelijk: profiel vs. admin beheer |
| `meer_info_url` in popup | Verwijderd | Vervangen door `uitgebreide_info` (optie a) |
| Afbeelding bucket | `werkgroep-afbeeldingen` (al aangemaakt) | Gevraagd in spec |
