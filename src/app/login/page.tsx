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
    <div className="space-y-4">
      <div>
        <label className="block font-medium mb-1">Email</label>
        <input
          className="w-full border rounded-xl p-3 bg-white"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="test.vrijwilliger@waaranders.local"
          autoComplete="email"
        />
      </div>

      <div>
        <label className="block font-medium mb-1">Wachtwoord</label>
        <input
          className="w-full border rounded-xl p-3 bg-white"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
        />
      </div>

      <button
        className="w-full rounded-xl px-5 py-3 font-medium bg-emerald-700 text-white hover:bg-emerald-800 transition disabled:opacity-60"
        onClick={signIn}
        disabled={busy}
      >
        {busy ? "Bezig…" : "Inloggen (dev)"}
      </button>

      {err && <p className="text-red-700">Fout: {err}</p>}
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
      options: { emailRedirectTo: redirectTo },
    });

    setBusy(false);

    if (error) {
      setErr(error.message);
      return;
    }

    setMessage("Gelukt. Check je mailbox — en je spamfolder als hij zich verstopt 😉");
  };

  return (
    <main className="mx-auto max-w-md p-4 sm:p-6 md:p-10">
      {/* Warmere header */}
      <div className="rounded-2xl p-5 mb-6 bg-emerald-700 text-white shadow-sm">
        <div className="text-xl font-semibold">Welkom terug</div>
        <div className="text-sm opacity-95 mt-1">
          Log in om activiteiten te bekijken en je in te schrijven.
        </div>
      </div>

      {/* Hoofdkaart – wit */}
      <div className="border rounded-2xl p-5 bg-white shadow-sm space-y-4">
        <div>
          <label className="block font-medium mb-1">Email</label>
          <input
            className="w-full border rounded-xl p-3 bg-white"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="naam@voorbeeld.be"
            autoComplete="email"
            inputMode="email"
          />
        </div>

        <button
          className="rounded-xl px-5 py-3 font-medium w-full bg-emerald-700 text-white hover:bg-emerald-800 transition disabled:opacity-60"
          onClick={sendMagicLink}
          disabled={busy}
        >
          {busy ? "Bezig…" : "Stuur login-link"}
        </button>

        {message && (
          <p className="text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-xl p-3">
            {message}
          </p>
        )}
        {err && (
          <p className="text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">
            Fout: {err}
          </p>
        )}
      </div>

      {isDevPasswordEnabled() && (
        <div className="mt-10 border rounded-2xl p-5 bg-white shadow-sm">
          <div className="rounded-xl px-4 py-2 mb-4 bg-amber-100 text-amber-900 font-semibold">
            Dev login (alleen lokaal)
          </div>

          <p className="text-sm text-gray-700 mb-4">
            Voor testen. Zet{" "}
            <span className="font-mono">NEXT_PUBLIC_ENABLE_DEV_PASSWORD_LOGIN</span>{" "}
            uit in productie.
          </p>

          <DevPasswordLogin />
        </div>
      )}
    </main>
  );
}