"use client";

export default function DoenkersHome() {
  const items = [
    { href: "/admin/toevoegen", label: "Toevoegen" },
    { href: "/admin/activiteiten", label: "Beheren" },
    { href: "/admin/todos", label: "Todo" },
    { href: "/admin/rollen", label: "Admin" },
  ];

  return (
    <main className="mx-auto max-w-3xl p-6 md:p-10">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((i) => (
          <a
            key={i.href}
            href={i.href}
            className="bg-blue-900 text-white font-semibold rounded-2xl px-5 py-4 hover:bg-blue-800 transition shadow-sm text-center"
          >
            {i.label}
          </a>
        ))}
      </div>
    </main>
  );
}
