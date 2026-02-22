@import "tailwindcss";

:root {
  --foreground: #171717;
}

/* optioneel */
@media (prefers-color-scheme: dark) {
  :root {
    --foreground: #ededed;
  }
}

@layer base {
  html,
  body {
    @apply min-h-screen bg-slate-200 text-gray-900;
  }
}

body {
  color: var(--foreground);
  font-family: Arial, Helvetica, sans-serif;
}