# Technische overdracht: WaarAnders Vrijwilligersapp

**Contactpersoon huidige beheerder:** Mark Hongenaert — markhongenaert.x@gmail.com

---

## 1. Technische stack

| Laag | Technologie | Versie | Waarvoor |
|---|---|---|---|
| Frontend | **Next.js** (App Router) | 16.x | Server- en client-side rendering, routing, server actions |
| UI | **React** + **Tailwind CSS 4** | 19.x / 4.x | Component-gebaseerde UI, utility-first styling |
| Taal | **TypeScript** | 5.x | Statische typering |
| Backend-as-a-service | **Supabase** | — | PostgreSQL-database, authenticatie, Row Level Security |
| Hosting | **Vercel** | — | Automatische deployment, edge functions, logs |
| Versiebeheer | **GitHub** | — | Broncode, history, branches |
| E-mail | **Resend** | 6.x | Transactionele e-mails naar vrijwilligers |

### Next.js — App Router

De app gebruikt de **App Router** (map `src/app/`). Dat betekent:
- Mappen worden routes. `src/app/admin/klanten/page.tsx` → `/admin/klanten`
- Server Components draaien op de server (geen JavaScript naar de browser).
- `"use client"` bovenaan een bestand = component draait in de browser.
- `"use server"` functies = server actions, worden aangeroepen vanuit Client Components maar draaien server-side (geen API-route nodig).

Twee Supabase-clients naast elkaar:
- `src/lib/supabaseClient.ts` — browser client, gebruik in `"use client"` componenten
- `src/lib/supabase/server.ts` — server client, gebruik in Server Components en server actions

### Supabase

Beheert drie dingen in één:
1. **PostgreSQL-database** — alle data
2. **Authenticatie** — magic links, wachtwoordlogin, sessie-cookies via `@supabase/ssr`
3. **Row Level Security (RLS)** — toegangsregels op rijniveau in de database zelf (zie sectie 5)

De middleware (`src/middleware.ts`) draait op elke request en ververst de sessie-cookies automatisch.

### Vercel

Pikt automatisch elke `git push` naar de `main`-branch op en start een nieuwe build. Zie sectie 6 voor het volledige deployment-mechanisme.

### GitHub

Repository met de volledige broncode, commit history en de koppeling naar Vercel (webhook).

### Resend

Verstuurt e-mails vanuit server actions. Gebruikt een **service-role Supabase-client** (bypast RLS) om e-mailadressen van vrijwilligers op te halen, en de Resend SDK om te versturen. Afzender: `noreply@waaranders.be`, reply-to: `info@waaranders.be`. Domeinconfiguratie staat in het Resend-dashboard.

---

## 2. Externe diensten

| Dienst | Gebruik in de app | Dashboard |
|---|---|---|
| **Supabase** | Database, auth, RLS | https://supabase.com/dashboard |
| **Vercel** | Hosting, CI/CD, logs | https://vercel.com |
| **GitHub** | Broncode, versies | https://github.com |
| **Resend** | E-mailverzending | https://resend.com |

Alle vier vereisen een login-account. Zorg dat de nieuwe beheerder uitgenodigd wordt als teamlid op elk platform, of dat de credentials overgedragen worden.

---

## 3. Credentials en omgevingsvariabelen

De geheime sleutels staan **niet** in de broncode. Ze zijn geconfigureerd op twee plekken:

**Lokaal (voor development):**
```
C:\Users\Acer\Projecten\waaranders-vrijwilligers\.env.local
```
Dit bestand staat in `.gitignore` en wordt nooit gecommit.

**Op Vercel (voor de live app):**
Vercel-dashboard → jouw project → **Settings → Environment Variables**

### Variabelenamen

| Variabele | Waar gebruikt | Zichtbaar in browser? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Database-adres | Ja (`NEXT_PUBLIC_` prefix) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publieke Supabase-sleutel | Ja (`NEXT_PUBLIC_` prefix) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only; bypast RLS voor e-mailverzending | Nee |
| `RESEND_API_KEY` | E-mails versturen via Resend | Nee |

> **Let op:** `SUPABASE_SERVICE_ROLE_KEY` geeft volledige databasetoegang zonder RLS. Gebruik deze uitsluitend in server-side code (`"use server"` actions), nooit in client-code.

De waarden van de `NEXT_PUBLIC_*` sleutels vind je in Supabase → **Settings → API**. De service role key staat op dezelfde pagina maar is gevoeliger. De Resend key staat in Resend → **API Keys**.

---

## 4. Databasestructuur

Alle wijzigingen aan de database gebeuren **manueel via de SQL Editor** in het Supabase-dashboard. Er is geen migratiescript of ORM-tooling aanwezig.

### Overzicht van de tabellen

