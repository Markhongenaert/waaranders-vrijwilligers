"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

function getQueryParam(name: string) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

function parseHashParams() {
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;

  const params = new URLSearchParams(hash);
  return {
    access_token: params.get("access_token"),
    refresh_token: params.get("refresh_token"),
    error: params.get("error"),
    error_description: params.get("error_description"),
  };
}

export default function AuthCallbackPage() {
  const [msg, setMsg] = useState("Even geduld… We ronden je login af.");
  const [detail, setDetail] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        // 1) PKCE: ?code=...
        const code = getQueryParam("code");

        if (code) {
          setDetail("PKCE login gedetecteerd (code).");

          const { data, error } = await supabase.auth.exchangeCodeForSession(
            window.location.href
          );

          if (error) {
            setMsg("Login mislukt.");
            setDetail(error.message);
            return;
          }

          if (!data.session) {
            setMsg("Login gelukt, maar geen sessie gevonden.");
            setDetail("Geen session object teruggekregen.");
            return;
          }

          window.location.href = "/activiteiten";
          return;
        }

        // 2) Implicit: #access_token=...
        const hp = parseHashParams();

        if (hp.error) {
          setMsg("Login mislukt.");
          setDetail(`${hp.error}: ${hp.error_description ?? ""}`.trim());
          return;
        }

        if (hp.access_token && hp.refresh_token) {
          setDetail("Implicit login gedetecteerd (access_token).");

          const { error } = await supabase.auth.setSession({
            access_token: hp.access_token,
            refresh_token: hp.refresh_token,
          });

          if (error) {
            setMsg("Login mislukt.");
            setDetail(error.message);
            return;
          }

          window.location.href = "/activiteiten";
          return;
        }

        // 3) Niets gevonden → toon diagnose
        setMsg("Login-link is niet compleet of ongeldig.");
        setDetail(
          "Geen ?code=... en geen #access_token=... gevonden. Controleer Supabase Redirect URLs."
        );
      } catch (e: any) {
        setMsg("Onverwachte fout tijdens login.");
        setDetail(e?.message ?? String(e));
      }
    };

    run();
  }, []);

  return (
    <main className="mx-auto max-w-xl p-6 md:p-10">
      <div className="border rounded-2xl p-4 bg-white/80 shadow-sm">
        <div className="font-semibold">{msg}</div>
        {detail && <div className="text-sm text-gray-600 mt-2">{detail}</div>}
      </div>
    </main>
  );
}
