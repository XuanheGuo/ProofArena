import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata: Metadata = {
  title: "ProofArena | 高中数学解法竞技场",
  description: "同一道题，多种解法，正面交锋。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
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
