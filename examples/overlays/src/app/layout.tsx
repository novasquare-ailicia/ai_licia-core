import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { Providers } from "@/components/Providers";
import CookieBanner from "@/components/CookieBanner";

const GA_MEASUREMENT_ID = "G-VDWNQ1287V";

export const metadata: Metadata = {
  title: "ai_licia® Overlay Studio",
  description: "Generate modern browser-source overlays powered by ai_licia®.",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
        <CookieBanner />
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="ga4-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            window.gtag = gtag;
            const consentAccepted = window.localStorage.getItem('ai_licia_cookie_consent') === 'accepted';
            const consentValue = consentAccepted ? 'granted' : 'denied';
            gtag('consent', 'default', {
              ad_storage: consentValue,
              analytics_storage: consentValue,
            });
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}', { anonymize_ip: true });
          `}
        </Script>
      </body>
    </html>
  );
}
