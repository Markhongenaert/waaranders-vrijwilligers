"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { isDoenkerOrAdmin } from "@/lib/auth";
import { stuurMailNaarDeelnemers } from "./actions";

type Ezelwandeling = {
  id: string;
  titel: string;
  wanneer: string;
  startuur: string | null;
  einduur: string | null;
  omschrijving: string | null;
};

type Deelnemer = {
  ezelwandeling_id: string;
  vrijwilliger_id: string;
  opmerking: string | null;
};

type VrijwilligerInfo = {
  naam: string;
  telefoon: string | null;
};

const WEEKDAY_FMT = new Intl.DateTimeFormat("nl-BE", { weekday: "long" });
const DAY_MONTH_FMT = new Intl.DateTimeFormat("nl-BE", { day: "numeric", month: "short" });
const MONTH_HEADER_FMT = new Intl.DateTimeFormat("nl-BE", { month: "long", year: "numeric" });

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function asLocalDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`);
}

function formatDatum(dateStr: string) {
  const d = asLocalDate(dateStr);
  return `${capitalize(WEEKDAY_FMT.format(d))} ${DAY_MONTH_FMT.format(d)}`;
}

function formatMaand(dateStr: string) {
  return capitalize(MONTH_HEADER_FMT.format(asLocalDate(dateStr)));
}

function monthKey(dateStr: string) {
  return dateStr.slice(0, 7);
}

function todayISODate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function hhmm(t: string | null): string {
  if (!t) return "";
  return t.length >= 5 ? t.slice(0, 5) : t;
}

export default function AdminEzelwandelingenPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const [items, setItems] = useState<Ezelwandeling[]>([]);
  const [deelnemers, setDeelnemers] = useState<Deelnemer[]>([]);
  const [vrijwilligerInfo, setVrijwilligerInfo] = useState<Map<string, VrijwilligerInfo>>(new Map());

  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Formulier modal (toevoegen / bewerken)
  type FormModal = { mode: "nieuw" | "bewerken"; wandelingId?: string };
  const [formModal, setFormModal] = useState<FormModal | null>(null);
  const [formTitel, setFormTitel] = useState("");
  const [formOmschrijving, setFormOmschrijving] = useState("");
  const [formWanneer, setFormWanneer] = useState("");
  const [formStartuur, setFormStartuur] = useState("");
  const [formEinduur, setFormEinduur] = useState("");
  const [formBezig, setFormBezig] = useState(false);
  const [formFout, setFormFout] = useState<string | null>(null);

  // Mail modal
  type MailModal = { wandelingId: string; titel: string };
  const [mailModal, setMailModal] = useState<MailModal | null>(null);
  const [mailBoodschap, setMailBoodschap] = useState("");
  const [mailBezig, setMailBezig] = useState(false);
  const [mailResultaat, setMailResultaat] = useState<string | null>(null);
  const [mailFout, setMailFout] = useState<string | null>(null);

  // WhatsApp modal
  type WaModal = { wandelingId: string; titel: string };
  const [waModal, setWaModal] = useState<WaModal | null>(null);
  const [waTekst, setWaTekst] = useState("");

  const grouped = useMemo(() => {
    const sorted = [...items].sort((a, b) =>
      a.wanneer < b.wanneer ? -1 : a.wanneer > b.wanneer ? 1 : 0
    );
    const groups: { key: string; title: string; items: Ezelwandeling[] }[] = [];
    const idx = new Map<string, number>();
    for (const w of sorted) {
      const key = monthKey(w.wanneer);
      const pos = idx.get(key);
      if (pos === undefined) {
        idx.set(key, groups.length);
        groups.push({ key, title: formatMaand(w.wanneer), items: [w] });
      } else {
        groups[pos].items.push(w);
      }
    }
    return groups;
  }, [items]);

  const deelnemersByWandeling = useMemo(() => {
    const map = new Map<string, Deelnemer[]>();
    for (const d of deelnemers) {
      const lijst = map.get(d.ezelwandeling_id) ?? [];
      lijst.push(d);
      map.set(d.ezelwandeling_id, lijst);
    }
    return map;
  }, [deelnemers]);

  const load = async () => {
    setLoading(true);
    setError(null);
    setMsg(null);

    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) { window.location.href = "/login"; return; }

    const ok = await isDoenkerOrAdmin();
    setAllowed(ok);
    if (!ok) { setLoading(false); return; }

    const { data: wandelingen, error: e1 } = await supabase
      .from("ezelwandelingen")
      .select("id,titel,wanneer,startuur,einduur,omschrijving")
      .gte("wanneer", todayISODate())
      .order("wanneer", { ascending: true })
      .order("startuur", { ascending: true });

    if (e1) { setError(e1.message); setLoading(false); return; }

    const lijst = (wandelingen ?? []) as Ezelwandeling[];
    setItems(lijst);

    const ids = lijst.map((w) => w.id);
    if (ids.length === 0) { setDeelnemers([]); setLoading(false); return; }

    const { data: dl, error: e2 } = await supabase
      .from("ezelwandeling_deelnemers")
      .select("ezelwandeling_id,vrijwilliger_id,opmerking")
      .in("ezelwandeling_id", ids);

    if (e2) { setError(e2.message); setLoading(false); return; }

    const deelnemersList = (dl ?? []) as Deelnemer[];
    setDeelnemers(deelnemersList);

    const vrijwilligerIds = [...new Set(deelnemersList.map((d) => d.vrijwilliger_id))];
    if (vrijwilligerIds.length > 0) {
      const { data: vv } = await supabase
        .from("vrijwilligers")
        .select("id,voornaam,achternaam,telefoon")
        .in("id", vrijwilligerIds);

      const infoMap = new Map<string, VrijwilligerInfo>();
      for (const v of (vv ?? [])) {
        const naam = `${v.voornaam ?? ""} ${v.achternaam ?? ""}`.trim() || "(onbekend)";
        infoMap.set(v.id, { naam, telefoon: v.telefoon ?? null });
      }
      setVrijwilligerInfo(infoMap);
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Formulier ---
  function openNieuw() {
    setFormTitel(""); setFormOmschrijving(""); setFormWanneer("");
    setFormStartuur(""); setFormEinduur(""); setFormFout(null);
    setFormModal({ mode: "nieuw" });
  }

  function openBewerken(w: Ezelwandeling) {
    setFormTitel(w.titel); setFormOmschrijving(w.omschrijving ?? "");
    setFormWanneer(w.wanneer); setFormStartuur(hhmm(w.startuur));
    setFormEinduur(hhmm(w.einduur)); setFormFout(null);
    setFormModal({ mode: "bewerken", wandelingId: w.id });
  }

  async function slaFormOp() {
    if (!formTitel.trim()) { setFormFout("Titel is verplicht."); return; }
    if (!formWanneer) { setFormFout("Datum is verplicht."); return; }
    if (!formStartuur) { setFormFout("Startuur is verplicht."); return; }
    if (!formEinduur) { setFormFout("Einduur is verplicht."); return; }

    setFormBezig(true);
    setFormFout(null);

    const payload = {
      titel: formTitel.trim(),
      omschrijving: formOmschrijving.trim() || null,
      wanneer: formWanneer,
      startuur: formStartuur,
      einduur: formEinduur,
    };

    let dbError = null;
    if (formModal?.mode === "nieuw") {
      const { error } = await supabase.from("ezelwandelingen").insert(payload);
      dbError = error;
    } else if (formModal?.wandelingId) {
      const { error } = await supabase.from("ezelwandelingen").update(payload).eq("id", formModal.wandelingId);
      dbError = error;
    }

    if (dbError) { setFormFout(dbError.message); setFormBezig(false); return; }

    setFormModal(null);
    setFormBezig(false);
    await load();
  }

  async function verwijder(id: string) {
    const ok = window.confirm("Wandeling verwijderen? Dit kan niet ongedaan gemaakt worden.");
    if (!ok) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    const { error } = await supabase.from("ezelwandelingen").delete().eq("id", id);
    if (error) { setError(error.message); setBusy(false); return; }
    setMsg("Wandeling verwijderd.");
    await load();
    setBusy(false);
  }

  // --- Mail ---
  function openMailModal(w: Ezelwandeling) {
    setMailBoodschap(""); setMailResultaat(null); setMailFout(null);
    setMailModal({ wandelingId: w.id, titel: w.titel });
  }

  async function verstuurMail() {
    if (!mailModal || !mailBoodschap.trim()) return;
    setMailBezig(true); setMailFout(null); setMailResultaat(null);
    try {
      const result = await stuurMailNaarDeelnemers(mailModal.wandelingId, mailBoodschap.trim());
      if (result.error) {
        setMailFout(result.error);
      } else {
        setMailResultaat(`Mail verstuurd naar ${result.verstuurd} deelnemer${result.verstuurd !== 1 ? "s" : ""}.`);
      }
    } catch (e: unknown) {
      setMailFout(e instanceof Error ? e.message : "Fout bij versturen.");
    } finally {
      setMailBezig(false);
    }
  }

  // --- WhatsApp ---
  function openWaModal(w: Ezelwandeling) {
    const tekst = `Hallo! Een herinnering voor de ezelwandeling op ${formatDatum(w.wanneer)}: ${w.titel}. Vertrekpunt is de weide op Waaranders.`;
    setWaTekst(tekst);
    setWaModal({ wandelingId: w.id, titel: w.titel });
  }

  if (loading) return <main className="mx-auto max-w-4xl p-4 sm:p-6 md:p-10">Laden…</main>;

  if (!allowed) {
    return (
      <main className="mx-auto max-w-4xl p-4 sm:p-6 md:p-10">
        <h1 className="text-3xl font-semibold tracking-tight mb-2">Ezelwandelingen beheren</h1>
        <p>Je hebt geen rechten om deze pagina te bekijken.</p>
      </main>
    );
  }

  return (
    <>
      {/* Formulier modal */}
      {formModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-md w-full space-y-4 overflow-y-auto max-h-[90vh]">
            <h2 className="font-semibold text-lg">
              {formModal.mode === "nieuw" ? "Wandeling toevoegen" : "Wandeling bewerken"}
            </h2>
            {formFout && <div className="wa-alert-error">{formFout}</div>}
            <div>
              <label className="text-sm font-medium block mb-1">Titel</label>
              <input
                className="w-full border rounded-xl p-3 bg-white text-sm"
                value={formTitel}
                onChange={(e) => setFormTitel(e.target.value)}
                disabled={formBezig}
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Omschrijving (optioneel)</label>
              <textarea
                className="w-full border rounded-xl p-3 bg-white text-sm"
                rows={3}
                value={formOmschrijving}
                onChange={(e) => setFormOmschrijving(e.target.value)}
                disabled={formBezig}
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Datum</label>
              <input
                type="date"
                className="w-full border rounded-xl p-3 bg-white text-sm"
                value={formWanneer}
                onChange={(e) => setFormWanneer(e.target.value)}
                disabled={formBezig}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium block mb-1">Startuur</label>
                <input
                  type="time"
                  className="w-full border rounded-xl p-3 bg-white text-sm"
                  value={formStartuur}
                  onChange={(e) => setFormStartuur(e.target.value)}
                  disabled={formBezig}
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Einduur</label>
                <input
                  type="time"
                  className="w-full border rounded-xl p-3 bg-white text-sm"
                  value={formEinduur}
                  onChange={(e) => setFormEinduur(e.target.value)}
                  disabled={formBezig}
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                className="wa-btn wa-btn-brand flex-1 py-2 text-sm"
                onClick={slaFormOp}
                disabled={formBezig}
              >
                {formBezig ? "Bezig…" : "Opslaan"}
              </button>
              <button
                className="wa-btn wa-btn-ghost flex-1 py-2 text-sm"
                onClick={() => setFormModal(null)}
                disabled={formBezig}
              >
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mail modal */}
      {mailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full space-y-4">
            <h2 className="font-semibold text-lg">Mail versturen naar deelnemers</h2>
            <p className="text-sm text-gray-600">{mailModal.titel}</p>
            {mailResultaat ? (
              <>
                <div className="wa-alert-success">{mailResultaat}</div>
                <button className="wa-btn wa-btn-ghost w-full py-2 text-sm" onClick={() => setMailModal(null)}>
                  Sluiten
                </button>
              </>
            ) : (
              <>
                {mailFout && <div className="wa-alert-error">{mailFout}</div>}
                <textarea
                  className="w-full border rounded-xl px-3 py-2 text-sm min-h-[120px] resize-y"
                  placeholder="Typ hier je bericht…"
                  value={mailBoodschap}
                  onChange={(e) => setMailBoodschap(e.target.value)}
                  disabled={mailBezig}
                />
                <div className="flex flex-col gap-2">
                  <button
                    className="wa-btn wa-btn-brand py-2 text-sm"
                    onClick={verstuurMail}
                    disabled={mailBezig || !mailBoodschap.trim()}
                  >
                    {mailBezig ? "Versturen…" : "Verstuur via e-mail"}
                  </button>
                  <button
                    className="wa-btn wa-btn-ghost py-2 text-sm"
                    onClick={() => setMailModal(null)}
                    disabled={mailBezig}
                  >
                    Annuleren
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* WhatsApp modal */}
      {waModal && (() => {
        const dl = deelnemersByWandeling.get(waModal.wandelingId) ?? [];
        const metNummer = dl.filter((d) => vrijwilligerInfo.get(d.vrijwilliger_id)?.telefoon);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full space-y-4 overflow-y-auto max-h-[90vh]">
              <h2 className="font-semibold text-lg">WhatsApp naar deelnemers</h2>
              <p className="text-sm text-gray-600">{waModal.titel}</p>
              <div>
                <label className="text-sm font-medium block mb-1">Bericht (aanpasbaar)</label>
                <textarea
                  className="w-full border rounded-xl px-3 py-2 text-sm min-h-[100px] resize-y"
                  value={waTekst}
                  onChange={(e) => setWaTekst(e.target.value)}
                />
              </div>
              {metNummer.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-1">Telefoonnummers deelnemers</div>
                  <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-700 space-y-0.5">
                    {metNummer.map((d) => {
                      const info = vrijwilligerInfo.get(d.vrijwilliger_id)!;
                      return (
                        <div key={d.vrijwilliger_id}>
                          {info.naam}: <span className="font-mono">{info.telefoon}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <a
                  className="wa-btn-whatsapp px-4 py-2 text-sm text-center block"
                  href={`https://wa.me/?text=${encodeURIComponent(waTekst)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Openen in WhatsApp
                </a>
                <button className="wa-btn wa-btn-ghost py-2 text-sm" onClick={() => setWaModal(null)}>
                  Sluiten
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <main className="mx-auto max-w-4xl p-4 sm:p-6 md:p-10">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h1 className="text-3xl font-semibold tracking-tight mb-1">Ezelwandelingen beheren</h1>
          <button
            className="wa-btn-action px-3 py-2 text-sm"
            onClick={openNieuw}
            disabled={busy}
          >
            Wandeling toevoegen
          </button>
        </div>

        {error && <div className="wa-alert-error mb-4">Fout: {error}</div>}
        {msg && <div className="wa-alert-success mb-4">{msg}</div>}

        {items.length === 0 ? (
          <p className="text-gray-700">Geen toekomstige ezelwandelingen.</p>
        ) : (
          <div className="space-y-8">
            {grouped.map((g) => (
              <section key={g.key}>
                <div className="sticky top-0 z-10 -mx-4 sm:-mx-6 md:-mx-10">
                  <div className="wa-section-header px-4 sm:px-6 md:px-10 py-2">{g.title}</div>
                </div>

                <ul className="space-y-3 mt-3">
                  {g.items.map((w) => {
                    const s = hhmm(w.startuur);
                    const e = hhmm(w.einduur);
                    const dl = deelnemersByWandeling.get(w.id) ?? [];

                    return (
                      <li key={w.id} className="wa-card p-4">
                        <div className="space-y-3">
                          <div className="font-semibold whitespace-pre-line break-words text-base sm:text-lg">
                            {w.titel}
                          </div>

                          {w.omschrijving && (
                            <div className="text-sm text-gray-700 whitespace-pre-line break-words">
                              {w.omschrijving}
                            </div>
                          )}

                          <div className="text-sm text-gray-700 flex flex-wrap gap-x-3 gap-y-1">
                            <span className="text-gray-600">{formatDatum(w.wanneer)}</span>
                            {s && e
                              ? <span>van {s} tot {e}</span>
                              : <span className="text-gray-500">(geen uren)</span>
                            }
                          </div>

                          <div className="text-sm text-gray-700">
                            <span className="font-medium">{dl.length} ingeschreven</span>
                            {dl.length > 0 && (
                              <ul className="mt-1 space-y-0.5">
                                {dl.map((d) => {
                                  const info = vrijwilligerInfo.get(d.vrijwilliger_id);
                                  return (
                                    <li key={d.vrijwilliger_id} className="text-gray-600">
                                      {info?.naam ?? "(onbekend)"}
                                      {d.opmerking && (
                                        <span className="text-gray-500 italic"> — {d.opmerking}</span>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </div>

                          <div className="pt-2 flex flex-wrap gap-2">
                            {dl.length > 0 && (
                              <>
                                <button
                                  className="wa-btn wa-btn-ghost flex-1 px-4 py-2 text-sm"
                                  onClick={() => openMailModal(w)}
                                  disabled={busy}
                                >
                                  Mail naar deelnemers
                                </button>
                                <button
                                  className="wa-btn-whatsapp flex-1 px-4 py-2 text-sm"
                                  onClick={() => openWaModal(w)}
                                  disabled={busy}
                                >
                                  WhatsApp naar deelnemers
                                </button>
                              </>
                            )}
                            <button
                              className="wa-btn wa-btn-ghost flex-1 px-4 py-2 text-sm"
                              onClick={() => openBewerken(w)}
                              disabled={busy}
                            >
                              Bewerken
                            </button>
                            <button
                              className="wa-btn-danger flex-1 px-4 py-2 text-sm"
                              onClick={() => verwijder(w.id)}
                              disabled={busy}
                            >
                              Verwijderen
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
