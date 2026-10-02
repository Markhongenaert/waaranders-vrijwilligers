# Documentatie — WaarAnders Vrijwilligersapp

**Laatst bijgewerkt:** 2 oktober 2026 (door Claude Code, op basis van de code en het databaseschema op dat moment).

> **Leeswijzer:** dit document is geschreven voor een niet-programmeur. Vaktermen worden kort uitgelegd bij hun eerste gebruik. Overal waar iets niet met zekerheid uit de code of het schema kon afgeleid worden, staat **[NAKIJKEN]**.

---

## 1. Doel en gebruikers

De WaarAnders Vrijwilligersapp is een webapplicatie (ook te gebruiken als "app" op een smartphone-startscherm) waarmee de vzw WaarAnders haar vrijwilligerswerking organiseert:

- vrijwilligers zien welke **activiteiten** en **ezelwandelingen** gepland zijn en kunnen zich in- of uitschrijven;
- vrijwilligers kunnen lid worden van **werkgroepen** en zien er informatie en openstaande taken;
- de interne medewerkers ("**doenkers**") en de systeembeheerder (**admin**) beheren klanten, activiteiten, vrijwilligers, werkgroepen, een eenvoudige taken-/todo-lijst, vakantieplanning van doenkers, en versturen mails/WhatsApp-berichten naar deelnemers;
- sinds kort (functie "wandelroutes") kan WaarAnders ook **wandelroutes met een kaart** tonen, zowel intern (gekoppeld aan een ezelwandeling) als op een **publieke pagina** `/wandelroutes` die iedereen kan bekijken zonder account.

**Gebruikers:** een kleine groep (grootte-orde ~30 personen volgens de projectcontext) van vrijwilligers, doenkers en één of enkele admins. Geen grote schaal, geen zware performance-eisen; begrijpbaarheid en aanpasbaarheid wegen zwaarder dan technische verfijning.

**Wat buiten de scope valt (op dit moment):**
- Er is **geen facturatie- of verbruiksmodule** teruggevonden in de code of het databaseschema (geen tabellen rond "verbruik", "producten" of "facturen"). Als dat ooit elders vermeld stond als toekomstplan, is het nog niet gebouwd. **[NAKIJKEN]**
- Er is geen aparte "agenda"-module los van activiteiten/ezelwandelingen/prikborden.
- Geen geautomatiseerde betalingen, geen boekhoudkoppeling.

---

## 2. Rollen en rechten

Er zijn drie rollen, elk met een **code** in de databank (tabel `roles`):

