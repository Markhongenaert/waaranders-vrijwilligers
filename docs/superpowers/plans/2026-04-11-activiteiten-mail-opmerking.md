# Activiteiten: mail naar deelnemers + opmerking bij inschrijving — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Voeg twee communicatiefunctionaliteiten toe: (1) doenker stuurt mail naar alle deelnemers van een activiteit, (2) vrijwilliger kan een opmerking toevoegen bij zijn inschrijving, zichtbaar voor doenkers.

**Architecture:** Twee nieuwe server action bestanden voor mail (service role + Resend), bestaande client-componenten uitgebreid met modal state en extra queries. Mail-fouten blokkeren nooit DB-operaties. E-mailadressen altijd via `auth.admin.listUsers()`.

**Tech Stack:** Next.js App Router, React 19 (hooks), TypeScript, Supabase (browser + admin client), Resend

> **Note:** Geen test runner geconfigureerd. Verificatie via `npm run dev` en handmatige test in browser.

---

## Bestandsoverzicht

| Bestand | Actie |
|---|---|
| `src/app/admin/activiteiten/actions.ts` | Nieuw — server action `stuurMailNaarDeelnemers` |
| `src/app/admin/activiteiten/page.tsx` | Wijziging — mail modal + opmerkingen sectie |
| `src/app/(app)/activiteiten/actions.ts` | Nieuw — server action `stuurOpmerkingMail` |
| `src/app/(app)/activiteiten/page.tsx` | Wijziging — opmerking badge + modal |

---

## Task 1: Server action — mail naar deelnemers (admin)

**Files:**
- Create: `src/app/admin/activiteiten/actions.ts`

- [ ] **Stap 1: Maak het bestand aan**

Maak `src/app/admin/activiteiten/actions.ts` aan met de volgende inhoud:

```ts
"use server";

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is niet geconfigureerd.");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export async function stuurMailNaarDeelnemers(
  activiteitId: string,
  boodschap: string
): Promise<{ verstuurd: number; error?: string }> {
  try {
    const supabase = supabaseAdmin();

    const { data: act, error: actErr } = await supabase
      .from("activiteiten")
      .select("titel")
      .eq("id", activiteitId)
      .maybeSingle();
    if (actErr) return { verstuurd: 0, error: actErr.message };

    const titel = act?.titel ?? "activiteit";

    const { data: meedoenRows, error: mErr } = await supabase
      .from("meedoen")
      .select("vrijwilliger_id")
      .eq("activiteit_id", activiteitId);
    if (mErr) return { verstuurd: 0, error: mErr.message };

    const vrijwilligerIds = (meedoenRows ?? [])
      .map((r) => r.vrijwilliger_id as string)
      .filter(Boolean);
    if (vrijwilligerIds.length === 0) return { verstuurd: 0 };

    const { data: vv, error: vErr } = await supabase
      .from("vrijwilligers")
      .select("user_id, voornaam")
      .in("id", vrijwilligerIds)
      .eq("actief", true);
    if (vErr) return { verstuurd: 0, error: vErr.message };

    const voornaamByUserId = new Map(
      (vv ?? [])
        .filter((r) => !!r.user_id)
        .map((r) => [r.user_id as string, (r.voornaam as string | null) ?? ""])
    );

    const { data: usersData, error: usersErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (usersErr) return { verstuurd: 0, error: usersErr.message };

    type Ontvanger = { email: string; voornaam: string };
    const ontvangers: Ontvanger[] = usersData.users
      .filter((u) => voornaamByUserId.has(u.id) && !!u.email)
      .map((u) => ({ email: u.email as string, voornaam: voornaamByUserId.get(u.id) ?? "" }));

    if (ontvangers.length === 0) return { verstuurd: 0 };

    const resend = new Resend(process.env.RESEND_API_KEY);

    const resultaten = await Promise.all(
      ontvangers.map(async ({ email, voornaam }) => {
        try {
          await resend.emails.send({
            from: "Waaranders <noreply@waaranders.be>",
            replyTo: "info@waaranders.be",
            to: email,
            subject: titel,
            text: `Beste ${voornaam},\n\n${boodschap}\n\nMet vriendelijke groeten,\nhet Waaranders-team`,
          });
          return true;
        } catch (e) {
          console.error(`Mail naar ${email} mislukt:`, e);
          return false;
        }
      })
    );

    const verstuurd = resultaten.filter(Boolean).length;
    return { verstuurd };
  } catch (e: unknown) {
    return { verstuurd: 0, error: e instanceof Error ? e.message : "Onbekende fout." };
  }
}
```