#### `vrijwilligers`
De centrale tabel. Elke rij is één vrijwilliger.

| Kolom | Type | Omschrijving |
|---|---|---|
| `id` | uuid (PK) | **Gelijk aan `auth.uid()`** — zie aandachtspunten |
| `user_id` | uuid | Ook gelijk aan `auth.uid()` (legacy redundantie) |
| `voornaam` | text | — |
| `achternaam` | text | — |
| `naam` | text | Volledige naam (soms als weergavenaam gebruikt) |
| `telefoon` | text | — |
| `adres` | text | — |
| `actief` | boolean | `false` = gearchiveerd, wordt uitgelogd en geblokkeerd |
| `profiel_afgewerkt` | boolean | `false` = doorsturen naar profielpagina na login |

#### `roles`
Opzoektabel met de drie rolnamen.

| Kolom | Omschrijving |
|---|---|
| `id` | uuid (PK) |
| `code` | `vrijwilliger` \| `doenker` \| `admin` |
| `titel` | Leesbare naam |

#### `vrijwilliger_roles`
Koppeltabel: welke vrijwilliger heeft welke rol?

| Kolom | Omschrijving |
|---|---|
| `vrijwilliger_id` | FK → `vrijwilligers.id` |
| `rol_id` | FK → `roles.id` |
| `toegekend_door` | FK → `vrijwilligers.id` (wie heeft de rol toegewezen) |

Elke vrijwilliger heeft precies één basisrol (`vrijwilliger`, `doenker`, of `admin`). De rollen-beheerpagina (`/admin/rollen`) verwijdert eerst alle basisrollen en voegt daarna de gekozen rol opnieuw in.

#### `klanten`
Organisaties of personen waarvoor WaarAnders vrijwilligers inzet.

| Kolom | Omschrijving |
|---|---|
| `id` | uuid (PK) |
| `naam` | Naam van de klant/organisatie |
| `contactpersoon_naam` | — |
| `contactpersoon_telefoon` | — |
| `adres` | — |
| `actief` | boolean |
| `gearchiveerd_op` | timestamp, ingevuld bij archivering |

#### `klant_doelgroepen`
Koppelt maximaal één doelgroep aan een klant (unieke index op `klant_id`).

| Kolom | Omschrijving |
|---|---|
| `klant_id` | FK → `klanten.id` (unique) |
| `doelgroep_id` | FK → `doelgroepen.id` |

#### `doelgroepen`
Opzoektabel voor doelgroepen (beheerd via Supabase, niet via de app).

#### `activiteiten`
Geplande activiteiten waarop vrijwilligers kunnen intekenen.

| Kolom | Omschrijving |
|---|---|
| `id` | uuid (PK) |
| `titel` | — |
| `toelichting` | Optionele beschrijving |
| `wanneer` | Datum (YYYY-MM-DD) |
| `startuur` / `einduur` | Tijdstip (HH:MM) |
| `aantal_vrijwilligers` | Gewenst aantal deelnemers |
| `klant_id` | FK → `klanten.id` (optioneel) |
| `herhaling_reeks_id` | Koppelt herhalende activiteiten aan elkaar |

#### `meedoen_met_naam`
Registreert wie meedoet aan welke activiteit.

| Kolom | Omschrijving |
|---|---|
| `activiteit_id` | FK → `activiteiten.id` |
| `vrijwilliger_id` | FK → `vrijwilligers.id` |
| `naam` | Naam op het moment van inschrijving |

#### `todos`
Interne taakenlijst voor doenkers.

| Kolom | Omschrijving |
|---|---|
| `id` | uuid (PK) |
| `wat` | Beschrijving van de taak |
| `wie_vrijwilliger_id` | FK → `vrijwilligers.id` (verantwoordelijke) |
| `streefdatum` | Datum (YYYY-MM-DD) |
| `prioriteit` | `laag` \| `normaal` \| `hoog` |
| `status` | `gepland` \| `bezig` \| `gedaan` |

#### `werkgroepen`
Thematische groepen van vrijwilligers.

| Kolom | Omschrijving |
|---|---|
| `id` | uuid (PK) |
| `titel` | Naam van de werkgroep |
| `trekker` | Naam of beschrijving van de trekker |

#### `werkgroep_deelnemers`
Koppelt vrijwilligers aan werkgroepen.

| Kolom | Omschrijving |
|---|---|
| `werkgroep_id` | FK → `werkgroepen.id` |
| `vrijwilliger_id` | FK → `vrijwilligers.id` |

### Relatieschema (vereenvoudigd)

