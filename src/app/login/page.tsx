"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

function isDevPasswordEnabled() {
  return process.env.NEXT_PUBLIC_ENABLE_DEV_PASSWORD_LOGIN === "true";
}

function DevPasswordLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const signIn = async () => {
    setErr(null);
    setBusy(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setBusy(false);

    if (error) {
      setErr(error.message);
      return;
    }

    window.location.href = "/activiteiten";
  };

  return (
    <div>
      <label className="block font-medium mb-2">Email</label>
      <input
        className="w-full border rounded-xl p-3 mb-4"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="test.vrijwilliger@waaranders.local"
        autoComplete="email"
      />

      <label className="block font-medium mb-2">Wachtwoord</label>
      <input
        className="w-full border rounded-xl p-3 mb-4"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="••••••••"
        autoComplete="current-password"
      />

      <button
        className="border rounded-xl px-5 py-3 font-medium"
        onClick={signIn}
        disabled={busy}
      >
        {busy ? "Bezig…" : "Inloggen (dev)"}
      </button>

      {err && <p className="mt-3 text-red-600">Fout: {err}</p>}
    </div>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const sendMagicLink = async () => {
    setErr(null);
    setMessage(null);

    const e = email.trim();
    if (!e) {
      setErr("Vul een emailadres in.");
      return;
    }

    setBusy(true);

    const redirectTo = `${window.location.origin}/auth/callback`;

    const { error } = await supabase.auth.signInWithOtp({
      email: e,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    setBusy(false);

    if (error) {
      setErr(error.message);
      return;
    }

    setMessage("Check je mailbox voor de login-link.");
  };

  return (
    <main className="mx-auto max-w-md p-6 md:p-10">
      <div className="bg-blue-900 text-white font-bold px-4 py-2 rounded-xl mb-6">
        Inloggen
      </div>

      <label className="block font-medium mb-2">Email</label>
      <input
        className="w-full border rounded-xl p-3 mb-4"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="naam@voorbeeld.be"
        autoComplete="email"
        inputMode="email"
      />

      <button
        className="border rounded-xl px-5 py-3 font-medium w-full"
        onClick={sendMagicLink}
        disabled={busy}
      >
        {busy ? "Bezig…" : "Stuur login-link"}
      </button>

      {message && <p className="mt-4 text-green-700">{message}</p>}
      {err && <p className="mt-4 text-red-600">Fout: {err}</p>}

      {isDevPasswordEnabled() && (
        <div className="mt-10 border rounded-2xl p-4 bg-white/80 shadow-sm">
          <div className="bg-blue-900 text-white font-bold px-4 py-2 rounded-xl mb-4">
            Dev login (password)
          </div>

          <p className="text-sm text-gray-600 mb-4">
            Alleen voor lokaal testen. Zet{" "}
            <span className="font-mono">NEXT_PUBLIC_ENABLE_DEV_PASSWORD_LOGIN</span>{" "}
            uit in productie.
          </p>

          <DevPasswordLogin />
        </div>
      )}
    </main>
  );
}
