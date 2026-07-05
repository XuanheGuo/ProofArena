import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SpeedInsights } from "@vercel/speed-insights/next";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://proof-arena.guoxh.me";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "ProofArena | 高中数学解法竞技场",
  description: "同一道题，多种解法，正面交锋。",
  openGraph: {
    title: "ProofArena | 高中数学解法竞技场",
    description: "同一道题，多种解法，正面交锋。",
    siteName: "ProofArena",
    url: siteUrl,
    images: ["/opengraph-image"],
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning className={geist.variable}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=localStorage.getItem("proofarena-theme")||"light";var d=m==="dark"||(m==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);var t=d?"dark":"light";document.documentElement.dataset.theme=t;document.documentElement.dataset.themeMode=m;document.documentElement.style.colorScheme=t}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <SiteHeader />
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