```
auth.users (Supabase intern)
    │ id
    ▼
vrijwilligers (id = auth.uid())
    │
    ├── vrijwilliger_roles ──► roles (code: vrijwilliger|doenker|admin)
    ├── meedoen_met_naam   ──► activiteiten ──► klanten
    ├── werkgroep_deelnemers ► werkgroepen
    └── todos (wie_vrijwilliger_id)

klanten ──► klant_doelgroepen ──► doelgroepen
```

---

## 5. Rollenmodel en beveiliging

### De drie rollen

| Rol | Wie | Toegang |
|---|---|---|
| `vrijwilliger` | Gewone vrijwilliger | `/activiteiten` en `/profiel` — eigen gegevens raadplegen en inschrijven op activiteiten |
| `doenker` | Interne medewerker WaarAnders | Bovenstaande + `/admin/*` — klanten, vrijwilligers, activiteiten, todos, werkgroepen beheren |
| `admin` | Systeembeheerder | Alles van doenker + `/admin/rollen` — rollen van andere gebruikers aanpassen |

### Hoe beveiliging technisch werkt

**Laag 1 — Applicatie (client-side):**
- `AuthBootstrap` controleert bij elke beschermde route of er een sessie is; anders doorsturen naar `/login`.
- `AdminLayout` controleert via `isDoenkerOrAdmin()` of de gebruiker de admin-sectie mag zien.
- `AppHeader` controleert `actief`-vlag en logt inactieve gebruikers onmiddellijk uit.
- De rollen-beheerpagina (`/admin/rollen`) vereist bovendien de rol `admin` (niet alleen `doenker`).

**Laag 2 — Database (RLS / Row Level Security):**
Supabase voert voor elke databasequery de RLS-policies uit. Deze policies controleren `auth.uid()` en de rollen in `vrijwilliger_roles`. Zonder juiste policy geeft Supabase een `permission denied` terug, ook al zou de applicatiecode het toelaten.

> **Belangrijk:** de applicatielaag is de eerste verdediging, RLS is de tweede. Beide moeten kloppen. Bij databasewijzigingen altijd de RLS-policies controleren (zie sectie 7).

### Helper-functies voor rolcontrole

`src/lib/auth.ts`:
- `getMyRoleCodes()` — haalt rolcodes op; geeft `[]` terug als `actief=false`
- `hasRole(role)` — true/false voor een specifieke rol
- `isDoenkerOrAdmin()` — true als doenker of admin
- `isAdmin()` — true alleen als admin

Deze functies gebruiken de **browser client** en zijn bedoeld voor Client Components.

---

## 6. Deployment: van commit tot live

```
Developer → git push origin main
                │
                ▼
         GitHub (main branch)
                │  webhook
                ▼
         Vercel detecteert nieuwe commit
                │
                ▼
         Build: npm run build (Next.js)
                │  als build slaagt
                ▼
         Nieuwe deployment actief op live URL
                │  als build faalt
                ▼
         Vorige versie blijft actief, foutmelding in Vercel-dashboard
```

- Elke commit op `main` triggert automatisch een nieuwe build op Vercel.
- De build draait `next build`. Als die faalt (TypeScript-fout, ontbrekende env var, etc.) blijft de vorige werkende versie live.
- Preview deployments: commits op andere branches krijgen een tijdelijke preview-URL (handig voor testen).
- Rollback: in het Vercel-dashboard kun je met één klik een eerdere deployment opnieuw activeren.

**Omgevingsvariabelen bij Vercel:** Vercel injecteert de environment variables tijdens de build. Als je een nieuwe variabele toevoegt aan `.env.local`, moet je die ook handmatig toevoegen in Vercel → Settings → Environment Variables, gevolgd door een nieuwe deployment (redeploy).

---

## 7. Bekende aandachtspunten en valkuilen

### 1. RLS-policies: altijd controleren bij databasewijzigingen

Supabase zet RLS standaard aan. Als je een nieuwe tabel aanmaakt of een bestaande tabel wijzigt, zijn er **geen** policies tenzij je ze handmatig aanmaakt. Resultaat: queries vanuit de app leveren lege resultaten of een `permission denied`-fout op, ook als de data er wel is.

Controleer na elke databasewijziging: Supabase → **Authentication → Policies** → selecteer de tabel.

### 2. `vrijwilligers.id` is altijd gelijk aan `auth.uid()`

Bij het aanmaken van een vrijwilliger-rij (in `AuthBootstrap`) wordt `id = user.id` ingevuld. De tabel heeft ook een `user_id`-kolom die dezelfde waarde bevat. Dit is een historische redundantie. In RLS-policies en queries moet je consistent zijn: sommige plaatsen in de code gebruiken `.eq("id", user.id)` en andere `.eq("user_id", user.id)`. Beide werken, maar wees consequent bij nieuwe code.

### 3. Twee beveiligingslagen naast elkaar

