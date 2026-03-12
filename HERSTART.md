# Herstart-gids: WaarAnders Vrijwilligersapp

Een praktische gids om snel weer aan de slag te gaan na een pauze.

---

## 1. Welke applicaties heb je nodig?

| Applicatie | Waarvoor | Waar vind je het? |
|---|---|---|
| **VS Code** | Code bewerken | Startmenu → "Visual Studio Code" |
| **Claude Code** | AI-assistent voor code | Werkt via de terminal in VS Code |
| **GitHub** | Versiebeheer van de code | github.com → jouw repository |
| **Supabase** | Database en authenticatie | supabase.com → jouw project |
| **Vercel** | Live zetten van de app | vercel.com → jouw project |
| **Resend** | E-mails versturen | resend.com → jouw account |

**Tip:** Maak van al deze websites een bladwijzer in je browser. Je hebt ze regelmatig nodig.

---

## 2. Claude Code opstarten

Open VS Code, ga naar de **geïntegreerde terminal** (menu: Terminal → Nieuwe terminal), en voer dit commando in:

```
cd C:\Users\Acer\Projecten\waaranders-vrijwilligers
claude
```

Claude Code start dan op in de juiste projectmap. Je ziet een prompt waar je in gewone taal kunt typen wat je wilt doen.

**Alternatief:** Klik in VS Code op "Bestand → Map openen" en selecteer de map `waaranders-vrijwilligers`. Open daarna de terminal en typ `claude`.

---

## 3. Meest gebruikte commando's in Claude Code

Eenmaal Claude Code is opgestart, typ je gewoon wat je wilt — in het Nederlands of Engels. Maar er zijn ook een aantal handige slash-commando's:

| Commando | Wat het doet |
|---|---|
| `/help` | Toont een overzicht van alle beschikbare commando's |
| `/clear` | Wist het gesprek en begint opnieuw (handige reset) |
| `/compact` | Vat het gesprek samen om ruimte te maken (bij lange sessies) |
| `/cost` | Toont hoeveel de huidige sessie heeft gekost |
| `/exit` of `Ctrl+C` | Sluit Claude Code af |

**Hoe geef je opdrachten?** Gewoon in woorden, bijvoorbeeld:
- *"Maak een nieuw formulier aan voor het toevoegen van vrijwilligers"*
- *"Er is een fout op de loginpagina, kun je die bekijken?"*
- *"Zet de wijzigingen klaar voor GitHub"*

---

## 4. Een wijziging doorvoeren en live zetten

Dit zijn de stappen van idee tot werkende app:

### Stap 1 — Vertel Claude wat je wilt
Beschrijf in de Claude Code-terminal wat er moet veranderen. Claude past de bestanden aan.

### Stap 2 — Controleer de wijziging lokaal (optioneel)
Open een tweede terminal en typ:
```
npm run dev
```
Ga dan naar `http://localhost:3000` in je browser om te controleren of alles werkt.

### Stap 3 — Sla de wijziging op in GitHub
Zeg tegen Claude: *"Maak een commit aan en push naar GitHub"* — of doe het zelf:
```
git add .
git commit -m "Korte beschrijving van de wijziging"
git push
```

### Stap 4 — Vercel zet de app automatisch live
Zodra de code op GitHub staat, pikt **Vercel** dit automatisch op en bouwt een nieuwe versie van de app. Dit duurt meestal 1–2 minuten.

