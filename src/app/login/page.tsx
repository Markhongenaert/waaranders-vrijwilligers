"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const COOLDOWN_MS = 30_000;

function isValidEmail(e: string) {
  // Niet perfect, wel genoeg om obvious typos te vangen zonder streng te zijn.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Cooldown state
  const [cooldownUntil, setCooldownUntil] = useState<number>(0);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());

  // tick om countdown te renderen
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const cooldownLeftMs = Math.max(0, cooldownUntil - nowTick);
  const cooldownLeftSec = Math.ceil(cooldownLeftMs / 1000);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  const canSend = !busy && cooldownLeftMs === 0;

  const humanizeAuthError = (raw: string) => {
    const msg = (raw || "").toLowerCase();

    if (msg.includes("rate limit")) {
      return "We hebben net al veel login-links verstuurd. Wacht even (± 1–2 minuten) en probeer opnieuw.";
    }
    if (msg.includes("invalid email") || msg.includes("email is invalid")) {
      return "Dit e-mailadres lijkt niet juist. Controleer het even.";
    }
    if (msg.includes("redirect") || msg.includes("redirect_to")) {
      return "De login-link kan niet correct terugkeren naar de app (redirect-instelling). Meld dit even aan Mark.";
    }
    if (msg.includes("database error saving new user") || msg.includes("unexpected_failure")) {
      return "Er liep intern iets mis bij het aanmaken van je account. Probeer straks opnieuw, of verwittig Mark.";
    }
    return raw || "Onbekende fout.";
  };

  const startCooldown = () => {
    setCooldownUntil(Date.now() + COOLDOWN_MS);
  };

  const sendMagicLink = async () => {
    // Harde guards tegen dubbele calls
    if (busy) return;

    // Cooldown is globaal (niet per mail) omdat Supabase rate limiting niet per e-mail werkt
    if (cooldownLeftMs > 0) {
      setErr(`Even wachten: je kan opnieuw proberen over ${cooldownLeftSec}s.`);
      return;
    }

    setErr(null);
    setMessage(null);

    const e = normalizedEmail;
    if (!e) {
      setErr("Vul een e-mailadres in.");
      return;
    }
    if (!isValidEmail(e)) {
      setErr("Dit e-mailadres lijkt niet correct. Controleer het even.");
      return;
    }

    setBusy(true);
    startCooldown(); // ook bij mislukking: voorkomt spam-klikken en verergert rate-limits niet

    try {
      // Gebruik steeds dezelfde origin als de gebruiker momenteel gebruikt.
      // (Let op: als je straks een custom domain gebruikt, zorg dat die in Supabase Redirect URLs staat.)
      const redirectTo = `${window.location.origin}/auth/callback`;

      // Debug hint (mag je later verwijderen)
      // console.log("[auth] OTP request for", e, "redirect:", redirectTo);

      const { error } = await supabase.auth.signInWithOtp({
        email: e,
        options: { emailRedirectTo: redirectTo },
      });

      if (error) {
        setErr(humanizeAuthError(error.message));
        return;
      }

      setMessage(
        "Gelukt. Check je mailbox — en je spamfolder als hij zich verstopt 😉"
      );
    } catch (ex: any) {
      setErr(humanizeAuthError(ex?.message ?? String(ex)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-md p-4 sm:p-6 md:p-10">
      {/* Header */}
      <div className="rounded-2xl p-5 mb-6 bg-blue-900 text-white shadow-sm">
        <div className="text-xl font-semibold">Welkom terug</div>
        <div className="text-sm opacity-95 mt-1">
          Log in om activiteiten te bekijken en je in te schrijven.
        </div>
      </div>

      {/* Card */}
      <div className="border rounded-2xl p-5 bg-white shadow-sm space-y-4">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            sendMagicLink();
          }}
        >
          <div>
            <label className="block font-medium mb-1">Email</label>
            <input
              className="w-full border rounded-xl p-3 bg-white"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="naam@voorbeeld.be"
              autoComplete="email"
              inputMode="email"
              disabled={busy}
            />
          </div>

          <button
            type="submit"
            className="rounded-xl px-5 py-3 font-medium w-full bg-blue-900 text-white hover:bg-blue-800 transition disabled:opacity-60"
            disabled={!canSend}
          >
            {busy
              ? "Bezig…"
              : cooldownLeftMs > 0
              ? `Even wachten… (${cooldownLeftSec}s)`
              : "Stuur login-link"}
          </button>

          {cooldownLeftMs > 0 && (
            <p className="text-sm text-slate-600">
              Tip: klik niet opnieuw. Je krijgt dezelfde link niet sneller, wél sneller een rate-limit.
            </p>
          )}
        </form>

        {message && (
          <p className="text-blue-800 bg-blue-50 border border-blue-100 rounded-xl p-3">
            {message}
          </p>
        )}

        {err && (
          <p className="text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">
            Fout: {err}
          </p>
        )}

        <div className="text-xs text-slate-500">
          Geen mail ontvangen? Kijk even in spam/ongewenst. Hotmail/Outlook durft soms eigenwijs te zijn.
        </div>
      </div>
    </main>
  );
}