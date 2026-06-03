import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Majestic Bookings",
  description: "Apartment booking app with Supabase auth, reservations, notifications, and stats."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
