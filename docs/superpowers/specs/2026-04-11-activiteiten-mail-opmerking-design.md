# Design: Activiteiten — mail naar deelnemers + opmerking bij inschrijving

**Datum:** 2026-04-11  
**Status:** Goedgekeurd

---

## Scope

Twee communicatiefunctionaliteiten voor de activiteitenbeheer-workflow:

1. **Doenker stuurt mail naar alle deelnemers van een activiteit** (admin-kant)
2. **Vrijwilliger voegt opmerking toe bij inschrijving** (vrijwilliger-kant + admin-zichtbaarheid)

---

## Bestaande patronen (gevolgd)

- Mail via Resend + `supabaseAdmin()` (service role), patroon uit `src/app/admin/werkgroepen/[id]/actions.ts`
- E-mailadressen via `auth.admin.listUsers()`, nooit via `vrijwilligers`-tabel
- Admin pagina's: `"use client"` met modals als conditionele JSX
- Vrijwilliger pagina: `"use client"`, DB writes via browser supabase client, server action alleen voor mail

---

## Functionaliteit 1 — Mail naar deelnemers (admin)

### Nieuw bestand: `src/app/admin/activiteiten/actions.ts`

```ts
"use server"
export async function stuurMailNaarDeelnemers(
  activiteitId: string,
  boodschap: string
): Promise<{ verstuurd: number; error?: string }>
```

**Logica:**
1. Haal activiteit op (`titel` via `activiteiten`)
2. Haal deelnemers op via `meedoen` → `vrijwilligers` (voor `voornaam` en `user_id`)
3. Haal e-mailadressen op via `auth.admin.listUsers()`
4. Stuur per persoon een mail via Resend:
   - `from`: `Waaranders <noreply@waaranders.be>`
   - `replyTo`: `info@waaranders.be`
   - Onderwerp: `[titel activiteit]`
   - Tekst: `Beste [voornaam],\n\n[boodschap]\n\nMet vriendelijke groeten,\nhet Waaranders-team`
5. Individuele mailfouten worden gelogd maar blokkeren de verzending niet
6. Return `{ verstuurd: aantal }`

### Wijziging: `src/app/admin/activiteiten/page.tsx`

- Mail modal state: `mailModalId`, `mailBoodschap`, `mailBezig`, `mailResultaat`, `mailFout`
- Knop "Mail versturen naar deelnemers" per activiteitenkaart, **alleen zichtbaar als `namen.length > 0`**
- Modal JSX: tekstvak, Versturen, Annuleren
- Bevestiging: "Mail verstuurd naar X vrijwilligers."

---

## Functionaliteit 2A — Opmerking bij inschrijving (vrijwilliger)

### Nieuw bestand: `src/app/(app)/activiteiten/actions.ts`

```ts
"use server"
export async function stuurOpmerkingMail(
  activiteitId: string,
  vrijwilligerNaam: string,
  opmerking: string,
  isUpdate: boolean
): Promise<void>
```

**Logica:**
1. Haal activiteit op (`titel`, `wanneer`, `klant_id`)
2. Als geen `klant_id`: stoppen (geen mail)
3. Haal klant op (`aanspreekpunt_vrijwilliger_id`)
4. Als geen aanspreekpunt: stoppen
5. Haal `user_id` op van aanspreekpunt via `vrijwilligers`, dan e-mail via `auth.admin.listUsers()`
6. Stuur mail:
   - Onderwerp: `Opmerking bij [titel activiteit]`
   - Aanspreking: `Beste [voornaam aanspreekpunt],`
   - Nieuw: `[naam vrijwilliger] heeft een opmerking toegevoegd bij ... op [datum]: "[opmerking]"`
   - Update: `[naam vrijwilliger] heeft zijn/haar opmerking bij ... op [datum] aangepast: "[nieuwe opmerking]"`
   - Afsluiting: `Met vriendelijke groeten,\nhet Waaranders-team`
7. Fout bij mail: gelogd via `console.error`, nooit gegooid (DB operatie al geslaagd)

### Wijziging: `src/app/(app)/activiteiten/page.tsx`

**Laden:**
- Extra query: `meedoen.select("activiteit_id, opmerking").eq("vrijwilliger_id", myId)` → `Map<string, string | null>` genaamd `opmerkingen`
- Extra query: `vrijwilligers.select("voornaam, achternaam").eq("id", myId)` voor naam in mail

**UI — badge onder "Jij doet mee":**
- Als geen opmerking: `＋ Opmerking toevoegen` (grijs/ghost)
- Als opmerking aanwezig: `✎ Jouw opmerking` (blauw of aktief)

**Modal:**
- Tekstvak met huidige opmerking (leeg als nog geen)
- Knop "Opslaan"
- Knop "Verwijderen" — alleen als opmerking al bestaat
- Knop "Annuleren"

**Bij opslaan:**
1. `supabase.from("meedoen").update({ opmerking }).eq("activiteit_id", ...).eq("vrijwilliger_id", myId)`
2. Local state updaten
3. `stuurOpmerkingMail(...)` aanroepen (geen await vereist voor UI, maar await voor correctheid; fout wordt intern gelogd)

**Bij verwijderen:**
1. `supabase.from("meedoen").update({ opmerking: null }).eq(...)`
2. Local state updaten
3. Geen mail

---

## Functionaliteit 2B — Opmerkingen in beheerscherm (admin)

### Wijziging: `src/app/admin/activiteiten/page.tsx`

**Laden:**
- Extra query: `meedoen.select("activiteit_id, opmerking, vrijwilligers(voornaam, achternaam)").not("opmerking", "is", null).in("activiteit_id", ids)` → `Map<string, {naam: string; opmerking: string}[]>` genaamd `adminOpmerkingen`

**UI — sectie "Opmerkingen" per activiteitenkaart:**
- Alleen getoond als `adminOpmerkingen.get(a.id)?.length > 0`
- Per opmerking: `[Voornaam Achternaam]: [opmerking]`
- Onder de deelnemerslijst, boven de actieknoppen

---

## Bestandswijzigingen (samenvatting)

| Bestand | Actie |
|---|---|
| `src/app/admin/activiteiten/actions.ts` | Nieuw |
| `src/app/admin/activiteiten/page.tsx` | Wijziging (mail modal + opmerkingen) |
| `src/app/(app)/activiteiten/actions.ts` | Nieuw |
| `src/app/(app)/activiteiten/page.tsx` | Wijziging (opmerking badge + modal) |

---

## Foutafhandeling

- Individuele mailfouten blokkeren nooit de loop (try/catch per ontvanger of Promise.allSettled)
- Mail server action werpt nooit een fout omhoog naar de client
- DB-fout bij opslaan opmerking: getoond aan gebruiker
- DB-fout bij mail admin: return `{ error }`, getoond in modal
