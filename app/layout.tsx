import type { Metadata } from "next";
import { Fraunces, Geist_Mono } from "next/font/google";
import "./globals.css";

// Lastly's serif voice: landing page headings and the portal's key titles (.hl-serif).
const fraunces = Fraunces({
  variable: "--font-serif",
  subsets: ["latin"],
  axes: ["opsz", "SOFT"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Absolute URLs for the link-preview image (app/opengraph-image.tsx).
  metadataBase: new URL('https://lastly-rdeo.onrender.com'),
  applicationName: 'Lastly',
  title: {
    template: "%s · Lastly",
    default: "Lastly · Nobody should keep paying after they're gone",
  },
  description: "Lastly helps the executor of a loved one's estate settle their PayPal payments: stop post-death charges, recover refunds and pay the heirs, one approved step at a time.",
  openGraph: { type: 'website', siteName: 'Lastly' },
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
