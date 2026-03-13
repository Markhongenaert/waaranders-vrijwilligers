// src/app/registreer/page.tsx
"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function humanize(raw?: string) {
  const msg = (raw || "").toLowerCase();
  if (msg.includes("user already registered")) return "Dit e-mailadres bestaat al. Ga naar login.";
  if (msg.includes("password")) return "Wachtwoord is niet sterk genoeg.";
  if (msg.includes("email")) return "Controleer je e-mailadres.";
  if (msg.includes("rate limit")) return "Te veel pogingen. Wacht even en probeer opnieuw.";
  return raw || "Onbekende fout.";
}

export default function RegistreerPage() {
  const [voornaam, setVoornaam] = useState("");
  const [achternaam, setAchternaam] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [nameConflict, setNameConflict] = useState<string | null>(null);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const trimmedVoornaam = useMemo(() => voornaam.trim(), [voornaam]);
  const trimmedAchternaam = useMemo(() => achternaam.trim(), [achternaam]);

  const doRegister = async () => {
    setErr(null);
    setMsg(null);

    const e = normalizedEmail;
    if (!trimmedVoornaam) return setErr("Vul je voornaam in."), undefined;
    if (!trimmedAchternaam) return setErr("Vul je achternaam in."), undefined;
    if (!e) return setErr("Vul een e-mailadres in."), undefined;
    if (!isValidEmail(e)) return setErr("Dit e-mailadres lijkt niet correct."), undefined;
    if (!password) return setErr("Kies een wachtwoord."), undefined;
    if (password.length < 8) return setErr("Kies minstens 8 tekens."), undefined;
    if (password !== password2) return setErr("Wachtwoorden komen niet overeen."), undefined;

    setBusy(true);
    try {
      const { data: matches, error: queryErr } = await supabase
        .from("vrijwilligers")
        .select("id")
        .ilike("voornaam", trimmedVoornaam)
        .ilike("achternaam", trimmedAchternaam)
        .limit(1);

      if (queryErr) {
        setErr("Technische fout, probeer opnieuw.");
        return;
      }

      if (matches && matches.length > 0) {
        setNameConflict(`${trimmedVoornaam} ${trimmedAchternaam}`);
        return;
      }

      await submitRegistration(e);
    } catch (ex: any) {
      setErr(humanize(ex?.message ?? String(ex)));
    } finally {
      setBusy(false);
    }
  };

  const submitRegistration = async (e: string) => {
    const emailRedirectTo = `${window.location.origin}/auth/callback`;

    const { error } = await supabase.auth.signUp({
      email: e,
      password,
      options: { emailRedirectTo },
    });

    if (error) {
      setErr(humanize(error.message));
      return;
    }

    setMsg(
      "Gelukt. Check je mailbox en klik op de bevestigingslink. Daarna kom je automatisch in je profiel terecht."
    );
  };

  const handleSubmit = async () => {
    setNameConflict(null);
    await doRegister();
  };

  return (
    <main className="mx-auto max-w-md p-6">
      <div className="rounded-2xl p-4 mb-5 bg-sky-100 text-slate-900 shadow-sm border border-sky-200 text-center">
        <div className="text-lg font-semibold leading-tight">Waaranders vrijwilligers</div>
        <div className="text-sm text-slate-700 mt-0.5">Account aanmaken</div>
      </div>

      <div className="border rounded-2xl p-5 bg-white shadow-sm space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-medium mb-1">Voornaam</label>
            <input
              className="w-full border rounded-xl p-3 bg-white"
              value={voornaam}
              onChange={(e) => { setVoornaam(e.target.value); setErr(null); setNameConflict(null); }}
              autoComplete="given-name"
              disabled={busy}
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Achternaam</label>
            <input
              className="w-full border rounded-xl p-3 bg-white"
              value={achternaam}
              onChange={(e) => { setAchternaam(e.target.value); setErr(null); setNameConflict(null); }}
              autoComplete="family-name"
              disabled={busy}
            />
          </div>
        </div>

        <div>
          <label className="block font-medium mb-1">E-mail</label>
          <input
            className="w-full border rounded-xl p-3 bg-white"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
            disabled={busy}
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Kies wachtwoord</label>
          <input
            className="w-full border rounded-xl p-3 bg-white"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="new-password"
            disabled={busy}
          />
          <p className="text-xs text-gray-600 mt-1">Minstens 8 tekens.</p>
        </div>

        <div>
          <label className="block font-medium mb-1">Herhaal wachtwoord</label>
          <input
            className="w-full border rounded-xl p-3 bg-white"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            type="password"
            autoComplete="new-password"
            disabled={busy}
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          />
        </div>

        <button
          className="wa-btn wa-btn-brand px-5 py-3 w-full"
          disabled={busy}
          onClick={handleSubmit}
        >
          {busy ? "Bezig…" : "Account aanmaken"}
        </button>

        <div className="rounded-2xl bg-sky-50 border border-sky-200 p-4">
          <div className="text-sm font-semibold text-slate-900 text-center mb-3">
            Heb je al een account?
          </div>
          <a
            className="block rounded-xl bg-white border border-sky-200 px-4 py-3 text-center font-medium hover:bg-sky-100 transition"
            href="/login"
          >
            Ga naar login
          </a>
        </div>

        {nameConflict && (
          <div className="wa-alert-error">
            Er bestaat al een account met de naam <strong>{nameConflict}</strong> in Waaranders. Neem contact op met Mark om je mailadres te laten aanpassen (
            <a
              className="underline"
              href="mailto:markhongenaert.x@gmail.com"
            >
              markhongenaert.x@gmail.com
            </a>
            ).
          </div>
        )}

        {msg && <p className="wa-alert-info">{msg}</p>}
        {err && <p className="wa-alert-error">{err}</p>}
      </div>
    </main>
  );
}
