import type { Metadata, Viewport } from "next";
import { PwaRegistration } from "@/components/PwaRegistration";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "katex/dist/katex.min.css";
// 平台改动：等宽字体改为自托管（@fontsource），不再用 next/font/google。
// 原因：next/font/google 会在**构建期**访问 fonts.googleapis.com，境内构建机取不到；
// 自托管同时满足"运行期不引 CDN"。改动登记见 platform/FORK.md。
import "@fontsource/noto-sans-mono/400.css";
import "@fontsource/noto-sans-mono/700.css";
import "./globals.css";
import "./settings.css";

// 原本由 next/font 注入这个变量；自托管后直接给值，供 globals.css 的 --font-mono 引用。
const FONT_VARIABLE = { "--font-noto-mono": "'Noto Sans Mono'" } as React.CSSProperties;

export const metadata: Metadata = {
  title: "Pi Web",
  description: "Pi Web interface for the pi coding agent",
  applicationName: "Pi Web",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      {
        url: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Pi Web",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1a1a" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" translate="no" className="notranslate" style={FONT_VARIABLE} suppressHydrationWarning>
      <head>
        <meta name="google" content="notranslate" />
        <script
          dangerouslySetInnerHTML={{
            __html: THEME_INIT_SCRIPT,
          }}
        />
      </head>
      <body translate="no" className="notranslate" suppressHydrationWarning>
        {children}
        <PwaRegistration />
      </body>
    </html>
  );
}