- [ ] **Stap 2: Verificeer TypeScript (geen build-fouten)**

```bash
cd "C:\Users\Acer\Projecten\waaranders-vrijwilligers" && npx tsc --noEmit 2>&1 | head -20
```

Verwacht: geen fouten in `actions.ts`.

- [ ] **Stap 3: Commit**

```bash
git add src/app/admin/activiteiten/actions.ts
git commit -m "feat: server action stuurMailNaarDeelnemers"
```

---

## Task 2: Admin activiteiten pagina — mail modal + opmerkingen sectie

**Files:**
- Modify: `src/app/admin/activiteiten/page.tsx`

- [ ] **Stap 1: Voeg import en types toe**

Voeg bovenaan het bestand, na de bestaande imports, toe:

```ts
import { stuurMailNaarDeelnemers } from "./actions";
```

Voeg de volgende types toe na de `Activiteit` type definitie:

```ts
type OpmerkingRow = {
  activiteit_id: string;
  opmerking: string;
  vrijwilligers: { voornaam: string | null; achternaam: string | null } | null;
};
```

- [ ] **Stap 2: Voeg state toe in de component**

Voeg in `AdminActiviteitenPage`, na de bestaande state declarations, de volgende state toe:

```ts
// Mail modal state
type MailModal = { activiteitId: string; titel: string };
const [mailModal, setMailModal] = useState<MailModal | null>(null);
const [mailBoodschap, setMailBoodschap] = useState("");
const [mailBezig, setMailBezig] = useState(false);
const [mailResultaat, setMailResultaat] = useState<string | null>(null);
const [mailFout, setMailFout] = useState<string | null>(null);

// Opmerkingen state
const [adminOpmerkingen, setAdminOpmerkingen] = useState<Map<string, { naam: string; opmerking: string }[]>>(new Map());
```

- [ ] **Stap 3: Laad opmerkingen in de `load` functie**

Vervang het blok dat eindigt op `setInschrijvingen(new Map());` in de `load` functie door:

```ts
    if (ids.length > 0) {
      const { data: md } = await supabase
        .from("meedoen_met_naam")
        .select("activiteit_id,naam")
        .in("activiteit_id", ids);

      const map = new Map<string, string[]>();
      for (const row of (md ?? []) as { activiteit_id: string; naam: string }[]) {
        const lijst = map.get(row.activiteit_id) ?? [];
        lijst.push(row.naam);
        map.set(row.activiteit_id, lijst);
      }
      setInschrijvingen(map);

      const { data: opmerkingenData } = await supabase
        .from("meedoen")
        .select("activiteit_id, opmerking, vrijwilligers(voornaam, achternaam)")
        .not("opmerking", "is", null)
        .in("activiteit_id", ids);

      const opMap = new Map<string, { naam: string; opmerking: string }[]>();
      for (const row of (opmerkingenData ?? []) as OpmerkingRow[]) {
        if (!row.opmerking) continue;
        const vn = row.vrijwilligers?.voornaam ?? "";
        const an = row.vrijwilligers?.achternaam ?? "";
        const naam = `${vn} ${an}`.trim() || "(onbekend)";
        const lijst = opMap.get(row.activiteit_id) ?? [];
        lijst.push({ naam, opmerking: row.opmerking });
        opMap.set(row.activiteit_id, lijst);
      }
      setAdminOpmerkingen(opMap);
    } else {
      setInschrijvingen(new Map());
      setAdminOpmerkingen(new Map());
    }
```

- [ ] **Stap 4: Voeg mail-handler functie toe**

Voeg voor de `return (` statement de volgende functies toe:

```ts
  function openMailModal(a: Activiteit) {
    setMailBoodschap("");
    setMailResultaat(null);
    setMailFout(null);
    setMailModal({ activiteitId: a.id, titel: a.titel });
  }

  async function verstuurMail() {
    if (!mailModal || !mailBoodschap.trim()) return;
    setMailBezig(true);
    setMailFout(null);
    setMailResultaat(null);
    try {
      const result = await stuurMailNaarDeelnemers(mailModal.activiteitId, mailBoodschap.trim());
      if (result.error) {
        setMailFout(result.error);
      } else {
        setMailResultaat(`Mail verstuurd naar ${result.verstuurd} vrijwilliger${result.verstuurd !== 1 ? "s" : ""}.`);
      }
    } catch (e: unknown) {
      setMailFout(e instanceof Error ? e.message : "Fout bij versturen.");
    } finally {
      setMailBezig(false);
    }
  }
```

- [ ] **Stap 5: Voeg mail modal JSX toe**

In de `return` sectie, voeg de mail modal toe na het bestaande `reeksModal` blok (net voor `<main ...>`):

```tsx
      {/* Mail modal */}
      {mailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full space-y-4">
            <h2 className="font-semibold text-lg">Mail versturen naar deelnemers</h2>
            <p className="text-sm text-gray-600">{mailModal.titel}</p>
            {mailResultaat ? (
              <>
                <div className="wa-alert-success">{mailResultaat}</div>
                <button
                  className="wa-btn wa-btn-ghost w-full py-2 text-sm"
                  onClick={() => setMailModal(null)}
                >
                  Sluiten
                </button>
              </>
            ) : (
              <>
                {mailFout && <div className="wa-alert-error">{mailFout}</div>}
                <textarea
                  className="w-full border rounded-xl px-3 py-2 text-sm min-h-[120px] resize-y"
                  placeholder="Typ hier je bericht…"
                  value={mailBoodschap}
                  onChange={(e) => setMailBoodschap(e.target.value)}
                  disabled={mailBezig}
                />
                <div className="flex gap-2">
                  <button
                    className="wa-btn wa-btn-brand flex-1 py-2 text-sm"
                    onClick={verstuurMail}
                    disabled={mailBezig || !mailBoodschap.trim()}
                  >
                    {mailBezig ? "Versturen…" : "Versturen"}
                  </button>
                  <button
                    className="wa-btn wa-btn-ghost flex-1 py-2 text-sm"
                    onClick={() => setMailModal(null)}
                    disabled={mailBezig}
                  >
                    Annuleren
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
```

- [ ] **Stap 6: Voeg mail-knop en opmerkingen-sectie toe aan activiteitenkaarten**

In de activiteitenkaart, vervang het blok met de actieknoppen (het `<div className="pt-2 flex gap-2">` blok dat "Bewerken" en "Verwijderen" bevat) door:

```tsx
                          {(() => {
                            const actOpmerkingen = adminOpmerkingen.get(a.id) ?? [];
                            return actOpmerkingen.length > 0 ? (
                              <div className="text-sm text-gray-700 space-y-1">
                                <div className="font-medium text-gray-800">Opmerkingen</div>
                                {actOpmerkingen.map((o, i) => (
                                  <div key={i} className="text-sm text-gray-600">
                                    <span className="font-medium">{o.naam}</span>: {o.opmerking}
                                  </div>
                                ))}
                              </div>
                            ) : null;
                          })()}

                          <div className="pt-2 flex flex-wrap gap-2">
                            {(() => {
                              const namen = inschrijvingen.get(a.id) ?? [];
                              return namen.length > 0 ? (
                                <button
                                  className="wa-btn wa-btn-ghost flex-1 px-4 py-2 text-sm"
                                  onClick={() => openMailModal(a)}
                                  disabled={busy}
                                >
                                  Mail naar deelnemers
                                </button>
                              ) : null;
                            })()}
                            <button
                              className="wa-btn wa-btn-ghost flex-1 px-4 py-2 text-sm"
                              onClick={() => router.push(`/admin/activiteiten/${a.id}`)}
                              disabled={busy}
                            >
                              Bewerken
                            </button>
                            <button
                              className="wa-btn-danger flex-1 px-4 py-2 text-sm"
                              onClick={() => deleteActiviteit(a)}
                              disabled={busy}
                            >
                              Verwijderen
                            </button>
                          </div>
```

- [ ] **Stap 7: Verificeer TypeScript**

```bash
cd "C:\Users\Acer\Projecten\waaranders-vrijwilligers" && npx tsc --noEmit 2>&1 | head -20
```

Verwacht: geen fouten.

- [ ] **Stap 8: Commit**

