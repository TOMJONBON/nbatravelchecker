import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/nav";
import { SiteFooter } from "@/components/footer";
import { getDataset } from "@/lib/data";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:4310";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "NBA Travel Tracker — travel, fatigue and transparent game projections",
    template: "%s · NBA Travel Tracker",
  },
  description:
    "Follow all 30 NBA teams' estimated travel, road performance, player travel splits, and explainable game projections. Demo build with clearly labelled mock data.",
  applicationName: "NBA Travel Tracker",
  authors: [{ name: "NBA Travel Tracker" }],
  keywords: ["NBA", "travel", "fatigue", "predictions", "road trips", "analytics"],
  openGraph: {
    title: "NBA Travel Tracker",
    description:
      "Estimated team travel, fatigue indices, player splits and explainable projections for all 30 NBA teams.",
    type: "website",
    url: siteUrl,
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#04060c",
  width: "device-width",
  initialScale: 1,
};

const THEME_SCRIPT = `try{var t=localStorage.getItem('nbatt-theme');if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t;}}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let mode: "live" | "mock" = "mock";
  let updatedAt: string | undefined;
  try {
    const dataset = await getDataset();
    mode = dataset.mode;
    updatedAt = dataset.meta.updatedAt;
  } catch {
    mode = "mock";
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh antialiased">
        <Providers>
          <SiteHeader mode={mode} updatedAt={updatedAt} />
          <main id="main" className="mx-auto w-full max-w-[1400px] px-4 pb-6 pt-6 sm:px-6 sm:pt-8">
            {children}
          </main>
          <SiteFooter mode={mode} />
        </Providers>
      </body>
    </html>
  );
}
