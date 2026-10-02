import type { Metadata } from "next";
import RoutesSectie from "@/components/wandelroutes/RoutesSectie";

export const metadata: Metadata = {
  title: "Wandelen met de ezels – Waaranders",
};

export default function WandelroutesPage() {
  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-6 md:p-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Wandelen met de ezels</h1>
        <p className="text-gray-700">
          Zin om met de ezels van Waaranders het bos in te trekken? Hier vind je routes die we zelf
          gewandeld hebben, met praktische tips. Elke wandeling vertrekt aan de weide op Waaranders.
        </p>
      </div>

      <RoutesSectie beheer={false} />

      <p className="text-sm text-gray-600 text-center print:hidden">
        Interesse om met de ezels te wandelen? Binnenkort kan je hier contact met ons opnemen.
      </p>
    </main>
  );
}
