import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Majestic Bookings",
    short_name: "Majestic",
    description: "Apartment booking app with reservations, notifications, and stats.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f7fcf9",
    theme_color: "#163943",
    icons: [
      {
        src: "/android-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/android-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      }
    ]
  };
}