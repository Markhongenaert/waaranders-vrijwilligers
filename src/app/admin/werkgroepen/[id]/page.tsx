"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin } from "@/lib/auth";
import { formatDagMaand } from "@/lib/dateHelpers";
import Link from "next/link";
import { stuurMailNaarWerkgroep, maakPrikbordAan, type MomentInput } from "./actions";

const UREN = ["", "06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00"];

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

type Prikbord = {
  id: string;
  titel: string;
  gesloten: boolean;
  aangemaakt_op: string;
};

export default function WerkgroepDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [werkgroep, setWerkgroep] = useState<Werkgroep | null>(null);
  const [deelnemers, setDeelnemers] = useState<Deelnemer[]>([]);
  const [taken, setTaken] = useState<OpenTaak[]>([]);
  const [prikborden, setPrikborden] = useState<Prikbord[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // Mail modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [mailBoodschap, setMailBoodschap] = useState("");
  const [mailBezig, setMailBezig] = useState(false);
  const [mailResultaat, setMailResultaat] = useState<string | null>(null);
  const [mailFout, setMailFout] = useState<string | null>(null);

  // Prikbord aanmaken modal state
  const [pbModalOpen, setPbModalOpen] = useState(false);
  const [pbTitel, setPbTitel] = useState("");
  const [pbMomenten, setPbMomenten] = useState<MomentInput[]>([{ datum: "", beginuur: null, einduur: null }]);
  const [pbBezig, setPbBezig] = useState(false);
  const [pbFout, setPbFout] = useState<string | null>(null);
  const [pbResultaat, setPbResultaat] = useState<string | null>(null);
  const [pbTijdFouten, setPbTijdFouten] = useState<Record<number, string | null>>({});

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

        const { data: pb, error: pbErr } = await supabase
          .from("prikborden")
          .select("id, titel, gesloten, aangemaakt_op")
          .eq("werkgroep_id", id)
          .order("aangemaakt_op", { ascending: false });
        if (pbErr) throw pbErr;

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
        setPrikborden(pb ?? []);
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

  // --- Mail modal ---
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

  // --- Prikbord aanmaken modal ---
  function openPbModal() {
    setPbTitel("");
    setPbMomenten([{ datum: "", beginuur: null, einduur: null }]);
    setPbFout(null);
    setPbResultaat(null);
    setPbTijdFouten({});
    setPbModalOpen(true);
  }

  function updateMoment(index: number, veld: keyof MomentInput, waarde: string) {
    setPbMomenten((prev) =>
      prev.map((m, i) => i === index ? { ...m, [veld]: waarde || null } : m)
    );
    setPbTijdFouten((prev) => ({ ...prev, [index]: null }));
  }

  function valideerTijdslot(index: number, beginuur: string | null, einduur: string | null): boolean {
    if (beginuur && einduur && einduur <= beginuur) {
      setPbTijdFouten((prev) => ({ ...prev, [index]: "Einduur moet later zijn dan beginuur." }));
      return false;
    }
    setPbTijdFouten((prev) => ({ ...prev, [index]: null }));
    return true;
  }

  function voegMomentToe() {
    setPbMomenten((prev) => [...prev, { datum: "", beginuur: null, einduur: null }]);
  }

  function verwijderMoment(index: number) {
    setPbMomenten((prev) => prev.filter((_, i) => i !== index));
  }

  async function aanmakenEnVersturen() {
    if (!id || !pbTitel.trim()) return;
    const geldigeMomenten = pbMomenten.filter((m) => !!m.datum);
    if (geldigeMomenten.length === 0) {
      setPbFout("Voeg minstens één moment met een datum toe.");
      return;
    }
    setPbBezig(true);
    setPbFout(null);
    try {
      const result = await maakPrikbordAan(id, pbTitel.trim(), geldigeMomenten);
      if (result.error) {
        setPbFout(result.error);
      } else {
        setPbResultaat(`Prikbord aangemaakt en mail verstuurd naar ${result.verstuurd} vrijwilliger${result.verstuurd !== 1 ? "s" : ""}.`);
        // Prikborden lijst verversen
        const { data: pb } = await supabase
          .from("prikborden")
          .select("id, titel, gesloten, aangemaakt_op")
          .eq("werkgroep_id", id)
          .order("aangemaakt_op", { ascending: false });
        setPrikborden(pb ?? []);
      }
    } catch (e: unknown) {
      setPbFout(e instanceof Error ? e.message : "Fout bij aanmaken.");
    } finally {
      setPbBezig(false);
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

          {/* Prikborden overzicht */}
          <div className="wa-card p-4">
            <div className="font-semibold mb-3">Prikborden</div>
            {prikborden.length ? (
              <ul className="divide-y">
                {prikborden.map((pb) => (
                  <li key={pb.id} className="py-2 flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium text-gray-800">{pb.titel}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(pb.aangemaakt_op).toLocaleDateString("nl-BE")}
                        {" · "}
                        <span className={pb.gesloten ? "text-red-600" : "text-green-600"}>
                          {pb.gesloten ? "Gesloten" : "Open"}
                        </span>
                      </div>
                    </div>
                    <Link
                      href={`/admin/werkgroepen/prikbord/${pb.id}`}
                      className="text-xs border rounded-lg px-3 py-1 text-gray-600 hover:bg-gray-50"
                    >
                      Beheer
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-600">Nog geen prikborden.</p>
            )}
          </div>

          {/* Actieknoppen */}
          <button
            onClick={openModal}
            className="wa-action-card"
          >
            <div className="font-semibold text-blue-900 mb-1">Verstuur mail naar de leden van deze werkgroep</div>
            <div className="text-sm text-blue-700">Klik hier om een bericht te sturen naar alle ingeschreven vrijwilligers.</div>
          </button>

          <button
            onClick={openPbModal}
            className="wa-action-card"
          >
            <div className="font-semibold text-blue-900 mb-1">Nieuw prikbord aanmaken</div>
            <div className="text-sm text-blue-700">Klik hier om een Doodle-achtig prikbord aan te maken en de leden uit te nodigen.</div>
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
                  <p className="text-xs text-blue-900 mt-1">
                    Geef enkel de tekst zelf. Gepersonaliseerde begroeting en afsluiting van de mail worden automatisch aangemaakt.
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setModalOpen(false)} className="wa-btn wa-btn-ghost" disabled={mailBezig}>
                    Annuleren
                  </button>
                  <button onClick={verstuurMail} className="wa-btn wa-btn-brand" disabled={mailBezig || !mailBoodschap.trim()}>
                    {mailBezig ? "Versturen…" : "Versturen"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Prikbord aanmaken modal */}
      {pbModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="wa-card w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold">Nieuw prikbord aanmaken</h2>

            {pbResultaat ? (
              <>
                <div className="wa-alert-success">{pbResultaat}</div>
                <div className="flex justify-end">
                  <button onClick={() => setPbModalOpen(false)} className="wa-btn wa-btn-ghost">
                    Sluiten
                  </button>
                </div>
              </>
            ) : (
              <>
                {pbFout && <div className="wa-alert-error">{pbFout}</div>}

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Titel</label>
                  <input
                    type="text"
                    value={pbTitel}
                    onChange={(e) => setPbTitel(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder="bv. Planningsmoment mei"
                    disabled={pbBezig}
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium text-gray-700">Momenten</div>
                  {pbMomenten.map((m, i) => (
                    <div key={i} className="border rounded-lg p-3 space-y-2 bg-gray-50">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-16 shrink-0">Datum*</span>
                        <input
                          type="date"
                          value={m.datum ?? ""}
                          onChange={(e) => updateMoment(i, "datum", e.target.value)}
                          className="flex-1 border rounded px-3 py-2 text-sm"
                          disabled={pbBezig}
                        />
                        {pbMomenten.length > 1 && (
                          <button
                            onClick={() => verwijderMoment(i)}
                            className="text-xs text-red-500 hover:text-red-700"
                            disabled={pbBezig}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-16 shrink-0">Beginuur</span>
                        <select
                          value={m.beginuur ?? ""}
                          onChange={(e) => {
                            updateMoment(i, "beginuur", e.target.value);
                            valideerTijdslot(i, e.target.value || null, m.einduur);
                          }}
                          className="flex-1 border rounded px-3 py-2 text-sm"
                          disabled={pbBezig}
                        >
                          {UREN.map((u) => (
                            <option key={u} value={u}>{u || "—"}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-16 shrink-0">Einduur</span>
                        <select
                          value={m.einduur ?? ""}
                          onChange={(e) => {
                            updateMoment(i, "einduur", e.target.value);
                            valideerTijdslot(i, m.beginuur, e.target.value || null);
                          }}
                          className="flex-1 border rounded px-3 py-2 text-sm"
                          disabled={pbBezig}
                        >
                          {UREN.map((u) => (
                            <option key={u} value={u}>{u || "—"}</option>
                          ))}
                        </select>
                      </div>
                      {pbTijdFouten[i] && (
                        <p className="text-xs text-red-600">{pbTijdFouten[i]}</p>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={voegMomentToe}
                    className="wa-btn wa-btn-brand w-full"
                    disabled={pbBezig}
                  >
                    + Nog een moment toevoegen
                  </button>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button onClick={() => setPbModalOpen(false)} className="wa-btn wa-btn-ghost" disabled={pbBezig}>
                    Annuleren
                  </button>
                  <button
                    onClick={aanmakenEnVersturen}
                    className="wa-btn wa-btn-brand"
                    disabled={pbBezig || !pbTitel.trim() || Object.values(pbTijdFouten).some(Boolean)}
                  >
                    {pbBezig ? "Aanmaken…" : "Prikbord aanmaken en mail versturen"}
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