De admin-sectie heeft beveiliging op twee niveaus:
- **Applicatielaag:** `AdminLayout` en `isDoenkerOrAdmin()` blokkeren niet-geautoriseerde gebruikers in de browser.
- **Databaselaag:** RLS-policies blokkeren niet-geautoriseerde queries op de Supabase-server.

Beide moeten kloppen. Het risico bestaat dat je een nieuwe feature bouwt, de applicatielaag beveiligt, maar de bijbehorende RLS-policy vergeet — of omgekeerd. Controleer altijd beide.

### 4. Databasewijzigingen zijn manueel

Er is geen migratiescript, geen ORM, geen `supabase db push`. Alle schemawijzigingen (nieuwe tabellen, kolommen, indexes, policies) worden handmatig uitgevoerd via de **SQL Editor** in het Supabase-dashboard. Documenteer je wijzigingen zelf (bv. in een apart bestand of in een commit message).

### 5. `SUPABASE_SERVICE_ROLE_KEY` bypast RLS

De server action voor e-mailverzending gebruikt een admin-client met de `SUPABASE_SERVICE_ROLE_KEY`. Diese client heeft volledige databasetoegang en omzeilt alle RLS-policies. Gebruik dit enkel server-side en nooit in client-code. De variabele heeft bewust geen `NEXT_PUBLIC_` prefix.

### 6. `actief=false` is de archiveringsmethode

Vrijwilligers en klanten worden niet verwijderd maar gedeactiveerd (`actief = false`). Gearchiveerde vrijwilligers worden bij de volgende paginabezoek automatisch uitgelogd door `AppHeader`. Ze verliezen ook alle rollen: `getMyRoleCodes()` geeft `[]` terug als `actief=false`.

---

## 8. Contactinfo huidige beheerder

**Mark Hongenaert**
E-mail: markhongenaert.x@gmail.com

Neem contact op voor:
- Toegang tot Supabase, Vercel, GitHub, Resend
- Overdracht van API keys en credentials
- Vragen over beslissingen in de codebase

---

## 9. Checklist eerste dag: toegang tot alle systemen

- [ ] **GitHub** — toegang krijgen tot de repository (uitnodiging als collaborator of fork)
- [ ] **Vercel** — uitnodigen als teamlid op het Vercel-project; controleer of de environment variables zichtbaar zijn
- [ ] **Supabase** — uitnodigen op het Supabase-project (Settings → Team); krijg toegang tot de SQL Editor en de API-sleutels
- [ ] **Resend** — uitnodigen op het Resend-account; haal de API-sleutel op of maak een nieuwe aan
- [ ] **`.env.local` aanmaken** — maak het bestand aan op je lokale machine met de vier variabelen (zie sectie 3); haal de waarden op uit Supabase en Resend
- [ ] **Lokaal testen** — voer `npm install` en `npm run dev` uit; navigeer naar `http://localhost:3000` en controleer of de app werkt
- [ ] **Claude Code installeren** — installeer via `npm install -g @anthropic-ai/claude-code` (vereist een Anthropic-account); start met `claude` in de projectmap
- [ ] **Deployment verifiëren** — doe een kleine testwijziging, commit en push naar `main`; controleer in het Vercel-dashboard of de build slaagt
- [ ] **RLS verkennen** — open Supabase → Authentication → Policies en lees de bestaande policies voor de belangrijkste tabellen (`vrijwilligers`, `activiteiten`, `todos`)

---

## Appendix: Routeoverzicht

| Route | Toegang | Beschrijving |
|---|---|---|
| `/` | — | Server-side redirect op basis van sessie/profiel |
| `/login` | Publiek | Tweestaps-loginflow (e-mail → wachtwoord) |
| `/registreer` | Publiek | Nieuwe vrijwilliger registreren |
| `/wachtwoord-vergeten` | Publiek | Wachtwoordherstel |
| `/auth/reset` | Publiek | Nieuw wachtwoord instellen (na magic link) |
| `/auth/callback` | Publiek | OAuth/magic-link callback |
| `/activiteiten` | Vrijwilliger | Activiteitenoverzicht + inschrijven |
| `/profiel` | Vrijwilliger | Profiel bekijken/bewerken |
| `/admin` | Doenker/Admin | Beheer-dashboard |
| `/admin/klanten` | Doenker/Admin | Klantenbeheer |
| `/admin/vrijwilligers` | Doenker/Admin | Vrijwilligersbeheer |
| `/admin/activiteiten` | Doenker/Admin | Activiteitenbeheer |
| `/admin/todos` | Doenker/Admin | Interne taakenlijst |
| `/admin/werkgroepen` | Doenker/Admin | Werkgroepenbeheer + prikbord + e-mails |
| `/admin/rollen` | **Admin only** | Rollen toewijzen aan vrijwilligers |
