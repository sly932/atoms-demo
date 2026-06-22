import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Atoms Demo — describe an app, watch it build",
  description:
    "An agent-driven app builder: describe what you want in plain language and get a running, editable web app with live preview, version history and a shareable link.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
