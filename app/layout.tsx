import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";

/**
 * Headers only. Body text and inputs stay on system-ui, so the font swap can
 * never reflow what you are actually typing into.
 */
const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Personal Context",
  description: "The context store behind your Claude instances.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={display.variable}>
      <body style={{ fontFamily: "system-ui, sans-serif" }}>{children}</body>
    </html>
  );
}
