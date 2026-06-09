import type { ReactNode } from "react";
import { Footer } from "@/components/Footer";
import { NavBar } from "@/components/NavBar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground transition-colors">
      <NavBar />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      <Footer />
    </div>
  );
}
