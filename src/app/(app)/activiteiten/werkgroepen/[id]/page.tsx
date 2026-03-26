import { supabaseServer } from "@/lib/supabase/server";
import DOMPurify from "isomorphic-dompurify";
import { notFound } from "next/navigation";

const ALLOWED_TERUG_PREFIXES = ["/profiel", "/admin/werkgroepen/beheer"];

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ terug?: string }>;
}

export default async function WerkgroepDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { terug } = await searchParams;

  const terugParam = terug ?? "";
  const terugUrl = ALLOWED_TERUG_PREFIXES.some((p) => terugParam.startsWith(p))
    ? terugParam
    : "/profiel";

  const supabase = await supabaseServer();
  const { data: werkgroep, error } = await supabase
    .from("werkgroepen")
    .select("id, titel, uitgebreide_info")
    .eq("id", id)
    .maybeSingle();

  if (error || !werkgroep) notFound();

  const safeHtml = DOMPurify.sanitize(werkgroep.uitgebreide_info ?? "");

  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-6 md:p-10 space-y-5">
      <div className="flex items-center gap-3">
        <a
          href={terugUrl}
          className="border rounded-xl px-4 py-2 text-sm bg-white hover:shadow-sm transition"
        >
          ← Terug
        </a>
        <h1 className="text-xl font-semibold">{werkgroep.titel}</h1>
      </div>

      <div className="wa-card p-5">
        {safeHtml ? (
          <div
            className="wa-prose"
            dangerouslySetInnerHTML={{ __html: safeHtml }}
          />
        ) : (
          <p className="text-gray-600">Geen uitgebreide informatie beschikbaar.</p>
        )}
      </div>
    </main>
  );
}
