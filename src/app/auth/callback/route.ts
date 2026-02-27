import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const url = new URL(request.url);

  // Next 16: cookies() is async
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  // Supabase kan ?code=... of ?token_hash=... teruggeven
  const code =
    url.searchParams.get("code") ??
    url.searchParams.get("token_hash");

  if (code) {
    try {
      await supabase.auth.exchangeCodeForSession(code);
    } catch (err) {
      console.error("Auth callback error:", err);
      return NextResponse.redirect(new URL("/login", url.origin));
    }
  }

  // Succes → naar activiteiten
  return NextResponse.redirect(new URL("/activiteiten", url.origin));
}