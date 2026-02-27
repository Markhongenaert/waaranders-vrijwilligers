"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

function humanize(raw?: string) {
  const msg = (raw || "").toLowerCase();
  if (msg.includes("weak_password")) return "Wachtwoord te zwak. Kies iets langer/sterker.";
  return raw || "Onbekende fout.";
}

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      // Als supabaseClient detectSessionInUrl gebruikt, komt session vaak vanzelf binnen.
      const { data } = await supabase.auth.getSession();
      setHasSession(!!data.session);
      setReady(true);
    })();
  }, []);

  const setNewPassword = async () => {
    setErr(null);
    setMsg(null);

    if (!pw1 || pw1.length < 8) return setErr("Kies minstens 8 tekens."), undefined;
    if (pw1 !== pw2) return setErr("De twee wachtwoorden zijn niet identiek."), undefined;

    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw1 });
      if (error) return setErr(humanize(error.message)), undefined;

      setMsg("Wachtwoord aangepast. Je kan nu inloggen.");
      setPw1("");
      setPw2("");
      // eventueel auto-redirect naar /login
      // window.location.href = "/login";
    } catch (ex: any) {
      setErr(humanize(ex?.message ?? String(ex)));
    } finally {
      setBusy(false);
    }
  };

  if (!ready) return <main className="mx-auto max-w-md p-6">Even laden…</main>;

  if (!hasSession) {
    return (
      <main className="mx-auto max-w-md p-6">
        <div className="border rounded-2xl p-5 bg-white shadow-sm space-y-3">
          <div className="text-lg font-semibold">Link ongeldig of verlopen</div>
          <p className="text-sm text-slate-600">
            Ga naar de loginpagina en kies “Wachtwoord vergeten”, of vraag Mark om opnieuw uit te nodigen.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <div className="border rounded-2xl p-5 bg-white shadow-sm space-y-4">
        <div className="text-lg font-semibold">Wachtwoord instellen</div>

        <div>
          <label className="block font-medium mb-1">Nieuw wachtwoord</label>
          <input
            className="w-full border rounded-xl p-3 bg-white"
            type="password"
            value={pw1}
            onChange={(e) => setPw1(e.target.value)}
            disabled={busy}
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Herhaal</label>
          <input
            className="w-full border rounded-xl p-3 bg-white"
            type="password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            disabled={busy}
          />
        </div>

        <button
          className="rounded-xl px-5 py-3 font-medium w-full bg-blue-900 text-white hover:bg-blue-800 transition disabled:opacity-60"
          onClick={setNewPassword}
          disabled={busy}
        >
          {busy ? "Bezig…" : "Bewaar wachtwoord"}
        </button>

        {msg && <p className="text-blue-800 bg-blue-50 border border-blue-100 rounded-xl p-3">{msg}</p>}
        {err && <p className="text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">Fout: {err}</p>}
      </div>
    </main>
  );
}