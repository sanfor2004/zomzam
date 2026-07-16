import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
  // Dropped '300' (font-light) — unused across the app. Weights 400–900 cover
  // every font-normal/medium/semibold/bold/extrabold/black class in use.
  weight: ['400', '500', '600', '700', '800', '900'],
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono-face',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  // Absolute base for OG/Twitter/canonical URLs (public profiles emit them).
  // APP_URL is the deployed origin; Vercel's URL covers previews; localhost is dev.
  metadataBase: new URL(
    process.env.APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  ),
  title: 'zomzam.com',
  description: 'Professional life and money management platform.',
  icons: {
    icon: '/Assets/Img/favicon.ico',
    shortcut: '/Assets/Img/favicon.ico',
    apple: '/Assets/Img/Icon-orange.svg',
  },
};

// Browser chrome (mobile address bar, Windows title bar) matches the app's
// dark surface — value = --color-surface-dark token, never an invented hex.
export const viewport: Viewport = {
  themeColor: '#111318',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} dark h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-surface-dark text-slate-100 transition-colors duration-300">
        {/* ──────────────────────────────────────────────────────────
            DEVELOPMENT NAVIGATOR: ROOT APP SHELL
            Contains: Global context Providers wrapper, routed page children
            ────────────────────────────────────────────────────────── */}
        <Providers>
          {children}
        </Providers>
        <SpeedInsights />
      </body>
    </html>
  );
}
