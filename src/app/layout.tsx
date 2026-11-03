import type { Metadata } from "next";
import { Lexend, Source_Sans_3 } from "next/font/google";
import "./globals.css";

// Lexend for headings (its wide, open letters were designed for easy reading); Source Sans 3 for text and numbers.
const display = Lexend({ subsets: ["latin"], variable: "--font-lexend", weight: ["500", "600", "700"] });
const sans = Source_Sans_3({ subsets: ["latin"], variable: "--font-source" });

export const metadata: Metadata = {
  title: "Sign Planner · Team Illuminators",
  description: "Pick an off-grid sign that fits your budget. Solar, battery and wind sized with 10 years of real NASA weather, for any place on Earth.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