### Stap 5 — Controleer of de deployment gelukt is
Ga naar [vercel.com](https://vercel.com) → jouw project → tabblad "Deployments". Je ziet of de build geslaagd is (groen vinkje) of mislukt (rode X).

---

## 5. Waar staan de belangrijkste instellingen?

### Lokale omgevingsvariabelen (op jouw computer)
Het bestand `.env.local` in de projectmap bevat de geheime sleutels:

```
C:\Users\Acer\Projecten\waaranders-vrijwilligers\.env.local
```

Dit bestand bevat:
- `NEXT_PUBLIC_SUPABASE_URL` — het adres van jouw Supabase-database
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — de publieke sleutel voor Supabase
- `RESEND_API_KEY` — de sleutel voor het versturen van e-mails via Resend

**Let op:** Dit bestand staat niet op GitHub (dat is bewust zo). Als je op een nieuwe computer werkt, moet je dit bestand opnieuw aanmaken.

### Omgevingsvariabelen op Vercel (voor de live app)
Ga naar: vercel.com → jouw project → **Settings → Environment Variables**

Hier staan dezelfde sleutels als in `.env.local`, maar dan voor de live omgeving. Als je een nieuwe sleutel toevoegt aan `.env.local`, moet je die ook hier toevoegen.

### API-sleutels opzoeken
- **Supabase-sleutels:** supabase.com → jouw project → Settings → API
- **Resend API-sleutel:** resend.com → API Keys

---

## 6. Wat te doen als iets niet werkt?

### De app is onbereikbaar of geeft een fout
1. Ga naar **Vercel** → jouw project → Deployments → klik op de laatste deployment → bekijk de **Build Logs** voor foutmeldingen.
2. Kijk ook bij **Functions** → **Logs** voor fouten die pas tijdens gebruik optreden.

### Inloggen werkt niet
1. Controleer of de **Supabase URL en sleutels** correct staan in Vercel (zie punt 5).
2. Ga naar **Supabase** → jouw project → **Authentication → Users** om te zien of de gebruiker bestaat.
3. Controleer **Supabase → Logs → Auth** voor foutmeldingen rondom inloggen.

### Data wordt niet opgeslagen of geladen
Dit is vaak een **RLS-probleem** (Row Level Security — de beveiligingsregels van de database).
1. Ga naar **Supabase** → jouw project → **Table Editor** en controleer of de rij er staat.
2. Ga naar **Authentication → Policies** om te zien welke regels er gelden voor de betreffende tabel.
3. Ga naar **Logs → Postgres** voor databasefouten.

### E-mails komen niet aan
1. Ga naar **Resend** → **Emails** om te zien of de e-mails verstuurd zijn.
2. Controleer of `RESEND_API_KEY` correct staat in Vercel.
3. Controleer of het afzenderadres (`noreply@waaranders.be`) nog geautoriseerd is bij Resend → **Domains**.

### Lokale development werkt niet (`npm run dev` geeft een fout)
1. Controleer of `.env.local` aanwezig is in de projectmap.
2. Probeer `npm install` om ontbrekende paketten te installeren.
3. Herstart de terminal en probeer opnieuw.

---

## 7. Belangrijkste URL's

> Vervang `[jouw-project]` door de werkelijke naam van jouw project.

| Omgeving | URL |
|---|---|
| **Live app** | `https://[jouw-project].vercel.app` (of een eigen domein indien ingesteld) |
| **Lokale versie** | `http://localhost:3000` (alleen als `npm run dev` actief is) |
| **GitHub repository** | `https://github.com/[jouw-account]/waaranders-vrijwilligers` |
| **Supabase dashboard** | `https://supabase.com/dashboard/project/[project-id]` |
| **Vercel dashboard** | `https://vercel.com/[jouw-account]/waaranders-vrijwilligers` |
| **Resend dashboard** | `https://resend.com` |

---

## Snelle checklist bij opstarten na een pauze

- [ ] VS Code openen met de juiste map
- [ ] Claude Code starten (`claude` in de terminal)
- [ ] Controleer of er nieuwe berichten zijn op GitHub (Pull Requests, Issues)
- [ ] Controleer Vercel of de laatste deployment nog actief en groen is
- [ ] Check Supabase → Logs als er klachten zijn over de app

---

*Dit document is bedoeld als geheugensteuntje. Bij twijfel: vraag het aan Claude Code.*
