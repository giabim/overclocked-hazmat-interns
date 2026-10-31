import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Overclocked — The Hazmat Interns",
  description: "A three-minute multiplayer containment race. Explore nine lab rooms, freeze escaped specimens, and deliver glowing canisters. Play instantly with friends or three bot levels.",
  icons: { icon: "/favicon.svg" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#141713" };
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>) {
  return <html lang="en"><body>{children}</body></html>;
}
