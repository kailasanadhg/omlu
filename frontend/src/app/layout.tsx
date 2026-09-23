import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { TopBar } from "@/components/navigation/TopBar";
import { BottomNav } from "@/components/navigation/BottomNav";

export const metadata: Metadata = {
  title: "omlu — Our Memories Link Us",
  description: "A shared social memory platform for private groups and spaces",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "omlu",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-neutral-50 text-neutral-900 antialiased min-h-screen flex flex-col font-sans selection:bg-neutral-200">
        <AuthProvider>
          <TopBar />
          <main className="flex-1 w-full max-w-xl mx-auto pb-20 bg-white min-h-[calc(100vh-3.5rem)] shadow-xs">
            {children}
          </main>
          <BottomNav />
        </AuthProvider>
      </body>
    </html>
  );
}
