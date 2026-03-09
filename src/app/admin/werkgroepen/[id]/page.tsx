"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin } from "@/lib/auth";
import { formatDagMaand } from "@/lib/dateHelpers";
import Link from "next/link";
import { stuurMailNaarWerkgroep } from "./actions";

type Werkgroep = {
  id: string;
  titel: string;
  opdracht: string | null;
  trekker: string | null;
};

type Deelnemer = {
  id: string;
  voornaam: string | null;
  achternaam: string | null;
};

type OpenTaak = {
  id: string;
  wat: string;
  streefdatum: string | null;
  vrijwilligerNaam: string | null;
};

export default function WerkgroepDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [werkgroep, setWerkgroep] = useState<Werkgroep | null>(null);
  const [deelnemers, setDeelnemers] = useState<Deelnemer[]>([]);
  const [taken, setTaken] = useState<OpenTaak[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // Mail modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [mailBoodschap, setMailBoodschap] = useState("");
  const [mailBezig, setMailBezig] = useState(false);
  const [mailResultaat, setMailResultaat] = useState<string | null>(null);
  const [mailFout, setMailFout] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const ok = await isDoenkerOrAdmin();
      if (!mounted) return;
      setAllowed(ok);
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (allowed !== true || !id) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const { data: wg, error: wErr } = await supabase
          .from("werkgroepen")
          .select("id, titel, opdracht, trekker")
          .eq("id", id)
          .maybeSingle();
        if (wErr) throw wErr;
        if (!wg) throw new Error("Werkgroep niet gevonden.");

        const { data: dd, error: dErr } = await supabase
          .from("werkgroep_deelnemers")
          .select("vrijwilligers(id, voornaam, achternaam, actief)")
          .eq("werkgroep_id", id);
        if (dErr) throw dErr;

        const { data: tt, error: tErr } = await supabase
          .from("todos")
          .select("id, wat, streefdatum, wie_vrijwilliger_id")
          .eq("werkgroep_id", id)
          .neq("status", "gedaan");
        if (tErr) throw tErr;

        // Vrijwilligersnamen ophalen voor de unieke wie_vrijwilliger_id's
        type TodoRow = { id: string; wat: string; streefdatum: string | null; wie_vrijwilliger_id: string | null };
        type VrijwRow = { id: string; naam: string | null };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows = (tt ?? []) as any[];
        const vIds = [...new Set(rows.map((t: TodoRow) => t.wie_vrijwilliger_id).filter((x): x is string => !!x))];
        const namenById = new Map<string, string>();
        if (vIds.length > 0) {
          const { data: vv } = await supabase
            .from("vrijwilligers")
            .select("id, naam")
            .in("id", vIds);
          for (const v of (vv ?? []) as VrijwRow[]) namenById.set(v.id, v.naam ?? "");
        }

        if (!mounted) return;
        setWerkgroep(wg);
        setTaken(
          rows.map((t: TodoRow) => ({
            id: t.id,
            wat: t.wat,
            streefdatum: t.streefdatum ?? null,
            vrijwilligerNaam: namenById.get(t.wie_vrijwilliger_id ?? "") ?? null,
          }))
        );
        setDeelnemers(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ((dd ?? []) as any[])
            .map((row) => row.vrijwilligers as (Deelnemer & { actief: boolean }) | null)
            .filter((v): v is Deelnemer & { actief: boolean } => !!v && v.actief !== false)
            .sort((a, b) =>
              (a.achternaam ?? "").localeCompare(b.achternaam ?? "")
            )
        );
      } catch (e: unknown) {
        if (!mounted) return;
        setErr(e instanceof Error ? e.message : "Fout bij laden.");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [allowed, id]);

  function openModal() {
    setMailBoodschap("");
    setMailResultaat(null);
    setMailFout(null);
    setModalOpen(true);
  }

  async function verstuurMail() {
    if (!id || !mailBoodschap.trim()) return;
    setMailBezig(true);
    setMailFout(null);
    setMailResultaat(null);
    try {
      const result = await stuurMailNaarWerkgroep(id, mailBoodschap);
      if (result.error) {
        setMailFout(result.error);
      } else {
        setMailResultaat(`Mail verstuurd naar ${result.verstuurd} vrijwilliger${result.verstuurd !== 1 ? "s" : ""}.`);
      }
    } catch (e: unknown) {
      setMailFout(e instanceof Error ? e.message : "Fout bij versturen.");
    } finally {
      setMailBezig(false);
    }
  }

  if (allowed === null) return <main className="p-6">Laden…</main>;
  if (allowed === false) {
    return (
      <main className="p-6">
        <div className="wa-alert-error">Geen toegang.</div>
      </main>
    );
  }

  return (
    <main className="p-5 sm:p-6 space-y-4 max-w-2xl">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{werkgroep?.titel ?? "Werkgroep"}</h1>
        <Link href="/admin/werkgroepen" className="border rounded-xl px-4 py-2 text-sm">
          Terug
        </Link>
      </div>

      {err && <div className="wa-alert-error">{err}</div>}

      {loading ? (
        <div className="text-gray-600">Laden…</div>
      ) : (
        <>
          {werkgroep?.opdracht && (
            <div className="wa-card p-4 text-gray-700">{werkgroep.opdracht}</div>
          )}

          <div className="wa-card p-4 text-gray-700">
            {werkgroep?.trekker
              ? <><span className="font-bold">Trekker:</span> {werkgroep.trekker}</>
              : <span className="font-bold">Trekker nog te bepalen</span>
            }
          </div>

          <div className="wa-card p-4">
            <div className="font-semibold mb-3">
              Deelnemers ({deelnemers.length})
            </div>
            {deelnemers.length ? (
              <ul className="divide-y">
                {deelnemers.map((d) => (
                  <li key={d.id} className="py-2 text-sm text-gray-800">
                    {[d.voornaam, d.achternaam].filter(Boolean).join(" ") || "—"}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-600">Geen deelnemers.</p>
            )}
          </div>

          <div className="wa-card p-4">
            <div className="font-semibold mb-3">Openstaande taken</div>
            {taken.length ? (
              <ul className="space-y-2">
                {taken.map((t) => (
                  <li key={t.id} className="flex gap-2 text-sm text-gray-800">
                    <span className="mt-0.5 text-gray-400">•</span>
                    <span>
                      {t.wat}
                      {t.streefdatum && (
                        <span className="text-gray-500">
                          {" "}— {formatDagMaand(t.streefdatum)}
                        </span>
                      )}
                      {t.vrijwilligerNaam && (
                        <span className="text-gray-500"> ({t.vrijwilligerNaam})</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-600">Geen openstaande taken.</p>
            )}
          </div>

          <button
            onClick={openModal}
            className="w-full rounded-2xl bg-blue-50 border border-blue-200 p-5 text-left hover:bg-blue-100 transition"
          >
            <div className="font-semibold text-blue-900 mb-1">Verstuur mail naar de leden van deze werkgroep</div>
            <div className="text-sm text-blue-700">Klik hier om een bericht te sturen naar alle ingeschreven vrijwilligers.</div>
          </button>
        </>
      )}

      {/* Mail modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="wa-card w-full max-w-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold">Mail versturen naar deelnemers</h2>

            {mailResultaat ? (
              <>
                <div className="wa-alert-success">{mailResultaat}</div>
                <div className="flex justify-end">
                  <button onClick={() => setModalOpen(false)} className="wa-btn wa-btn-ghost">
                    Sluiten
                  </button>
                </div>
              </>
            ) : (
              <>
                {mailFout && <div className="wa-alert-error">{mailFout}</div>}

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Boodschap</label>
                  <textarea
                    value={mailBoodschap}
                    onChange={(e) => setMailBoodschap(e.target.value)}
                    rows={7}
                    className="w-full border rounded-lg px-3 py-2 text-sm resize-y"
                    disabled={mailBezig}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setModalOpen(false)}
                    className="wa-btn wa-btn-ghost"
                    disabled={mailBezig}
                  >
                    Annuleren
                  </button>
                  <button
                    onClick={verstuurMail}
                    className="wa-btn wa-btn-brand"
                    disabled={mailBezig || !mailBoodschap.trim()}
                  >
                    {mailBezig ? "Versturen…" : "Versturen"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
