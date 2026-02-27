// src/app/layout.tsx
import "./globals.css";
import type { ReactNode } from "react";
import AppHeader from "@/components/AppHeader";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="nl">
      <body>
        {/* Client-side auth bootstrap: maakt/controleert vrijwilligers-profiel na login */}

        <div className="min-h-screen bg-slate-200 text-gray-900">
          <AppHeader />

          {/* Page container */}
          <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8">
            {/* Content surface */}
            <div className="rounded-3xl bg-white shadow-sm border border-gray-200">
              <div className="p-4 sm:p-6">{children}</div>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}