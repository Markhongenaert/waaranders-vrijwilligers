"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

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
      {/* Header in blauw (consistent met rest van app) */}
      <div className="rounded-2xl p-5 mb-6 bg-blue-900 text-white shadow-sm">
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
          className="rounded-xl px-5 py-3 font-medium w-full bg-blue-900 text-white hover:bg-blue-800 transition disabled:opacity-60"
          onClick={sendMagicLink}
          disabled={busy}
        >
          {busy ? "Bezig…" : "Stuur login-link"}
        </button>

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
      </div>
    </main>
  );
}