```bash
git add src/app/admin/activiteiten/page.tsx
git commit -m "feat: mail naar deelnemers + opmerkingen sectie in admin activiteiten"
```

---

## Task 3: Server action — opmerking mail (vrijwilliger)

**Files:**
- Create: `src/app/(app)/activiteiten/actions.ts`

- [ ] **Stap 1: Maak het bestand aan**

Maak `src/app/(app)/activiteiten/actions.ts` aan:

```ts
"use server";

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is niet geconfigureerd.");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

function formatDatum(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return new Intl.DateTimeFormat("nl-BE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

export async function stuurOpmerkingMail(
  activiteitId: string,
  vrijwilligerNaam: string,
  opmerking: string,
  isUpdate: boolean
): Promise<void> {
  try {
    const supabase = supabaseAdmin();

    const { data: act } = await supabase
      .from("activiteiten")
      .select("titel, wanneer, klant_id")
      .eq("id", activiteitId)
      .maybeSingle();
    if (!act?.klant_id) return;

    const { data: klant } = await supabase
      .from("klanten")
      .select("aanspreekpunt_vrijwilliger_id")
      .eq("id", act.klant_id)
      .maybeSingle();
    if (!klant?.aanspreekpunt_vrijwilliger_id) return;

    const { data: ap } = await supabase
      .from("vrijwilligers")
      .select("user_id, voornaam")
      .eq("id", klant.aanspreekpunt_vrijwilliger_id)
      .maybeSingle();
    if (!ap?.user_id) return;

    const { data: usersData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const apUser = usersData?.users.find((u) => u.id === ap.user_id);
    if (!apUser?.email) return;

    const datumStr = formatDatum(act.wanneer);
    const actie = isUpdate
      ? `heeft zijn/haar opmerking bij de activiteit ${act.titel} op ${datumStr} aangepast: "${opmerking}"`
      : `heeft een opmerking toegevoegd bij de activiteit ${act.titel} op ${datumStr}: "${opmerking}"`;

    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "Waaranders <noreply@waaranders.be>",
      replyTo: "info@waaranders.be",
      to: apUser.email,
      subject: `Opmerking bij ${act.titel}`,
      text: `Beste ${ap.voornaam ?? ""},\n\n${vrijwilligerNaam} ${actie}\n\nMet vriendelijke groeten,\nhet Waaranders-team`,
    });
  } catch (e) {
    console.error("Fout bij versturen opmerkingmail:", e);
  }
}
```

- [ ] **Stap 2: Verificeer TypeScript**

```bash
cd "C:\Users\Acer\Projecten\waaranders-vrijwilligers" && npx tsc --noEmit 2>&1 | head -20
```

Verwacht: geen fouten.

- [ ] **Stap 3: Commit**

```bash
git add "src/app/(app)/activiteiten/actions.ts"
git commit -m "feat: server action stuurOpmerkingMail"
```

---

## Task 4: Vrijwilliger activiteiten pagina — opmerking badge + modal

**Files:**
- Modify: `src/app/(app)/activiteiten/page.tsx`

Dit is de grootste wijziging. De pagina is al een `"use client"` component. We voegen state toe voor opmerkingen en een modal.

- [ ] **Stap 1: Voeg import toe**

Voeg bovenaan het bestand, na de bestaande imports, toe:

```ts
import { stuurOpmerkingMail } from "./actions";
```

- [ ] **Stap 2: Voeg types toe**

Voeg na de bestaande `MeedoenMetNaamRow` type definitie toe:

```ts
type MijnMeedoenRow = {
  activiteit_id: string;
  opmerking: string | null;
};
```

- [ ] **Stap 3: Voeg state toe**

Voeg in de `ActiviteitenPage` component, na de bestaande state declarations (`busyId`, `error`), de volgende state toe:

```ts
  const [mijnNaam, setMijnNaam] = useState<string>("");
  const [opmerkingen, setOpmerkingen] = useState<Map<string, string | null>>(new Map());

  // Opmerking modal state
  type OpmerkingModal = { activiteitId: string; activiteitTitel: string };
  const [opmerkingModal, setOpmerkingModal] = useState<OpmerkingModal | null>(null);
  const [opmerkingTekst, setOpmerkingTekst] = useState("");
  const [opmerkingBezig, setOpmerkingBezig] = useState(false);
  const [opmerkingFout, setOpmerkingFout] = useState<string | null>(null);
```

