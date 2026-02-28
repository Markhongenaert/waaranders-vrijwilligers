"use client";

import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function humanize(raw?: string) {
  const msg = (raw || "").toLowerCase();
  if (msg.includes("invalid login credentials")) return "E-mail of wachtwoord klopt niet.";
  if (msg.includes("email not confirmed")) return "Je e-mailadres is nog niet bevestigd.";
  if (msg.includes("rate limit")) return "Te veel pogingen. Wacht even en probeer opnieuw.";
  return raw || "Onbekende fout.";
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // ✅ Geen useSearchParams → geen Suspense-probleem
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const blocked = qs.get("blocked");
    if (blocked === "1") {
      setErr("Je staat niet meer in de lijst vrijwilligers. Contacteer iemand van het kernteam.");
      setMsg(null);
    }
  }, []);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  const guardEmail = () => {
    setErr(null);
    setMsg(null);
    const e = normalizedEmail;
    if (!e) return setErr("Vul een e-mailadres in."), null;
    if (!isValidEmail(e)) return setErr("Dit e-mailadres lijkt niet correct."), null;
    return e;
  };

  const login = async () => {
    const e = guardEmail();
    if (!e) return;
    if (!password) return setErr("Vul je wachtwoord in."), undefined;

    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: e, password });
      if (error) {
        setErr(humanize(error.message));
        return;
      }

      // ✅ root beslist: /profiel (eerste keer) of /activiteiten
      window.location.href = "/";
    } catch (ex: any) {
      setErr(humanize(ex?.message ?? String(ex)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-md p-6">
      {/* Header: kleiner + lichtblauw + gecentreerd + zonder koppelteken */}
      <div className="rounded-2xl p-4 mb-5 bg-sky-100 text-slate-900 shadow-sm border border-sky-200 text-center">
        <div className="text-lg font-semibold leading-tight">Waaranders vrijwilligers</div>
      </div>

      <div className="border rounded-2xl p-5 bg-white shadow-sm space-y-4">
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
          <label className="block font-medium mb-1">Wachtwoord</label>
          <input
            className="w-full border rounded-xl p-3 bg-white"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
            disabled={busy}
            onKeyDown={(e) => {
              if (e.key === "Enter") login();
            }}
          />
        </div>

        <button
          className="rounded-xl px-5 py-3 font-medium w-full bg-blue-900 text-white hover:bg-blue-800 transition disabled:opacity-60"
          disabled={busy}
          onClick={login}
        >
          {busy ? "Bezig…" : "Inloggen"}
        </button>

        {/* Links: in lichtblauw kadertje, opvallender */}
        <div className="rounded-2xl bg-sky-50 border border-sky-200 p-4">
          <div className="text-sm font-semibold text-slate-900 text-center mb-3">
            Eerste keer of probleem met je wachtwoord?
          </div>

          <div className="grid grid-cols-1 gap-2">
            <a
              className="rounded-xl bg-white border border-sky-200 px-4 py-3 text-center font-medium hover:bg-sky-100 transition"
              href="/registreer"
            >
              Eerste keer account aanmaken
            </a>

            <a
              className="rounded-xl bg-white border border-sky-200 px-4 py-3 text-center font-medium hover:bg-sky-100 transition"
              href="/wachtwoord-vergeten"
            >
              Wachtwoord vergeten
            </a>
          </div>
        </div>

        {msg && (
          <p className="text-blue-800 bg-blue-50 border border-blue-100 rounded-xl p-3">
            {msg}
          </p>
        )}
        {err && (
          <p className="text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">
            {err}
          </p>
        )}
      </div>
    </main>
  );
}