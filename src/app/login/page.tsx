"use client";

import { useMemo, useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    if (qs.get("blocked") === "1") {
      setErr("Je staat niet meer in de lijst vrijwilligers. Contacteer iemand van het kernteam.");
    }
  }, []);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  const handleLogin = async () => {
    setErr(null);
    setShowRegister(false);

    if (!normalizedEmail) return setErr("Vul een e-mailadres in.");
    if (!isValidEmail(normalizedEmail)) return setErr("Dit e-mailadres lijkt niet correct.");
    if (!password) return setErr("Vul je wachtwoord in.");

    setBusy(true);
    try {
      const { data: known, error: rpcErr } = await supabase.rpc("check_email_registered", {
        email_input: normalizedEmail,
      });

      if (rpcErr) {
        setErr("Technische fout, probeer opnieuw.");
        return;
      }

      if (!known) {
        setErr("Dit e-mailadres is nog niet gekend bij Waaranders.");
        setShowRegister(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (!error) {
        window.location.href = "/";
        return;
      }

      if (error.message.toLowerCase().includes("rate limit")) {
        setErr("Te veel pogingen. Wacht even en probeer opnieuw.");
      } else {
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
            onChange={(e) => {
              setEmail(e.target.value);
              setErr(null);
              setShowRegister(false);
            }}
            autoComplete="email"
            inputMode="email"
            disabled={busy}
            onKeyDown={(e) => { if (e.key === "Enter") handleLogin(); }}
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Wachtwoord</label>
          <div className="relative">
            <input
              className="w-full border rounded-xl p-3 pr-11 bg-white"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErr(null);
                setShowRegister(false);
              }}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              disabled={busy}
              onKeyDown={(e) => { if (e.key === "Enter") handleLogin(); }}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
              aria-label={showPassword ? "Verberg wachtwoord" : "Toon wachtwoord"}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>

        <button
          className="wa-btn wa-btn-brand px-5 py-3 w-full"
          disabled={busy}
          onClick={handleLogin}
        >
          {busy ? "Bezig…" : "Inloggen"}
        </button>

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
