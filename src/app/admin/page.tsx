"use client";

export default function AdminPage() {
  const tiles = [
    {
      title: "Activiteiten",
      desc: "Overzicht en beheer van activiteiten.",
      href: "/admin/activiteiten",
    },
    {
      title: "Klanten",
      desc: "Beheer klanten en contactpersonen.",
      href: "/admin/klanten",
    },
    {
      title: "Vrijwilligers",
      desc: "Contactgegevens aanpassen, rollen en interesses bekijken.",
      href: "/admin/vrijwilligers",
    },
    {
      title: "Todo",
      desc: "Takenlijst en opvolging.",
      href: "/admin/todo",
    },
    {
      title: "Admin",
      desc: "Beheer instellingen en rechten.",
      href: "/admin/admin",
    },
  ];

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Beheer</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tiles.map((t) => (
          <a
            key={t.href}
            href={t.href}
            className="border rounded-2xl p-6 hover:bg-gray-50 hover:shadow-sm transition"
          >
            <div className="text-lg font-semibold">{t.title}</div>
            <div className="text-sm text-gray-600 mt-1">{t.desc}</div>
          </a>
        ))}
      </div>
    </main>
  );
}