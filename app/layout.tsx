import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GoPark Sense — A better place to park",
  description: "Find your space in Beirut. GPS-assisted arrivals, smart gate check-in and rewards for parking well. Interactive hackathon prototype.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "GoPark" },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/icon-192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
