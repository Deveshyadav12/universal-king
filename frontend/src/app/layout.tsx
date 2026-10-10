import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HexaWave — AI Software Factory",
  description:
    "Build, test and deploy software with an AI-powered software factory.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
