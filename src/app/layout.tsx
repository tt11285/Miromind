import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ValuationLens",
  description: "Transparent financial research agent for auditable investment memos"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
