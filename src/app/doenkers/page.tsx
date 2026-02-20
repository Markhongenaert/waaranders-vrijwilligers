"use client";

const items = [
  { href: "/admin/toevoegen", label: "Toevoegen", desc: "Nieuwe activiteit" },
  { href: "/admin/activiteiten", label: "Beheren", desc: "Activiteiten wijzigen" },
  { href: "/admin/todos", label: "Todo", desc: "Taken opvolgen" },
  { href: "/admin/klanten", label: "Klanten", desc: "Klanten opvolgen" },
  { href: "/admin/rollen", label: "Admin", desc: "Rollen & toegang" },
];

export default function DoenkersHome() {
  return (
    <main className="mx-auto max-w-3xl p-6 md:p-10">
      <div className="flex items-center justify-between mb-5">
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((i) => (
          <a
            key={i.href}
            href={i.href}
            className="group rounded-2xl border bg-white/80 shadow-sm px-4 py-4 hover:bg-blue-50 transition flex items-center justify-between"
          >
            <div className="min-w-0">
              <div className="font-semibold text-blue-900">{i.label}</div>
              <div className="text-sm text-gray-600 mt-1">{i.desc}</div>
            </div>

            <div className="shrink-0 ml-4 text-blue-900/70 group-hover:text-blue-900 transition">
              <span className="text-xl leading-none">›</span>
            </div>
          </a>
        ))}
      </div>
    </main>
  );
}