| Rol (code) | Wie | Mag |
|---|---|---|
| `vrijwilliger` | Elke geregistreerde vrijwilliger | `/activiteiten`, `/ezelwandelingen`, `/profiel`, `/todos` (eigen taken), publieke pagina's |
| `doenker` | Interne medewerker WaarAnders | Alles van vrijwilliger + de volledige `/admin/*`-sectie (klanten, activiteiten, vrijwilligers, werkgroepen, todo's, vakanties, ezelwandelingen, wandelroutes-beheer) |
| `admin` | Systeembeheerder | Alles van doenker + `/admin/rollen` (rollen van andere gebruikers aanpassen) en mag gearchiveerde klanten/vrijwilligers zien en vrijwilligers archiveren/activeren |

### Hoe krijgt iemand een rol?

1. Bij **registratie** (`/registreer`) wordt een gebruiker aangemaakt in Supabase Authentication, en bij de eerste keer dat die persoon ergens in de app terechtkomt (via `AuthBootstrap`, zie onder), wordt automatisch een rij aangemaakt in de tabel `vrijwilligers` (met `id = user_id = auth.uid()`).
2. Een databasetrigger (`trg_set_default_rol_vrijwilliger`, functie `set_default_rol_vrijwilliger()`) voegt bij het aanmaken van die `vrijwilligers`-rij automatisch de basisrol **`vrijwilliger`** toe in `vrijwiliger_roles`.
3. Een doenker/admin kan via `/admin/rollen` (enkel toegankelijk voor **admins**) de rol van iedereen wijzigen: dat scherm **verwijdert eerst alle bestaande basisrollen** van die persoon en **voegt daarna de gekozen rol opnieuw toe** — iedereen heeft dus precies één basisrol op elk moment.
4. Een vrijwilliger die **gearchiveerd** wordt (`vrijwilligers.actief = false`) verliest daardoor **alle** rollen uit het oog van de app: de helper-functie `getMyRoleCodes()` (`src/lib/auth.ts`) geeft dan gewoon een lege lijst terug, wat betekent dat die persoon nergens nog toegang heeft en bij een volgend paginabezoek automatisch wordt uitgelogd (zie `AppHeader`).

### Hoe wordt dit technisch gecontroleerd? (twee lagen)

1. **Applicatielaag** (in de browser/server-code): componenten zoals `AuthBootstrap`, `AdminLayout` en losse schermen roepen `isDoenkerOrAdmin()` / `isAdmin()` op (uit `src/lib/auth.ts`) en tonen "Je hebt geen rechten" of sturen door naar `/login` als dat niet in orde is.
2. **Databaselaag (RLS)**: Supabase/Postgres voert daarnaast **Row Level Security**-regels uit op élke databasequery, los van de applicatiecode. Zie hoofdstuk 6. Dit is de echte beveiliging; de applicatielaag is enkel voor een nette gebruikerservaring.

---

## 3. Functionaliteiten per module

### 3.1 Activiteiten
- **Voor vrijwilligers** (`/activiteiten`): lijst (gegroepeerd per maand) en kalenderweergave van toekomstige activiteiten. In- en uitschrijven met één klik (tabel `meedoen`). Een ingeschreven vrijwilliger kan een vrije-tekst **opmerking** toevoegen aan zijn inschrijving; als de activiteit een klant heeft met een ingesteld aanspreekpunt, krijgt dat aanspreekpunt automatisch een mail bij een nieuwe/aangepaste opmerking. Doenkers zien op elke activiteit de **volledige** lijst van ingeschrevenen (gewone vrijwilligers zien enkel de eerste 3 namen + "+X meer") en een knop "Details" naar het admin-bewerkscherm.
- **Voor doenkers/admins** (`/admin/activiteiten`, `/admin/toevoegen`, `/admin/activiteiten/[id]`): activiteiten aanmaken (ook **herhalende reeksen**, wekelijks/maandelijks, met een gedeelde `herhaling_reeks_id`), bewerken (met de keuze om enkel die ene activiteit of de hele reeks aan te passen), verwijderen (idem, enkel deze of de hele reeks), en een blok **"Wie doet mee"** om zelf vrijwilligers toe te voegen/te verwijderen. Een doenker kan ook een **mail** of **WhatsApp-bericht** sturen naar alle ingeschreven vrijwilligers van een activiteit, en ziet de opmerkingen van vrijwilligers per activiteit. De lijst toont zowel verleden als toekomst in één doorlopende tijdlijn, met een visuele "Vandaag"-scheidingslijn waar automatisch naar gescrold wordt bij het openen.
- Elke activiteit hoort bij precies één **klant** (verplicht) en heeft naast "aantal vrijwilligers nodig" ook "aantal deelnemers" (klanten/gasten) en "aantal externe begeleiders".

### 3.2 Ezelwandelingen
- **Voor vrijwilligers** (`/ezelwandelingen`): zelfde opzet als activiteiten (lijst/kalender, inschrijven/uitschrijven via `ezelwandeling_deelnemers`, opmerking per inschrijving — zonder automatische mail naar een aanspreekpunt, want ezelwandelingen hebben geen klant). Sinds kort een derde tabblad **Routes** (zie 3.3) en, als een wandeling een route gekoppeld kreeg, een link "Route: [titel]" die rechtstreeks naar het detail van die route springt.
- **Voor doenkers/admins** (`/admin/ezelwandelingen`): wandelingen aanmaken/bewerken/verwijderen (geen klant, geen reeksen, wel een optioneel gekoppelde **route**), mail en WhatsApp-bericht naar deelnemers (met telefoonnummers getoond voor eventueel kopiëren).

### 3.3 Wandelroutes (nieuw)
- Een route (tabel `wandelroutes` — zie opmerking in hoofdstuk 5) heeft een titel, korte omschrijving, een GPX-bestand (het eigenlijke traject), een foto, afstand/duur/moeilijkheidsgraad, "goed om te weten"- en seizoensinfo, een optionele link naar Mapy, en een zichtbaarheidsvlag.
- **Publieke pagina** `/wandelroutes` (géén account nodig): overzicht van enkel de *zichtbare* routes, met een detailscherm per route met een kaart (OpenStreetMap via **Leaflet**), een knop om de eigen locatie te volgen, een link om rechtstreeks te navigeren naar het startpunt, het GPX-bestand te downloaden, eventueel naar Mapy te gaan, en een afdrukvriendelijke weergave.
- Dezelfde routeweergave (component `RoutesSectie`) wordt herbruikt in het tabblad "Routes" op `/ezelwandelingen`.
- **Doenkers/admins** zien bovendien verborgen (niet-zichtbare) routes met een badge, en krijgen een knop om routes toe te voegen/te bewerken/te verwijderen (inclusief automatisch de afstand berekenen uit het geüploade GPX-bestand).

### 3.4 Werkgroepen + Prikbord
- **Voor vrijwilligers** (via `/profiel`): inschrijven/uitschrijven op werkgroepen. Bij in-/uitschrijven gaan er automatisch mails naar de vrijwilliger zelf én naar de trekker (coördinator) van de werkgroep. Een werkgroep kan een korte "opdracht"-tekst hebben en/of **uitgebreide informatie** als rijke tekst (met titels, opsommingen, afbeeldingen) die te lezen is via een apart scherm (`/activiteiten/werkgroepen/[id]`).
- **Voor doenkers/admins**: overzicht en beheer van werkgroepen (`/admin/werkgroepen`, `/admin/werkgroepen/beheer`), met een rijke-tekst-editor (Tiptap) voor de uitgebreide informatie, inclusief afbeeldingen uploaden. Op het detailscherm van een werkgroep (`/admin/werkgroepen/[id]`): deelnemerslijst, openstaande taken van die werkgroep, mail naar alle leden, en **prikborden** aanmaken.
- **Prikbord** = een Doodle-achtige planningstool: de doenker stelt een aantal datum/tijd-momenten voor, de leden van de werkgroep vullen hun beschikbaarheid in (ja/misschien/nee) via een **publieke link** `/prikbord/[id]` (geen account nodig — ook niet-leden met de link kunnen invullen). De doenker kan het prikbord sluiten en daarna een "definitief moment"-mail versturen naar alle leden.

### 3.5 Klanten
- Organisaties/personen waarvoor WaarAnders vrijwilligers inzet. Beheer onder `/admin/klanten`: aanmaken, bewerken, een **doelgroep** koppelen (maximaal één per klant), een **aanspreekpunt** (een vrijwilliger/doenker) instellen, vrije opmerkingen bijhouden, en archiveren/opnieuw activeren (enkel door **admin**). Gearchiveerde klanten zijn enkel zichtbaar voor admins; doenkers zien alleen actieve klanten.

### 3.6 Vrijwilligers (beheer)
- `/admin/vrijwilligers`: lijst van actieve vrijwilligers met zoekfunctie, en een detailscherm per persoon (`/admin/vrijwilligers/[id]`) waar telefoon en adres aangepast kunnen worden, en waar de werkgroepen en rol(len) van die persoon te zien zijn. Archiveren/activeren kan enkel door een **admin**.
- `/admin/rollen` (**enkel admin**): basisrol van elke actieve vrijwilliger instellen (vrijwilliger/doenker/admin). Er is een beveiliging tegen het per ongeluk verwijderen van de laatste admin.

### 3.7 Todo's
- **Voor elke vrijwilliger** (`/todos`, "Mijn TODO's"): eigen openstaande taken (waar `wie_vrijwilliger_id` naar hen verwijst), met mogelijkheid om een taak op "gedaan" te zetten. **[NAKIJKEN — zie hoofdstuk 6: het is niet zeker dat de huidige RLS-policies een gewone vrijwilliger toelaten om zijn eigen todo's te lezen.]**
- **Voor doenkers/admins** (`/admin/todos`): overzicht van alle taken, filterbaar per persoon, met prioriteit (laag/normaal/hoog) en status (gepland/bezig/gedaan); taken kunnen aan een werkgroep gekoppeld worden. Toevoegen (`/admin/todos/toevoegen`) en bewerken/verwijderen (`/admin/todos/[id]`) kan enkel een taak toewijzen aan iemand met de rol doenker of admin.

### 3.8 Vakanties
- `/admin/vakanties` (doenkers/admins): twee tabbladen — vakantieperiodes per doenker invoeren/verwijderen, en een maandkalender die per dag toont hoeveel doenkers *niet* op vakantie zijn (met een kleurcode en een lijst bij het aanklikken van een dag).

### 3.9 Profiel
- `/profiel`: eigen gegevens (voornaam, achternaam, telefoon, adres) invullen/aanpassen — verplicht de eerste keer na registratie vóór de rest van de app toegankelijk wordt — en lidmaatschap van werkgroepen beheren.

### 3.10 Authenticatie
- `/login`: eerst wordt gecontroleerd (via de databasefunctie `check_email_registered`) of het e-mailadres al bestaat; zo niet, wordt doorverwezen naar `/registreer`. Daarna gewoon e-mail + wachtwoord.
- `/registreer`: account aanmaken (met controle op een mogelijke naam-botsing met een bestaande vrijwilliger).
- `/wachtwoord-vergeten` + `/auth/reset`: wachtwoord-reset via e-mail-link.
- `/auth/callback`: technische pagina die de inlog-/registratielink afhandelt.

### 3.11 Mails
Zie apart hoofdstuk 7.

---

## 4. Routekaart

| URL | Bestand | Doel | Toegang |
|---|---|---|---|
| `/` | `src/app/page.tsx` | Server-side redirect op basis van sessie/profiel-status | iedereen (stuurt door) |
| `/login` | `src/app/login/page.tsx` | Inloggen (2-staps: e-mail → wachtwoord) | publiek |
| `/registreer` | `src/app/registreer/page.tsx` | Account aanmaken | publiek |
| `/wachtwoord-vergeten` | `src/app/wachtwoord-vergeten/page.tsx` | Reset-mail aanvragen | publiek |
| `/auth/reset` | `src/app/auth/reset/page.tsx` | Nieuw wachtwoord instellen | publiek (na geldige reset-link) |
| `/auth/callback` | `src/app/auth/callback/route.ts` | OAuth/magic-link/registratie-callback | publiek |
| `/wandelroutes` | `src/app/wandelroutes/page.tsx` | "Wandelen met de ezels" — publieke routes-pagina | publiek, geen account |
| `/prikbord/[id]` | `src/app/prikbord/[id]/page.tsx` | Beschikbaarheid invullen voor een prikbord | publiek (met de link) |
| `/testenv` | `src/app/testenv/page.tsx` | Technische testpagina (toont of env-vars aanwezig zijn) | publiek — **[zie hoofdstuk 10]** |
| `/activiteiten` | `src/app/(app)/activiteiten/page.tsx` | Activiteiten bekijken/inschrijven | vrijwilliger |
| `/activiteiten/werkgroepen/[id]` | `src/app/(app)/activiteiten/werkgroepen/[id]/page.tsx` | Uitgebreide werkgroep-info lezen | vrijwilliger |
| `/ezelwandelingen` | `src/app/(app)/ezelwandelingen/page.tsx` | Ezelwandelingen + routes-tabblad | vrijwilliger |
| `/profiel` | `src/app/(app)/profiel/page.tsx` | Eigen profiel + werkgroep-lidmaatschap | vrijwilliger |
| `/todos` | `src/app/todos/page.tsx` | Eigen takenlijst | ingelogde vrijwilliger |
| `/admin` | `src/app/admin/page.tsx` | Beheer-dashboard (tegels) | doenker/admin |
| `/admin/activiteiten` | `src/app/admin/activiteiten/page.tsx` | Activiteiten beheren | doenker/admin |
| `/admin/activiteiten/[id]` | `src/app/admin/activiteiten/[id]/page.tsx` | Activiteit bewerken | doenker/admin |
| `/admin/toevoegen` | `src/app/admin/toevoegen/page.tsx` | Activiteit toevoegen | doenker/admin |
| `/admin/ezelwandelingen` | `src/app/admin/ezelwandelingen/page.tsx` | Ezelwandelingen beheren | doenker/admin |
| `/admin/klanten` | `src/app/admin/klanten/page.tsx` | Klantenlijst + zoeken | doenker/admin |
| `/admin/klanten/nieuw` | `src/app/admin/klanten/nieuw/page.tsx` | Nieuwe klant | doenker/admin |
| `/admin/klanten/[id]` | `src/app/admin/klanten/[id]/page.tsx` | Klant bewerken/archiveren | doenker/admin (archiveren: admin) |
| `/admin/vrijwilligers` | `src/app/admin/vrijwilligers/page.tsx` | Vrijwilligerslijst | doenker/admin |
| `/admin/vrijwilligers/[id]` | `.../vrijwilligers/[id]/page.tsx` | Vrijwilliger bewerken/archiveren | doenker/admin (archiveren: admin) |
| `/admin/werkgroepen` | `src/app/admin/werkgroepen/page.tsx` | Overzicht werkgroepen | doenker/admin |
| `/admin/werkgroepen/[id]` | `.../werkgroepen/[id]/page.tsx` | Werkgroep-detail: leden, taken, mail, prikbord | doenker/admin |
| `/admin/werkgroepen/beheer` | `.../werkgroepen/beheer/page.tsx` | Werkgroepen aanmaken/verwijderen | doenker/admin |
| `/admin/werkgroepen/beheer/[id]` | `.../werkgroepen/beheer/[id]/page.tsx` | Werkgroep bewerken (incl. rijke tekst) | doenker/admin |
| `/admin/werkgroepen/prikbord/[id]` | `.../werkgroepen/prikbord/[id]/page.tsx` | Prikbord beheren | doenker/admin |
| `/admin/vakanties` | `src/app/admin/vakanties/page.tsx` | Vakantieplanning doenkers | doenker/admin |
| `/admin/todos` | `src/app/admin/todos/page.tsx` | Alle todo's beheren | doenker/admin |
| `/admin/todos/toevoegen` | `.../todos/toevoegen/page.tsx` | Todo toevoegen | doenker/admin |
| `/admin/todos/[id]` | `.../todos/[id]/page.tsx` | Todo bewerken/verwijderen | doenker/admin |
| `/admin/admins` | `src/app/admin/admins/page.tsx` | Redirect naar `/admin/rollen` | doenker/admin |
| `/admin/rollen` | `src/app/admin/rollen/page.tsx` | Rollen toekennen | **enkel admin** |

> De hele `/admin/*`-sectie wordt generiek beschermd door `src/app/admin/layout.tsx` (`AdminLayout`), die `isDoenkerOrAdmin()` controleert. `/admin/rollen` doet daar zelf nog een **extra**, strengere controle op specifiek de rol `admin`. De `(app)/*`-routes (activiteiten, ezelwandelingen, profiel) worden generiek beschermd door `AuthBootstrap` in `src/app/(app)/layout.tsx`. `/todos` valt buiten die `(app)`-groep en doet zijn eigen sessiecontrole binnen de pagina zelf — functioneel gelijkaardig, maar net een ander patroon. **[NAKIJKEN of dit bewust zo is]**

---

## 5. Datamodel

> **Belangrijk:** dit hoofdstuk is gebaseerd op `docs/db/schema.csv`, geëxporteerd uit Supabase **vóór** de "wandelroutes"-functionaliteit werd toegevoegd. De tabel `wandelroutes` en de kolom `ezelwandelingen.route_id` staan dus **niet** in die export — die zijn hieronder beschreven op basis van de opdracht die Mark zelf gaf (`CC_wandelroutes.md`), niet op basis van een verse schema-export. **[NAKIJKEN — exporteer `schema.csv` opnieuw voor een volgende volledige controle.]**

### Kerntabellen

| Tabel | Doel | Belangrijkste velden |
|---|---|---|
| `vrijwilligers` | Centrale tabel; elke rij is één vrijwilliger/doenker/admin. `id` is **bewust gelijk aan** `auth.uid()` (geen bug — zie opdracht). `user_id` bevat (historisch) dezelfde waarde. | `voornaam`, `achternaam`, `naam` (automatisch samengesteld via trigger), `telefoon`, `adres`, `actief`, `profiel_afgewerkt`, `toestemming_privacy` |
| `roles` | Opzoektabel met de 3 rolcodes. | `code` (`vrijwilliger`/`doenker`/`admin`), `titel` |
| `vrijwilliger_roles` | Koppeltabel vrijwilliger ↔ rol. | `vrijwilliger_id` → `vrijwilligers.id`, `rol_id` → `roles.id`, `toegekend_door` → `vrijwilligers.id` |
| `klanten` | Organisaties/personen waarvoor ingezet wordt. | `naam`, `contactpersoon_*`, `adres`, `opmerkingen`, `actief`, `gearchiveerd_op`, `aanspreekpunt_vrijwilliger_id` → `vrijwilligers.id`, `doelgroep_id` → `doelgroepen.id` |
| `klant_doelgroepen` | Koppelt **maximaal één** doelgroep aan een klant (unieke index op `klant_id`). | `klant_id`, `doelgroep_id` |
| `doelgroepen` | Opzoektabel doelgroepen. | `titel`, `omschrijving` |
| `activiteiten` | Geplande activiteiten. | `titel`, `toelichting`, `wanneer`, `startuur`/`einduur`, `aantal_vrijwilligers`, `aantal_deelnemers`, `aantal_externe_begeleiders`, `klant_id`, `status` (enum `activiteit_status`, in de praktijk altijd `gepland` gezien — **[NAKIJKEN]** welke andere waarden bestaan), `herhaling_*` (type/interval/einde/`herhaling_reeks_id`) |
| `meedoen` | Wie doet mee aan welke activiteit. | `activiteit_id`, `vrijwilliger_id`, `opmerking`, `aangemeld_op` |
| `meedoen_met_naam` | **View** (geen eigen RLS) die `meedoen` combineert met de naam van de vrijwilliger — gebruikt in de UI om niet telkens een aparte join te moeten schrijven. | `activiteit_id`, `vrijwilliger_id`, `naam` |
| `ezelwandelingen` | Geplande ezelwandelingen. | `titel`, `omschrijving`, `wanneer`, `startuur`/`einduur`, `status` (tekst, default `gepland`), en sinds kort `route_id` → `wandelroutes.id` (optioneel) **[NAKIJKEN — niet in de schema-export]** |
| `ezelwandeling_deelnemers` | Wie doet mee aan welke ezelwandeling. | `wandeling_id`, `vrijwilliger_id`, `opmerking`, `aangemeld_op` |
| `wandelroutes` **[NAKIJKEN]** | Wandelroutes met kaart/GPX, gebruikt op `/wandelroutes` en in het tabblad "Routes". Niet in de schema-export; kolommen hieronder volgens de opdracht van Mark. | `titel`, `korte_omschrijving`, `afstand_km`, `duur_minuten`, `moeilijkheid` (`makkelijk`/`gemiddeld`/`pittig`), `goed_om_te_weten`, `seizoensinfo`, `gpx_pad`, `foto_pad` (bestandspaden in de opslag-bucket `wandelroutes`), `mapy_link`, `zichtbaar`, `volgorde`, `aangemaakt_door` → `vrijwilligers.id` |
| `werkgroepen` | Thematische groepen vrijwilligers. | `titel`, `opdracht` (korte toelichting), `uitgebreide_info` (rijke HTML-tekst), `trekker`, `coordinator_id` → `vrijwilligers.id`, `meer_info_url` |
| `werkgroep_deelnemers` | Koppelt vrijwilligers aan werkgroepen. | `werkgroep_id`, `vrijwilliger_id`, `toegevoegd_op` |
| `todos` | Interne taken. | `wat`, `wie_vrijwilliger_id` → `vrijwilligers.id`, `streefdatum`, `prioriteit` (enum: laag/normaal/hoog), `status` (enum: gepland/bezig/gedaan), `werkgroep_id`, `thema_id`, `aangemaakt_door`/`bijgewerkt_door` |
| `vakantie_perioden` | Vakantieperiodes van doenkers. | `vrijwilliger_id`, `begin_datum`, `eind_datum` |
| `prikborden` | Een "Doodle"-achtige bevraging voor een werkgroep. | `titel`, `toelichting`, `werkgroep_id`, `gesloten`, `aangemaakt_door` |
| `prikbord_momenten` | Voorgestelde datum/tijd-opties binnen een prikbord. | `prikbord_id`, `datum`, `beginuur`/`einduur` |
| `prikbord_antwoorden` | Ingevulde beschikbaarheid per moment. | `moment_id`, `naam` (vrije tekst, geen koppeling naar `vrijwilligers` — wie het prikbord invult hoeft geen account te hebben), `beschikbaar` (ja/misschien/nee) |

### Tabellen die in de huidige code **niet** gebruikt worden (lijken legacy)

Deze tabellen bestaan in de databank, hebben soms zelfs RLS-policies, maar worden nergens in `src/` gelezen of geschreven — ze lijken overblijfsels van een vroegere opzet of een nooit-afgewerkt idee:

- `themas`, `vrijwilliger_themas`, `interesses`, `vrijwilliger_interesses`
- `admins` (de tabel — **niet** te verwarren met de rol `admin`; wordt wel gebruikt binnen enkele RLS-policies van `activiteiten`, maar nergens door de applicatiecode zelf gelezen of beschreven)
- `vrijwilligers_public` (**view**) en `vrijwilligers_public__bak` (gewone tabel, ziet eruit als een backup)

Zie ook hoofdstuk 10.

### Triggers (in mensentaal)

| Tabel | Wanneer | Doet |
|---|---|---|
| `activiteiten`, `ezelwandelingen`, `klanten`, `todos`, `vrijwilligers`, `werkgroepen` | vóór elke UPDATE | zet automatisch `bijgewerkt_op` op het huidige tijdstip (functie `tg_set_bijgewerkt_op`) |
| `vrijwilligers` | na INSERT | kent automatisch de basisrol `vrijwilliger` toe (functie `set_default_rol_vrijwilliger`) |
| `vrijwilligers` | vóór INSERT/UPDATE | stelt het veld `naam` automatisch samen uit `voornaam` + `achternaam` (functie `set_vrijwilliger_naam_from_parts`) |

### Functies (in mensentaal)

| Functie | Doet |
|---|---|
| `check_email_registered(email)` | Controleert of een e-mailadres al een account heeft — gebruikt op de loginpagina om meteen naar "Account aanmaken" te sturen als dat niet zo is. |
| `is_doenker(uid)`, `is_doenker_or_admin(uid)`, `is_admin(uid)` / `is_admin()`, `is_admin_uid(uid)`, `is_admin_role(uid)`, `is_doenker_role(uid)`, `has_role(uid, code)` | Verschillende varianten van "heeft deze gebruiker rol X?" — gebruikt in de RLS-policies (zie hoofdstuk 6). Dat er zoveel bijna-identieke varianten bestaan is zelf al een aandachtspunt, zie hoofdstuk 6. |
| `my_vrijwilliger_id()` | Geeft het eigen `vrijwilligers.id` van de ingelogde gebruiker terug — gebruikt in enkele policies van `ezelwandeling_deelnemers`. |
| `set_default_rol_vrijwilliger`, `set_vrijwilliger_naam_from_parts`, `tg_set_bijgewerkt_op` | Triggerfuncties, zie hierboven. |
| `handle_new_user()` | Staat niet gekoppeld aan een trigger binnen het `public`-schema in deze export — vermoedelijk een trigger op `auth.users` (buiten het bereik van de gebruikte schema-query). **[NAKIJKEN]** |
| `vrijwilligers_public_fn()` | Vermoedelijk de functie achter de (ongebruikte) `vrijwilligers_public`-view. **[NAKIJKEN]** |

---

## 6. Beveiliging (RLS)

**RLS** ("Row Level Security") is een beveiligingslaag van Postgres/Supabase zelf: voor élke databasequery — ook al zou de applicatiecode het toelaten — controleert de databank of er een policy ("regel") bestaat die deze actie toestaat. Zonder passende policy krijg je gewoon niets terug of een foutmelding, zelfs met correcte code.

Alle onderstaande tabellen hebben RLS **aan staan**: `activiteiten`, `admins`, `doelgroepen`, `ezelwandeling_deelnemers`, `ezelwandelingen`, `interesses`, `klant_doelgroepen`, `klanten`, `meedoen`, `prikbord_antwoorden`, `prikbord_momenten`, `prikborden`, `roles`, `themas`, `todos`, `vakantie_perioden`, `vrijwilliger_interesses`, `vrijwiliger_roles`, `vrijwilliger_themas`, `vrijwilligers`, `vrijwilligers_public__bak`, `werkgroep_deelnemers`, `werkgroepen`.
(De views `meedoen_met_naam` en `vrijwilligers_public` hebben geen eigen RLS — views volgen de rechten van wat erachter zit.)

### Per tabel, in mensentaal

- **`activiteiten`**: iedereen mag lezen (zelfs niet-ingelogd — `activiteiten_lezen` is "voor public"); doenkers mogen alles; er zijn *daarnaast nog* apart insert/update/delete-policies die controleren via de `admins`-tabel. Zie "Aandachtspunten".
- **`admins`**: enkel een admin mag andere rijen inzien/toevoegen/verwijderen (via de functie `is_admin()`), en niet zichzelf verwijderen.
- **`doelgroepen`**: iedereen die ingelogd is mag lezen; enkel doenker/admin mag schrijven.
- **`ezelwandelingen`**: iedereen mag lezen (ook niet-ingelogd); enkel doenker mag schrijven.
- **`ezelwandeling_deelnemers`**: ingelogde gebruikers mogen alles lezen; een vrijwilliger mag enkel zijn **eigen** inschrijving toevoegen/aanpassen/verwijderen (via `my_vrijwilliger_id()`); doenkers mogen alles.
- **`klanten`** en **`klant_doelgroepen`**: ingelogde gebruikers mogen lezen; enkel doenker/admin mag schrijven.
- **`meedoen`**: ingelogde gebruikers mogen alles lezen; een vrijwilliger mag enkel zijn eigen rij toevoegen/verwijderen; doenkers mogen alles (ook in naam van iemand anders in-/uitschrijven, zoals gebruikt in het blok "Wie doet mee").
- **`prikborden`, `prikbord_momenten`**: iedereen (ook niet-ingelogd) mag lezen; enkel wie volgens `vrijwilliger_roles` doenker/admin is mag schrijven.
- **`prikbord_antwoorden`**: iedereen mag lezen **én schrijven/aanpassen/verwijderen**, zonder enige beperking tot de eigen naam. Zie "Aandachtspunten" — dit is bewust zo ontworpen (geen account nodig om te antwoorden) maar wel vermeldenswaard.
- **`roles`**: elke ingelogde gebruiker mag lezen.
- **`todos`**: enkel doenker/admin mag lezen/toevoegen/aanpassen; admin mag daarnaast alles (ook verwijderen). Zie "Aandachtspunten" — er lijkt geen policy te zijn die een gewone vrijwilliger toelaat zijn **eigen** todo's te lezen.
- **`vakantie_perioden`**: ingelogde gebruikers mogen lezen; enkel doenker mag schrijven. (In de praktijk gaat het schrijven via een server-actie met de service-role-sleutel, die deze policy omzeilt — zie hoofdstuk 10.)
- **`vrijwilligers`**: zie "Aandachtspunten" — er is een brede policy die **elke ingelogde gebruiker alles laat lezen**, waardoor de striktere "enkel eigen rij"-policies in de praktijk weinig toevoegen. Schrijven: een vrijwilliger mag zijn eigen rij aanmaken/aanpassen; doenker mag elke rij aanpassen; admin mag alles.
- **`vrijwilliger_roles`**: zelfde patroon — een brede "iedereen mag lezen"-policy bestaat náást specifiekere varianten. Schrijven enkel door admin.
- **`werkgroepen`, `werkgroep_deelnemers`**: ingelogde gebruikers mogen lezen; een vrijwilliger mag zichzelf in-/uitschrijven; doenker mag alles.
- **`vrijwilliger_interesses`, `vrijwilliger_themas`, `themas`, `interesses`**: policies bestaan (grotendeels "eigen rij" of "iedereen leest"), maar worden niet gebruikt door de huidige applicatiecode — zie hoofdstuk 10.
- **`vrijwilligers_public__bak`**: enkel een leespolicy voor ingelogde gebruikers; verder ongebruikt.
- **`wandelroutes`** (volgens de opdracht, niet in de export): iedereen leest routes met `zichtbaar = true`; doenkers/admins lezen alles en mogen toevoegen/wijzigen/verwijderen. **[NAKIJKEN — niet zelf gecontroleerd in Supabase]**

### Aandachtspunten

1. **Dubbele/overlappende policies.** Op `activiteiten` bestaan **drie** afzonderlijke SELECT-policies die in de praktijk hetzelfde doen (`activiteiten_lezen`, `activiteiten_lezen_auth`, `activiteiten_select_auth`). Op `roles` bestaan **twee** identieke SELECT-policies (`roles readable` en `roles_lezen`). Op `klanten` bestaan twee ALL-policies die elkaar overlappen (`beheer_schrijven_klanten` en `klanten_schrijven`, allebei in essentie "doenker mag alles"). Functioneel geen probleem (Postgres combineert ze gewoon), maar het maakt de regels onnodig moeilijk te doorgronden en te onderhouden. Vermoedelijk ontstaan doordat bij opeenvolgende taken telkens een nieuwe policy werd toegevoegd in plaats van de bestaande te hergebruiken.
2. **Zeer brede leespolicy op `vrijwilligers` en `vrijwilliger_roles`.** De policy `auth read vrijwilligers` (SELECT, voor authenticated, `USING: true`) laat **elke ingelogde gebruiker, ook een gewone vrijwilliger, alle gegevens van alle andere vrijwilligers lezen** (naam, telefoon, adres, …). Dat maakt de striktere policies (`read own vrijwilliger`, `vrijwilligers_select_own`, `vrijwilligers_doenker_select_all`) in de praktijk overbodig voor lezen. Hetzelfde patroon zit in `vrijwiliger_roles` (`vrijwilliger_roles_lezen`, USING: true). **Dit is mogelijk een bewuste keuze** (een kleine vrijwilligersgroep die elkaars contactgegevens mag zien), maar het is het signaleren waard: zonder deze brede policy zou bv. telefoonnummer/adres van vrijwilligers enkel voor doenkers zichtbaar zijn.
3. **`prikbord_antwoorden` staat volledig open.** Zoals hierboven beschreven: wie dan ook kan élk antwoord van élke andere persoon in élk prikbord aanpassen of verwijderen (niet enkel het eigen antwoord), zonder in te loggen. Bewust zo gebouwd om zonder account te kunnen invullen, maar het risico (iemand verwijdert bewust of per ongeluk antwoorden van iemand anders) is er wel.
4. **`todos`: mogelijk ontbrekende "eigen rij"-leespolicy.** De pagina `/todos` ("Mijn TODO's") verwacht dat een gewone vrijwilliger zijn eigen taken kan opvragen (`.eq("wie_vrijwilliger_id", user.id)`), maar de policies die in de schema-export staan (`todo_admin_all`, `todo_doenker_insert`, `todo_doenker_select`, `todo_doenker_update`) lijken enkel doenker/admin toegang te geven. **[NAKIJKEN in Supabase]** — mogelijk ontbreekt hier een policy "eigen todo's lezen", of is dit in de praktijk nooit een probleem omdat de meeste actieve gebruikers toch doenker zijn.
5. **Veel bijna-identieke rolcontrole-functies.** `is_doenker`, `is_doenker_or_admin`, `is_admin` (met en zonder argument), `is_admin_uid`, `is_admin_role`, `is_doenker_role`, `has_role` — zeven functies die elk op een iets andere manier "heeft deze gebruiker rol X" beantwoorden, gebruikt verspreid over de policies. Werkt, maar maakt het moeilijker te controleren of ze allemaal exact consistent zijn.

---

## 7. Mails

Alle mails worden verstuurd via **Resend**, vanuit `"use server"`-serveracties die een Supabase-client met de **service-role-sleutel** gebruiken (die alle RLS omzeilt) om e-mailadressen op te zoeken via `auth.admin.listUsers()`. Afzender en reply-to zijn overal gelijk:

- **Van:** `Waaranders <noreply@waaranders.be>`
- **Reply-to:** `info@waaranders.be`

| Mail | Wanneer | Naar wie | Bestand |
|---|---|---|---|
| Opmerking bij activiteit | Vrijwilliger voegt/wijzigt een opmerking bij zijn inschrijving op een activiteit mét klant + aanspreekpunt | Het aanspreekpunt van de klant | `src/app/(app)/activiteiten/actions.ts` |
| Mail naar deelnemers (activiteit) | Doenker typt een bericht en verstuurt het | Alle ingeschreven vrijwilligers van die activiteit | `src/app/admin/activiteiten/actions.ts` |
| Welkom bij werkgroep | Vrijwilliger schrijft zich in op een werkgroep | De vrijwilliger zelf | `src/app/(app)/profiel/actions.ts` |
| Nieuwe inschrijving (werkgroep) | Idem | De trekker van de werkgroep | idem |
| Uitschrijving werkgroep | Vrijwilliger schrijft zich uit | De vrijwilliger zelf | idem |
| Uitschrijving gemeld aan trekker | Idem | De trekker van de werkgroep | idem |
| Mail naar werkgroep | Doenker typt een bericht en verstuurt het | Alle leden van de werkgroep | `src/app/admin/werkgroepen/[id]/actions.ts` |
| Prikbord-uitnodiging | Doenker maakt een nieuw prikbord aan | Alle leden van de werkgroep | idem (`maakPrikbordAan`) |
| Definitief moment | Doenker verstuurt na het sluiten van een prikbord | Alle leden van de werkgroep | `src/app/admin/werkgroepen/prikbord/[id]/actions.ts` |
| Mail naar deelnemers (ezelwandeling) | Doenker typt een bericht en verstuurt het | Alle ingeschreven deelnemers van die wandeling | `src/app/admin/ezelwandelingen/actions.ts` |

Enkele algemene regels: een mislukte individuele mail (bv. ongeldig adres) wordt gelogd met `console.error` maar blokkeert nooit de rest van het proces of de onderliggende databasewijziging. Bij de meeste van deze mails staat ook een link naar de live app onderaan (`https://waaranders-vrijwilligers.vercel.app`).

---

## 8. Techniek en omgeving

**Versies** (uit `package.json`):

| Onderdeel | Versie |
|---|---|
| Next.js | 16.1.6 (App Router, Turbopack) |
| React / React DOM | 19.2.3 |
| TypeScript | ^5 |
| Tailwind CSS | ^4 |
| @supabase/supabase-js | ^2.95.3 |
| @supabase/ssr | ^0.8.0 |
| Resend (mail) | ^6.9.3 |
| Tiptap (rijke tekst) | ^3.20.5 |
| sanitize-html | ^2.17.2 |
| leaflet (kaarten, nieuw) | laatste versie bij installatie, zie `package.json` |

**Hosting:** Vercel, automatische deploy bij elke `git push` naar `main` (zie hoofdstuk 9).

**Environment variables** (enkel de *namen*, geen waarden):

| Naam | Waar gebruikt | Zichtbaar in browser? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase-adres | Ja |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publieke Supabase-sleutel | Ja |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only, omzeilt RLS (mail-acties, admin-taken) | Nee |
| `RESEND_API_KEY` | Mails versturen | Nee |
| `NEXT_PUBLIC_SITE_URL` | Opbouwen van de prikbord-link in de uitnodigingsmail | Ja (optioneel, heeft een lege-string fallback) |
| `NEXT_PUBLIC_ENABLE_DEV_PASSWORD_LOGIN` | Staat in `.env.local`, maar wordt **nergens in de code gebruikt** — zie hoofdstuk 10 | — |

**Opmaakconventies:** vaste `wa-*`-utility-klassen in `src/app/globals.css`, zoals `wa-card` (witte kaart, `rounded-2xl`), `wa-btn` + een variant (`wa-btn-brand`/`wa-btn-ghost`/`wa-btn-danger`/`wa-btn-success`/`wa-btn-whatsapp`/`wa-btn-action`/`wa-btn-enroll`), `wa-alert-error`/`wa-alert-success`/`wa-alert-info`, `wa-brand` (blauw/sky-achtergrond met wit), `wa-page-header`, `wa-section-header`, `wa-prose` (opmaak voor rijke-tekst-inhoud), `wa-badge-herhaling`. Primaire kleur is `sky`-blauw, actieve/positieve acties zijn `lime`-groen; kaarten zijn steeds `rounded-2xl` met een lichte schaduw, nooit zware schaduwen.

---

## 9. Werkwijze

De vaste manier van werken aan deze app:

1. **Databasewijzigingen eerst**, handmatig via de **SQL Editor** in het Supabase-dashboard (geen migratiescript, geen ORM). Een nieuwe tabel krijgt **meteen** de nodige `GRANT`-statements én RLS-policies — niet achteraf.
2. **Codewijzigingen** daarna, via Claude Code (dit hulpmiddel), op basis van een instructiebestand of een rechtstreekse vraag.
3. **Commit per taak/onderdeel**, met een duidelijke, Nederlandstalige commitboodschap.
4. **Push naar `main`** → Vercel pikt dit automatisch op en bouwt een nieuwe versie (`next build`). Bij een build-fout blijft de vorige werkende versie live.
5. **Testen op de live site**, niet enkel lokaal — dat is in de praktijk de manier waarop hier steeds getest wordt (zie de instructiebestanden in de hoofdmap van de repo), al kan `npm run dev` lokaal ook gebruikt worden.

---

## 10. Bekende problemen en open punten

- **`/testenv`** (`src/app/testenv/page.tsx`) is een overgebleven testpagina zonder enige toegangscontrole, die toont of de omgevingsvariabelen aanwezig zijn (niet de waarden zelf, enkel of de Supabase-sleutel "aanwezig" is). Niet gevaarlijk, maar overbodig in productie.
- **`NEXT_PUBLIC_ENABLE_DEV_PASSWORD_LOGIN`** staat in `.env.local` maar wordt nergens in de broncode gebruikt — vermoedelijk een restant van een eerdere/andere inlogmethode.
- **Ongebruikte databasetabellen**: `themas`, `vrijwilliger_themas`, `interesses`, `vrijwilliger_interesses`, `admins` (als tabel), `vrijwilligers_public` (view) en `vrijwilligers_public__bak`. Geen van deze wordt door de huidige applicatiecode gelezen of geschreven. **[NAKIJKEN]** of ze ooit nog een rol spelen of opgeruimd mogen worden.
- **Ongebruikte component/server-actiebestanden**: `src/app/admin/klanten/_components/KlantForm.tsx` en de functies in `src/app/admin/klanten/actions.ts` (`createKlantAction`, `updateKlantAction`, `archiveKlantAction`) lijken dode code — de effectieve klantenschermen (`/admin/klanten/nieuw`, `/admin/klanten/[id]`) bouwen hun eigen formulier en praten rechtstreeks met de databank, zonder deze bestanden te gebruiken.
- **`src/app/globals-blauw.css`** bestaat in de repo, maar wordt nergens geïmporteerd — lijkt een ongebruikt alternatief kleurenthema.
- **Dubbele/overlappende RLS-policies en zeer brede leesrechten** — zie hoofdstuk 6, "Aandachtspunten", voor de volledige lijst (o.a. op `activiteiten`, `roles`, `vrijwilligers`, `vrijwilliger_roles`, `klanten`).
- **Mogelijk ontbrekende RLS-leespolicy voor `todos`** waardoor een gewone vrijwilliger zijn eigen taken misschien niet kan lezen via de databank. **[NAKIJKEN in Supabase]**
- **`prikbord_antwoorden` staat volledig open** voor lezen/schrijven/aanpassen/verwijderen door iedereen, zonder beperking tot het eigen antwoord — bewust zo gebouwd (geen account nodig), maar wel een aandachtspunt.
- **Server-acties met de service-role-sleutel controleren de rol van de aanroeper niet opnieuw server-side** (bv. `src/app/admin/vakanties/actions.ts`: `addVakantiePerio`/`deleteVakantiePerio`, en de verschillende mail-acties) — ze vertrouwen op de `isDoenkerOrAdmin()`-controle in het scherm zelf. Wie de onderliggende server-actie rechtstreeks zou aanroepen (buiten de normale interface om), zou dit in theorie kunnen omzeilen. **[NAKIJKEN]** hoe groot dit risico in de praktijk is.
- **`docs/db/schema.csv` is niet meer helemaal actueel**: de tabel `wandelroutes`, de kolom `ezelwandelingen.route_id` en de bijbehorende RLS-/opslagpolicies zijn er (nog) niet in verwerkt, omdat die functionaliteit na deze export werd toegevoegd. Voor een volgende volledige schema-controle: opnieuw exporteren.
- **Losse instructiebestanden in de hoofdmap** van de repo (`instructie-*.md`, `cc-*.md`, `cc_*.md`, `fix-todo-embedding-error.md`, `CC_wandelroutes.md`, `CC_documentatie_maken.md`, `instructie.txt`, …) zijn historische opdrachten aan Claude Code, geen actuele documentatie op zich — nuttig als geschiedenis, maar kunnen op termijn opgeruimd worden.
- **`/todos` volgt een ander beveiligingspatroon** dan de rest (eigen sessiecontrole in de pagina zelf, in plaats van via de gedeelde `(app)`-laag) — functioneel werkt het, maar het is inconsistent met de rest van de routestructuur.
- **Volledige set waarden van `activiteiten.status`** (enum `activiteit_status`) is niet met zekerheid gekend — in de code wordt enkel ooit `'gepland'` gebruikt. **[NAKIJKEN in Supabase]**

---

## 11. Snelle herstart-checklist

1. Open VS Code in de projectmap en start Claude Code (`claude`) in de geïntegreerde terminal.
2. Controleer of `.env.local` aanwezig is, met de 4(-5) nodige variabelen (zie hoofdstuk 8). Dit bestand staat bewust niet op GitHub.
3. `npm install` (bij een nieuwe/andere computer) en eventueel `npm run dev` om lokaal te testen op `http://localhost:3000`.
4. Controleer GitHub op nog openstaande wijzigingen/berichten, en Vercel of de laatste deployment geslaagd is (groen vinkje).
5. Bij een databasewijziging: **altijd eerst** de SQL Editor in Supabase, met meteen de nodige `GRANT`s en RLS-policies — pas daarna de code aanpassen.
6. Werk per taak: pas aan, commit met een duidelijke boodschap, test (bij voorkeur op de live Vercel-omgeving), en pas daarna naar de volgende taak.
7. Bij twijfel over rollen/rechten: zie hoofdstuk 2 en 6 van dit document.
