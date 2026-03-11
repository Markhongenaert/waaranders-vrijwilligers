"use client";

import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showRegister, setShowRegister] = useState(false);

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    if (qs.get("blocked") === "1") {
      setErr("Je staat niet meer in de lijst vrijwilligers. Contacteer iemand van het kernteam.");
    }
  }, []);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  const login = async () => {
    setErr(null);
    setMsg(null);
    setShowRegister(false);

    if (!normalizedEmail) return setErr("Vul een e-mailadres in.");
    if (!isValidEmail(normalizedEmail)) return setErr("Dit e-mailadres lijkt niet correct.");
    if (!password) return setErr("Vul je wachtwoord in.");

    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (!error) {
        window.location.href = "/";
        return;
      }

      // Rate limit is altijd een harde fout
      if (error.message.toLowerCase().includes("rate limit")) {
        setErr("Te veel pogingen. Wacht even en probeer opnieuw.");
        return;
      }

      // Login mislukt — controleer via RPC of het e-mailadres gekend is.
      // Vereiste SQL (SECURITY DEFINER zodat auth.users leesbaar is):
      //   CREATE OR REPLACE FUNCTION check_email_registered(email_input text)
      //   RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
      //     SELECT EXISTS (SELECT 1 FROM auth.users WHERE email = lower(trim(email_input)));
      //   $$;
      const { data: known, error: rpcErr } = await supabase.rpc("check_email_registered", {
        email_input: normalizedEmail,
      });

      if (rpcErr) {
        setErr("Technische fout, probeer opnieuw.");
      } else if (!known) {
        // known is false of null → e-mailadres niet gevonden
        setErr("Dit e-mailadres is nog niet gekend bij Waaranders.");
        setShowRegister(true);
      } else {
        // known is true → e-mailadres bestaat, maar wachtwoord fout
        setErr("Ongeldig wachtwoord. Probeer opnieuw of klik op 'Wachtwoord vergeten'.");
      }
    } catch (ex: any) {
      setErr(ex?.message ?? "Onbekende fout.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-md p-6">
      <div className="wa-info-box p-4 mb-5 shadow-sm text-center">
        <div className="text-lg font-semibold leading-tight">Waaranders vrijwilligers</div>
      </div>

      <div className="border rounded-2xl p-5 bg-white shadow-sm space-y-4">
        <div>
          <label className="block font-medium mb-1">E-mail</label>
          <input
            className="w-full border rounded-xl p-3 bg-white"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setShowRegister(false); setErr(null); }}
            autoComplete="email"
            inputMode="email"
            disabled={busy}
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Wachtwoord</label>
          <input
            className="w-full border rounded-xl p-3 bg-white"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
            disabled={busy}
            onKeyDown={(e) => { if (e.key === "Enter") login(); }}
          />
        </div>

        <button
          className="wa-btn wa-btn-brand px-5 py-3 w-full"
          disabled={busy}
          onClick={login}
        >
          {busy ? "Bezig…" : "Inloggen"}
        </button>

        {msg && <p className="wa-alert-info">{msg}</p>}

        {err && (
          <div className="space-y-3">
            <p className="wa-alert-error">{err}</p>
            {showRegister && (
              <a
                className="wa-btn wa-btn-action px-4 py-3 text-center w-full block"
                href="/registreer"
              >
                Account aanmaken
              </a>
            )}
          </div>
        )}
      </div>

      {/* Wachtwoord vergeten: apart, onderaan, klein */}
      <div className="mt-4 text-center">
        <a
          className="wa-btn wa-btn-ghost px-4 py-2 text-sm"
          href="/wachtwoord-vergeten"
        >
          Wachtwoord vergeten?
        </a>
      </div>
    </main>
  );
}
