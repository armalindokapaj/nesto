import type { Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";
import "./globals.css";
import { getT } from "@/lib/i18n/server";
import { LocaleProvider } from "@/lib/i18n/locale-provider";
import { peekSession, loadUserIdentity } from "@/lib/dal";
import { resolveDataTheme } from "@/lib/theme";
import type { Theme } from "@/lib/constants";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const newsreader = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nesto — Private software for construction companies",
  description:
    "Nesto is the private operating system construction companies run on: projects, people, contracts, finance, contractors, documents and approvals in one secure workspace.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { locale, dict } = await getT();

  const session = await peekSession();
  let dataTheme: string | undefined;
  if (session?.userId) {
    // Shared with getCurrentUser()'s read of the same row — see loadUserIdentity.
    const user = await loadUserIdentity(session.userId);
    if (user) dataTheme = resolveDataTheme(user.theme as Theme);
  }

  return (
    <html
      lang={locale}
      data-theme={dataTheme}
      className={`${inter.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-canvas text-ink font-sans">
        <LocaleProvider locale={locale} dictionary={dict}>
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
