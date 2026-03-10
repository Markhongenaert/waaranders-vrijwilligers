# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server (localhost:3000)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

No test runner is configured.

## Environment Variables

Two env vars are required (in `.env.local`):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Architecture

**Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Supabase

This is a Dutch volunteer management app for the WaarAnders organization. The UI language is Dutch (nl-BE locale).

### Route Structure

- `src/app/(app)/` — Protected volunteer area (activiteiten, profiel). Wrapped in `AuthBootstrap` which redirects unauthenticated users to `/login`.
- `src/app/admin/` — Admin/Doenker area (klanten, vrijwilligers, todos, rollen, activiteiten). Protected by `AdminLayout` which checks for `doenker` or `admin` role.
- `src/app/login/`, `/registreer/`, `/wachtwoord-vergeten/`, `/auth/reset/` — Public auth pages.
- `src/app/auth/callback/route.ts` — OAuth/magic-link callback that exchanges code for session.
- `src/app/page.tsx` — Server Component root redirect: checks session → vrijwilliger record → actief flag → profiel_afgewerkt → routes to `/activiteiten`.

### Supabase Clients

Two separate clients for different rendering contexts:

- `src/lib/supabaseClient.ts` — **Browser client** (`createBrowserClient`). Use in `"use client"` components.
- `src/lib/supabase/server.ts` — **Server client** (`createServerClient` + `async cookies()`). Use in Server Components and `"use server"` actions.

The middleware (`src/middleware.ts`) runs on every non-static request to refresh session cookies.

### Auth & Role System

Three role codes: `vrijwilliger`, `doenker`, `admin`.

Roles live in: `vrijwilliger_roles` (join table) → `roles` (code lookup). Volunteers in `vrijwilligers` table have `actief` and `profiel_afgewerkt` flags.

Helper functions in `src/lib/auth.ts`:
- `getMyRoleCodes()` — returns role codes for the current user (returns `[]` if `actief=false`)
- `hasRole(role)`, `isAdmin()`, `isDoenkerOrAdmin()`

These use the **browser client** and are called from Client Components only.

### Key Components

- `AuthBootstrap` (`src/components/AuthBootstrap.tsx`) — Client component that gates protected routes. On mount: checks session, upserts a `vrijwilligers` row (provisioning), redirects to `/login` if not authenticated. Wrap layouts with `<AuthBootstrap requireAuth>`.
- `AppHeader` (`src/components/AppHeader.tsx`) — Sticky nav bar. Checks `actief` status and signs out inactive volunteers. Shows the "Doenkers" link conditionally based on role.
- `DoenkerGuard` (`src/components/DoenkerGuard.tsx`) — Client guard component that redirects non-doenker/admin users.

### CSS Conventions

Custom `wa-*` utility classes are defined in `src/app/globals.css`:

| Class | Purpose |
|---|---|
| `wa-card` | White card with border/shadow |
| `wa-btn` + `wa-btn-brand` / `wa-btn-ghost` | Button styles |
| `wa-alert-error` / `wa-alert-success` / `wa-alert-info` | Alert/feedback boxes |
| `wa-brand` | Blue-900 background with white text |

Use these classes instead of ad-hoc Tailwind for consistent styling.

### Server Actions Pattern

Admin mutations use `"use server"` actions in `actions.ts` files co-located with the page. They import `supabaseServer()`, perform the DB operation, call `revalidatePath()`, then `redirect()`. See `src/app/admin/klanten/actions.ts` as the reference pattern.

### Database Tables (key ones)

- `vrijwilligers` — volunteers; `id = auth.user.id`; fields: `actief`, `profiel_afgewerkt`, `user_id`
- `vrijwilliger_roles` — join table linking volunteers to roles
- `roles` — lookup table with `code` field (`vrijwilliger` | `doenker` | `admin`)
- `klanten` — clients/organizations; fields: `actief`, `gearchiveerd_op`
- `klant_doelgroepen` — max-1 doelgroep per klant (enforced by unique index on `klant_id`)
