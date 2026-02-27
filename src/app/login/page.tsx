"use client";

import { useMemo, useState } from "react";
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
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

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
      if (error) return setErr(humanize(error.message)), undefined;
      setMsg("Ingelogd.");
      // je app kan nu vanzelf naar /activiteiten gaan via guard of nav
    } catch (ex: any) {
      setErr(humanize(ex?.message ?? String(ex)));
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    const e = guardEmail();
    if (!e) return;

    setBusy(true);
    try {
      // Belangrijk: redirectTo moet naar jouw reset route
      const redirectTo = `${window.location.origin}/auth/reset`;
      const { error } = await supabase.auth.resetPasswordForEmail(e, { redirectTo });
      if (error) return setErr(humanize(error.message)), undefined;
      setMsg("Reset-mail verstuurd. Check je mailbox (en eventueel spam).");
      setMode("login");
    } catch (ex: any) {
      setErr(humanize(ex?.message ?? String(ex)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-md p-6">
      <div className="rounded-2xl p-5 mb-6 bg-blue-900 text-white shadow-sm">
        <div className="text-xl font-semibold">Waaranders — vrijwilligers</div>
        <div className="text-sm opacity-95 mt-1">
          Je krijgt een uitnodiging van Mark. Daarna kan je hier inloggen.
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <button
          className={`rounded-xl py-2 text-sm font-medium border ${mode === "login" ? "bg-white" : "bg-slate-50"}`}
          onClick={() => { setMsg(null); setErr(null); setMode("login"); }}
          disabled={busy}
        >
          Login
        </button>
        <button
          className={`rounded-xl py-2 text-sm font-medium border ${mode === "forgot" ? "bg-white" : "bg-slate-50"}`}
          onClick={() => { setMsg(null); setErr(null); setMode("forgot"); }}
          disabled={busy}
        >
          Wachtwoord vergeten
        </button>
      </div>

      <div className="border rounded-2xl p-5 bg-white shadow-sm space-y-4">
        <div>
          <label className="block font-medium mb-1">Email</label>
          <input
            className="w-full border rounded-xl p-3 bg-white"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
            disabled={busy}
          />
        </div>

        {mode === "login" && (
          <div>
            <label className="block font-medium mb-1">Wachtwoord</label>
            <input
              className="w-full border rounded-xl p-3 bg-white"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              disabled={busy}
            />
          </div>
        )}

        <button
          className="rounded-xl px-5 py-3 font-medium w-full bg-blue-900 text-white hover:bg-blue-800 transition disabled:opacity-60"
          disabled={busy}
          onClick={mode === "login" ? login : forgot}
        >
          {busy ? "Bezig…" : mode === "login" ? "Inloggen" : "Stuur reset-mail"}
        </button>

        {msg && <p className="text-blue-800 bg-blue-50 border border-blue-100 rounded-xl p-3">{msg}</p>}
        {err && <p className="text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">Fout: {err}</p>}
      </div>
    </main>
  );
}