- [ ] **Stap 4: Laad naam en opmerkingen in `loadAll`**

In de `loadAll` functie, zoek het blok waar `setMyId(user.id)` staat. Voeg daarna (na de onboarding checks, maar voor de activiteiten query) het volgende toe — maar het is leesbaarder dit toe te voegen als aparte query na de bestaande activiteiten en meedoen queries, vlak voor `setLoading(false)`.

Vervang het blok:

```ts
    setMeedoen((md ?? []) as MeedoenMetNaamRow[]);
    setLoading(false);
```

door:

```ts
    setMeedoen((md ?? []) as MeedoenMetNaamRow[]);

    // Naam van de ingelogde vrijwilliger
    const { data: vNaam } = await supabase
      .from("vrijwilligers")
      .select("voornaam, achternaam")
      .eq("id", user.id)
      .maybeSingle();
    setMijnNaam(`${vNaam?.voornaam ?? ""} ${vNaam?.achternaam ?? ""}`.trim());

    // Opmerkingen van de ingelogde vrijwilliger
    const { data: mijnMeedoen } = await supabase
      .from("meedoen")
      .select("activiteit_id, opmerking")
      .eq("vrijwilliger_id", user.id)
      .in("activiteit_id", ids);

    const opMap = new Map<string, string | null>();
    for (const row of (mijnMeedoen ?? []) as MijnMeedoenRow[]) {
      opMap.set(row.activiteit_id, row.opmerking);
    }
    setOpmerkingen(opMap);

    setLoading(false);
```

- [ ] **Stap 5: Voeg opmerking-handlers toe**

Voeg voor de `return (` statement de volgende functies toe:

```ts
  function openOpmerkingModal(a: Activiteit) {
    setOpmerkingTekst(opmerkingen.get(a.id) ?? "");
    setOpmerkingFout(null);
    setOpmerkingModal({ activiteitId: a.id, activiteitTitel: a.titel });
  }

  async function slaOpmerkingOp() {
    if (!opmerkingModal || !myId) return;
    const { activiteitId } = opmerkingModal;
    const tekst = opmerkingTekst.trim() || null;

    setOpmerkingBezig(true);
    setOpmerkingFout(null);

    const { error } = await supabase
      .from("meedoen")
      .update({ opmerking: tekst })
      .eq("activiteit_id", activiteitId)
      .eq("vrijwilliger_id", myId);

    if (error) {
      setOpmerkingFout(error.message);
      setOpmerkingBezig(false);
      return;
    }

    const wasUpdate = !!(opmerkingen.get(activiteitId));
    setOpmerkingen((prev) => new Map(prev).set(activiteitId, tekst));
    setOpmerkingModal(null);
    setOpmerkingBezig(false);

    if (tekst) {
      stuurOpmerkingMail(activiteitId, mijnNaam, tekst, wasUpdate).catch((e) =>
        console.error("Opmerkingmail mislukt:", e)
      );
    }
  }

  async function verwijderOpmerking() {
    if (!opmerkingModal || !myId) return;
    const { activiteitId } = opmerkingModal;

    setOpmerkingBezig(true);
    setOpmerkingFout(null);

    const { error } = await supabase
      .from("meedoen")
      .update({ opmerking: null })
      .eq("activiteit_id", activiteitId)
      .eq("vrijwilliger_id", myId);

    if (error) {
      setOpmerkingFout(error.message);
      setOpmerkingBezig(false);
      return;
    }

    setOpmerkingen((prev) => {
      const next = new Map(prev);
      next.set(activiteitId, null);
      return next;
    });
    setOpmerkingModal(null);
    setOpmerkingBezig(false);
  }
```

- [ ] **Stap 6: Voeg opmerking modal JSX toe**

In de `return` sectie, vervang `<main className="mx-auto max-w-4xl p-4 sm:p-6 md:p-10">` door:

