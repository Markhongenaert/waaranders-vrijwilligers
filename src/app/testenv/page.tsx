export default function TestEnv() {
  return (
    <main className="p-8">
      <div>
        URL: {process.env.NEXT_PUBLIC_SUPABASE_URL}
      </div>
      <div>
        KEY aanwezig?: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "ja" : "nee"}
      </div>
    </main>
  );
}
