import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Overclocked — The Hazmat Interns",
  description: "A three-minute delivery race for friends or solo players against Clumsy Intern bots. Grab canisters, carry them to the exit, and score.",
  icons: { icon: "/favicon.svg" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#141713" };
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>) {
  return <html lang="en"><body>{children}</body></html>;
}
