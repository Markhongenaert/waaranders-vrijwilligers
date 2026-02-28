"use client";

export default function AdminPage() {
  const tiles = [
    { title: "Activiteiten", href: "/admin/activiteiten" },
    { title: "Klanten", href: "/admin/klanten" },
    { title: "Vrijwilligers", href: "/admin/vrijwilligers" },
    { title: "Todo", href: "/admin/todo" },
    { title: "Admin", href: "/admin/admin" },
  ];

  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold mb-6">Beheer</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
        {tiles.map((t) => (
          <a
            key={t.href}
            href={t.href}
            className="
              h-28
              flex items-center justify-center
              rounded-xl
              border border-gray-200
              bg-white
              shadow-sm
              hover:shadow-md
              hover:-translate-y-0.5
              transition
              duration-150
            "
          >
            <span className="text-base font-semibold text-gray-800">
              {t.title}
            </span>
          </a>
        ))}
      </div>
    </main>
  );
}