import type { Metadata } from "next";
import { Cinzel, Inter } from "next/font/google";
import "./globals.css";

const bodyFont = Inter({
  subsets: ["latin"],
  variable: "--font-body"
});

const displayFont = Cinzel({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"]
});

export const metadata: Metadata = {
  title: "Majestic Bookings",
  description: "Apartment booking app with Supabase auth, reservations, notifications, and stats."
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
} as const;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var theme=localStorage.getItem('majestic-theme');if(theme==='dark'){document.documentElement.setAttribute('data-theme','dark');}}catch(_e){}})();"
          }}
        />
      </head>
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>{children}</body>
    </html>
  );
}