```tsx
    <>
      {/* Opmerking modal */}
      {opmerkingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full space-y-4">
            <h2 className="font-semibold text-lg">Opmerking</h2>
            <p className="text-sm text-gray-600">{opmerkingModal.activiteitTitel}</p>
            {opmerkingFout && <div className="wa-alert-error">{opmerkingFout}</div>}
            <textarea
              className="w-full border rounded-xl px-3 py-2 text-sm min-h-[100px] resize-y"
              placeholder="Typ hier je opmerking…"
              value={opmerkingTekst}
              onChange={(e) => setOpmerkingTekst(e.target.value)}
              disabled={opmerkingBezig}
            />
            <div className="flex flex-col gap-2">
              <button
                className="wa-btn wa-btn-brand py-2 text-sm"
                onClick={slaOpmerkingOp}
                disabled={opmerkingBezig || !opmerkingTekst.trim()}
              >
                {opmerkingBezig ? "Bezig…" : "Opslaan"}
              </button>
              {opmerkingen.get(opmerkingModal.activiteitId) && (
                <button
                  className="wa-btn-danger py-2 text-sm"
                  onClick={verwijderOpmerking}
                  disabled={opmerkingBezig}
                >
                  Verwijderen
                </button>
              )}
              <button
                className="wa-btn wa-btn-ghost py-2 text-sm"
                onClick={() => setOpmerkingModal(null)}
                disabled={opmerkingBezig}
              >
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-4xl p-4 sm:p-6 md:p-10">
```

En vervang de afsluitende `</main>` van de `return` door `</main></>`.

- [ ] **Stap 7: Voeg opmerking badge toe aan activiteitenkaart**

In de kaart, zoek het blok:

```tsx
                          {isIn && (
                            <span className="wa-active-badge px-3 py-1 rounded-full text-sm font-bold whitespace-nowrap">
                              Jij doet mee
                            </span>
                          )}
```

Vervang dit door:

```tsx
                          {isIn && (
                            <div className="flex flex-col items-end gap-1">
                              <span className="wa-active-badge px-3 py-1 rounded-full text-sm font-bold whitespace-nowrap">
                                Jij doet mee
                              </span>
                              <button
                                className="text-xs text-blue-700 hover:underline"
                                onClick={() => openOpmerkingModal(a)}
                              >
                                {opmerkingen.get(a.id) ? "✎ Jouw opmerking" : "＋ Opmerking toevoegen"}
                              </button>
                            </div>
                          )}
```

- [ ] **Stap 8: Verificeer TypeScript**

```bash
cd "C:\Users\Acer\Projecten\waaranders-vrijwilligers" && npx tsc --noEmit 2>&1 | head -30
```

Verwacht: geen fouten.

- [ ] **Stap 9: Commit**

```bash
git add "src/app/(app)/activiteiten/page.tsx"
git commit -m "feat: opmerking badge en modal voor vrijwilligers bij activiteiten"
```

---

## Task 5: Final commit

- [ ] **Stap 1: Check alles staat gecommit**

```bash
cd "C:\Users\Acer\Projecten\waaranders-vrijwilligers" && git status
```

Verwacht: `nothing to commit, working tree clean`

- [ ] **Stap 2: Maak een merge-commit met de juiste beschrijving**

```bash
git commit --allow-empty -m "Activiteiten: mail naar deelnemers + opmerking bij inschrijving"
```

> **Note:** Als alle tasks al gecommit zijn in afzonderlijke commits, sla deze stap over of squash de commits naar één: `git rebase -i HEAD~4` en zet ze samen met de message `Activiteiten: mail naar deelnemers + opmerking bij inschrijving`.

---

## Handmatige verificatie

Na implementatie, test via `npm run dev`:

1. **Admin mail**: Ga naar `/admin/activiteiten`, klik "Mail naar deelnemers" op een activiteit met deelnemers, typ een bericht, klik Versturen. Controleer inbox van een deelnemer.
2. **Opmerking toevoegen**: Log in als vrijwilliger, ga naar `/activiteiten`, schrijf je in voor een activiteit, klik "＋ Opmerking toevoegen", typ opmerking, sla op. Controleer badge verandert naar "✎ Jouw opmerking".
3. **Opmerking zichtbaar admin**: Ga naar `/admin/activiteiten`, controleer dat de opmerking zichtbaar is onder de deelnemerslijst.
4. **Opmerking verwijderen**: Klik "✎ Jouw opmerking", klik Verwijderen. Controleer badge verandert terug naar "＋ Opmerking toevoegen".
5. **Mail aanspreekpunt**: Bij stap 2, controleer dat het aanspreekpunt van de klant een mail heeft ontvangen (alleen als de activiteit een klant met aanspreekpunt heeft).
