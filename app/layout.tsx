import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Kairo — Create once. Publish everywhere.", template: "%s · Kairo" },
  description: "Plan, create, schedule and analyze your social content from one beautifully designed workspace.",
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
