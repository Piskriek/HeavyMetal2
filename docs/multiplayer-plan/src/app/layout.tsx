import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Heavy Metal GP 2 — Meta-game Architecture Plan",
  description: "Ball decal pipeline, goblin avatar studio, multiplayer hub, permadeath economy, Shaman altar and Goblin Bookie.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-stone-950 text-stone-200 antialiased">{children}</body>
    </html>
  );
}
