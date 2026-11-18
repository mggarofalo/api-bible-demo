import type { Metadata } from "next";
import { Ubuntu } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/NavBar";
import { Suspense } from "react";
import PageLoader from "@/components/PageLoader";
import { INITIAL_SETTINGS_SCRIPT } from "@/components/NavControls";
import { FumsPanel } from "@/components/FumsPanel";
import { FUMS_SCRIPT_URL, FUMS_SHIM_SCRIPT } from "@/utils/fums";
import Script from "next/script";

const ubuntu = Ubuntu({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

export const metadata: Metadata = {
  title: "API.Bible Demo",
  description: "API.Bible NextJS Demo Application",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/favicon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

/**
 * Global layout for the application. Renders the Navbar
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${ubuntu.className} min-h-full antialiased w-[100vw] `}
      suppressHydrationWarning
    >
      <head>
        {/* Sets the theme and the help setting before the page shows */}
        <script dangerouslySetInnerHTML={{ __html: INITIAL_SETTINGS_SCRIPT }} />
        {/* FUMS: makes the `fums` function before the FUMS script loads (see utils/fums.ts) */}
        <script dangerouslySetInnerHTML={{ __html: FUMS_SHIM_SCRIPT }} />
      </head>
      <body className="w-full h-full flex flex-col items-center">
        {/* The page has a fixed width at each screen size, so it does not change with its content */}
        <div className="w-full max-w-full md:w-[768px] xl:w-[960px] flex flex-col border-line border-l-[1px] border-r-[1px] pb-[20vh]">
          <Suspense fallback={<PageLoader />}>
            <Navbar />
            {children}
          </Suspense>
        </div>
        {/* FUMS: the script that sends each report, and the panel that shows the reports */}
        <Script src={FUMS_SCRIPT_URL} strategy="afterInteractive" />
        <FumsPanel />
      </body>
    </html>
  );
}
