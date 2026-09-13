import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  // Without metadataBase, Open Graph URLs stay relative and previews come up blank.
  metadataBase: new URL(appUrl),
  title: { default: "Kairo — Create once. Publish everywhere.", template: "%s · Kairo" },
  description: "Plan, create, schedule and analyze your social content from one beautifully designed workspace.",
  openGraph: {
    type: "website",
    siteName: "Kairo",
    title: "Kairo — Create once. Publish everywhere.",
    description: "Plan, create, schedule and analyze your social content from one beautifully designed workspace.",
    url: appUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "Kairo — Create once. Publish everywhere.",
    description: "Plan, create, schedule and analyze your social content from one beautifully designed workspace.",
  },
};

export const viewport: Viewport = { themeColor: "#060709", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Browser extensions (password managers, Grammarly, translators) inject attributes onto
    // <html> and <body> before React hydrates. suppressHydrationWarning silences that one-level
    // mismatch; it does not affect any component inside.
    <html lang="en" className={`dark ${GeistSans.variable}`} suppressHydrationWarning>
      <body className="font-sans" suppressHydrationWarning>
        <div className="ambient" aria-hidden />
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </body>
    </html>
  );
}
