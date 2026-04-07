import type { ReactNode } from "react";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import "./shifts-console.css";
import "./schichtplanung-v2.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap"
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap"
});

export default function AdminShiftsLayout({ children }: { children: ReactNode }) {
  return <div className={`${dmSans.variable} ${jetbrainsMono.variable}`}>{children}</div>;
}
