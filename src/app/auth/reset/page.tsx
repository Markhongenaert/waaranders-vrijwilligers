"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

function humanize(raw?: string) {
  const msg = (raw || "").toLowerCase();
  if (msg.includes("password")) return "Wachtwoord is niet sterk genoeg.";
  return raw || "Onbekende fout.";
}

export default function ResetPage() {
  const [ready, setReady] = useState(false);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    // Supabase zet de sessie via de recovery link;
    // we checken gewoon of er een user is
    (async () => {
      const { data } = await supabase.auth.getUser();
      setReady(true);
      if (!data.user) setErr("Reset-link ongeldig of verlopen. Vraag opnieuw een reset aan.");
    })();
  }, []);

  const save = async () => {
    setErr(null);
    setMsg(null);

    if (pw1.length < 8) return setErr("Kies minstens 8 tekens."), undefined;
    if (pw1 !== pw2) return setErr("Wachtwoorden komen niet overeen."), undefined;

    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw1 });
      if (error) {
        setErr(humanize(error.message));
        return;
      }
      setMsg("Wachtwoord aangepast. Je wordt doorgestuurd…");
      window.location.href = "/";
    } catch (ex: any) {
      setErr(humanize(ex?.message ?? String(ex)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-md p-6">
      <div className="rounded-2xl p-5 mb-6 bg-blue-900 text-white shadow-sm">
        <div className="text-xl font-semibold">Nieuw wachtwoord</div>
      </div>

      <div className="border rounded-2xl p-5 bg-white shadow-sm space-y-4">
        {!ready ? (
          <p>Laden…</p>
        ) : (
          <>
            <div>
              <label className="block font-medium mb-1">Nieuw wachtwoord</label>
              <input className="w-full border rounded-xl p-3" type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} />
            </div>
            <div>
              <label className="block font-medium mb-1">Herhaal</label>
              <input className="w-full border rounded-xl p-3" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
            </div>
            <button className="rounded-xl px-5 py-3 font-medium w-full bg-blue-900 text-white disabled:opacity-60" disabled={busy} onClick={save}>
              {busy ? "Bezig…" : "Opslaan"}
            </button>
          </>
        )}

        {msg && <p className="text-blue-800 bg-blue-50 border border-blue-100 rounded-xl p-3">{msg}</p>}
        {err && <p className="text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">{err}</p>}
      </div>
    </main>
  );
}