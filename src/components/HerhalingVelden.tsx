"use client";

import { HerhalingWaarden } from "@/lib/herhaling";

type Props = {
  waarden: HerhalingWaarden;
  onChange: (waarden: HerhalingWaarden) => void;
  disabled?: boolean;
  toggleLabel?: string;
};

/** Herbruikbare herhalingsvelden: aan/uit, frequentie, interval en stopcriterium. */
export default function HerhalingVelden({ waarden, onChange, disabled, toggleLabel }: Props) {
  const set = (partial: Partial<HerhalingWaarden>) => onChange({ ...waarden, ...partial });

  return (
    <div className="border-t border-gray-100 pt-4 space-y-4">
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={waarden.herhaling}
          onChange={(e) => set({ herhaling: e.target.checked })}
          disabled={disabled}
          className="w-4 h-4 rounded"
        />
        <span className="text-sm font-medium">{toggleLabel ?? "Deze activiteit herhaalt zich"}</span>
      </label>

      {waarden.herhaling && (
        <div className="space-y-4 pl-7">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1">Frequentie</label>
              <select
                className="w-full border rounded-xl p-3 bg-white"
                value={waarden.type}
                onChange={(e) => set({ type: e.target.value as "wekelijks" | "maandelijks" })}
                disabled={disabled}
              >
                <option value="wekelijks">Elke week</option>
                <option value="maandelijks">Elke maand</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium block mb-1">
                Interval ({waarden.type === "wekelijks" ? "weken" : "maanden"})
              </label>
              <input
                type="number"
                min={1}
                max={52}
                className="w-full border rounded-xl p-3 bg-white"
                value={waarden.interval}
                onChange={(e) => set({ interval: e.target.value })}
                onBlur={() => {
                  const n = parseInt(waarden.interval, 10);
                  set({ interval: isNaN(n) || n < 1 ? "1" : String(n) });
                }}
                disabled={disabled}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium block mb-2">Stopcriterium</label>
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Optie: Na X keer */}
              <label className="flex items-center gap-2 border rounded-xl p-3 cursor-pointer flex-1 bg-white transition-colors has-[:checked]:border-blue-900 has-[:checked]:bg-blue-50">
                <input
                  type="radio"
                  name="stopType"
                  value="aantal"
                  checked={waarden.stopType === "aantal"}
                  onChange={() => set({ stopType: "aantal" })}
                  disabled={disabled}
                />
                <span className="text-sm whitespace-nowrap">Na</span>
                <input
                  type="number"
                  min={1}
                  max={200}
                  className="w-16 border rounded-lg p-1 text-sm bg-white"
                  value={waarden.stopAantal}
                  onClick={() => set({ stopType: "aantal" })}
                  onChange={(e) => set({ stopType: "aantal", stopAantal: e.target.value })}
                  onBlur={() => {
                    const n = parseInt(waarden.stopAantal, 10);
                    set({ stopAantal: isNaN(n) || n < 1 ? "1" : String(n) });
                  }}
                  disabled={disabled}
                />
                <span className="text-sm">keer</span>
              </label>

              {/* Optie: Tot datum */}
              <label className="flex items-center gap-2 border rounded-xl p-3 cursor-pointer flex-1 bg-white transition-colors has-[:checked]:border-blue-900 has-[:checked]:bg-blue-50">
                <input
                  type="radio"
                  name="stopType"
                  value="datum"
                  checked={waarden.stopType === "datum"}
                  onChange={() => set({ stopType: "datum" })}
                  disabled={disabled}
                />
                <span className="text-sm whitespace-nowrap">Tot</span>
                <input
                  type="date"
                  className="border rounded-lg p-1 text-sm bg-white flex-1 min-w-0"
                  value={waarden.stopDatum}
                  onClick={() => set({ stopType: "datum" })}
                  onChange={(e) => set({ stopType: "datum", stopDatum: e.target.value })}
                  disabled={disabled}
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
