"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Doenker, VakantiePerio } from "../page";

type Props = {
  doenkers: Doenker[];
  perioden: VakantiePerio[];
  onRefresh: () => Promise<void>;
};

function fullName(d: Doenker) {
  return [d.voornaam ?? "", d.achternaam ?? ""].join(" ").trim() || "—";
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default function InvoerenTab({ doenkers, perioden, onRefresh }: Props) {
  const [selectedId, setSelectedId] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [beginDatum, setBeginDatum] = useState("");
  const [eindDatum, setEindDatum] = useState("");
  const [formErr, setFormErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const myPerioden = perioden.filter((p) => p.vrijwilliger_id === selectedId);

  const handleAdd = async () => {
    setFormErr(null);
    if (!selectedId) return;
    if (!beginDatum || !eindDatum) {
      setFormErr("Vul beide datums in.");
      return;
    }
    if (eindDatum < beginDatum) {
      setFormErr("Einddatum moet gelijk aan of later zijn dan de begindatum.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("vakantie_perioden").insert({
        vrijwilliger_id: selectedId,
        begin_datum: beginDatum,
        eind_datum: eindDatum,
      });
      if (error) throw error;
      setShowForm(false);
      setBeginDatum("");
      setEindDatum("");
      await onRefresh();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      setFormErr(e?.message ?? "Fout bij opslaan.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Weet je zeker dat je deze vakantieperiode wil verwijderen?")) return;
    setDeletingId(id);
    try {
      const { error } = await supabase.from("vakantie_perioden").delete().eq("id", id);
      if (error) throw error;
      await onRefresh();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      alert(e?.message ?? "Fout bij verwijderen.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4 max-w-lg">
      {/* Dropdown */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Kies een doenker
        </label>
        <select
          className="w-full border rounded-xl p-3 text-sm"
          value={selectedId}
          onChange={(e) => {
            setSelectedId(e.target.value);
            setShowForm(false);
            setFormErr(null);
          }}
        >
          <option value="">— selecteer —</option>
          {doenkers.map((d) => (
            <option key={d.id} value={d.id}>
              {fullName(d)}
            </option>
          ))}
        </select>
      </div>

      {selectedId && (
        <>
          {/* Bestaande perioden */}
          <div className="space-y-2">
            {myPerioden.length === 0 ? (
              <p className="text-sm text-gray-500">Geen vakantieperioden gevonden.</p>
            ) : (
              myPerioden.map((p) => (
                <div
                  key={p.id}
                  className="wa-card flex items-center justify-between px-4 py-3"
                >
                  <span className="text-sm text-gray-800">
                    {formatDate(p.begin_datum)} – {formatDate(p.eind_datum)}
                  </span>
                  <button
                    onClick={() => handleDelete(p.id)}
                    disabled={deletingId === p.id}
                    className="wa-btn wa-btn-danger text-xs px-3 py-1"
                  >
                    {deletingId === p.id ? "Verwijderen…" : "Verwijderen"}
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Knop Periode toevoegen */}
          {!showForm && (
            <button
              onClick={() => {
                setShowForm(true);
                setFormErr(null);
              }}
              className="wa-btn wa-btn-brand px-4 py-2 text-sm"
            >
              + Periode toevoegen
            </button>
          )}

          {/* Invoerformulier */}
          {showForm && (
            <div className="wa-card p-4 space-y-3">
              {formErr && <div className="wa-alert-error text-sm">{formErr}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Eerste dag
                </label>
                <input
                  type="date"
                  className="w-full border rounded-xl p-2.5 text-sm"
                  value={beginDatum}
                  onChange={(e) => setBeginDatum(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Laatste dag
                </label>
                <input
                  type="date"
                  className="w-full border rounded-xl p-2.5 text-sm"
                  value={eindDatum}
                  onChange={(e) => setEindDatum(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  disabled={saving}
                  className="wa-btn wa-btn-brand px-4 py-2 text-sm"
                >
                  {saving ? "Opslaan…" : "Opslaan"}
                </button>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setBeginDatum("");
                    setEindDatum("");
                    setFormErr(null);
                  }}
                  className="wa-btn wa-btn-ghost px-4 py-2 text-sm"
                >
                  Annuleren
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
