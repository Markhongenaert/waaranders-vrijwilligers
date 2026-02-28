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
    <main className="p-5 sm:p-6">
      <h1 className="text-xl font-semibold mb-6">Beheer</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
        {tiles.map((t) => (
          <a
            key={t.href}
            href={t.href}
            className="
              h-28 sm:h-24
              flex items-center justify-center
              rounded-xl
              bg-blue-50
              border border-blue-100
              shadow-sm
              hover:shadow-md
              active:scale-95
              transition
              duration-150
            "
          >
            <span className="text-base sm:text-sm font-semibold text-gray-800 text-center px-2">
              {t.title}
            </span>
          </a>
        ))}
      </div>
    </main>
  );
}