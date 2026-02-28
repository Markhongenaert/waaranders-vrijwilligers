"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function humanize(raw?: string) {
  const msg = (raw || "").toLowerCase();
  if (msg.includes("rate limit")) return "Te veel pogingen. Wacht even en probeer opnieuw.";
  return raw || "Onbekende fout.";
}

export default function WachtwoordVergetenPage() {
  const [email, setEmail] = useState("");

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

  const send = async () => {
    const e = guardEmail();
    if (!e) return;

    setBusy(true);
    try {
      const redirectTo = `${window.location.origin}/auth/reset`;
      const { error } = await supabase.auth.resetPasswordForEmail(e, { redirectTo });
      if (error) {
        setErr(humanize(error.message));
        return;
      }

      setMsg("Reset-mail verstuurd. Check je mailbox (en eventueel spam).");
    } catch (ex: any) {
      setErr(humanize(ex?.message ?? String(ex)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-md p-6">
      <div className="rounded-2xl p-5 mb-6 bg-blue-900 text-white shadow-sm">
        <div className="text-xl font-semibold">Wachtwoord vergeten</div>
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
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
          />
        </div>

        <button
          className="rounded-xl px-5 py-3 font-medium w-full bg-blue-900 text-white hover:bg-blue-800 transition disabled:opacity-60"
          disabled={busy}
          onClick={send}
        >
          {busy ? "Bezig…" : "Stuur reset-mail"}
        </button>

        <div className="text-sm text-gray-700">
          <a className="underline" href="/login">
            Terug naar login
          </a>
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